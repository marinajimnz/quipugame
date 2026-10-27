import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, cleanup, createPlayer, trackGame, trackRoom, type Player } from '../helpers';

// Revancha en salas privadas: «Jugar otra vez» y «Volver al inicio» al acabar.

let host: Player;
let p1: Player;
let p2: Player;

beforeAll(async () => {
  [host, p1, p2] = await Promise.all([createPlayer(), createPlayer(), createPlayer()]);
});
afterAll(cleanup);

/** Sala con estos jugadores dentro y su primera partida empezada. */
async function roomGame(players: Player[], bots = false): Promise<{ roomId: string; gameId: string }> {
  const [first, ...rest] = players;
  const { data: code } = await first.client.rpc('create_room', { p_seats: Math.max(players.length, 2), p_fill_bots: bots });
  const { data: room } = await admin.from('rooms').select('id').eq('code', code as string).single();
  trackRoom(room!.id);
  for (const p of rest) expect((await p.client.rpc('join_room', { p_code: code })).error).toBeNull();
  const { data: gameId, error } = await first.client.rpc('start_game', { p_room_id: room!.id });
  expect(error).toBeNull();
  trackGame(gameId as string);
  return { roomId: room!.id, gameId: gameId as string };
}

/** Termina la partida: este jugador declara sus números reales y gana. */
async function win(gameId: string, player: Player): Promise<void> {
  const { data: me } = await admin.from('game_players').select('id').eq('game_id', gameId).eq('profile_id', player.id).single();
  const { data: tiles } = await admin
    .from('game_tiles').select('number').eq('game_id', gameId).eq('owner_id', me!.id).eq('place', 'support').order('slot');
  const { data, error } = await player.client.rpc('declare_code', { p_game_id: gameId, p_numbers: tiles!.map((t) => t.number) });
  expect(error).toBeNull();
  expect((data as { correct: boolean }).correct).toBe(true);
}

const rematch = (p: Player, gameId: string) => p.client.rpc('rematch_room', { p_game_id: gameId });
const status = async (p: Player, gameId: string) => (await p.client.rpc('get_room_rematch', { p_game_id: gameId })).data;

describe('revancha', () => {
  it('la partida sabe de qué sala viene', async () => {
    const { roomId, gameId } = await roomGame([host, p1]);
    const { data } = await admin.from('games').select('room_id').eq('id', gameId).single();
    expect(data!.room_id).toBe(roomId);
  });

  it('no se puede pedir otra antes de que acabe la partida', async () => {
    const { gameId } = await roomGame([host, p1]);
    expect((await rematch(host, gameId)).error?.message).toBe('game_not_finished');
  });

  it('cuando todos piden otra, empieza una nueva en la misma sala con los mismos', async () => {
    const { roomId, gameId } = await roomGame([host, p1]);
    await win(gameId, host);

    const first = await rematch(host, gameId);
    expect(first.error).toBeNull();
    expect(first.data).toBeNull(); // falta p1
    expect(await status(p1, gameId)).toMatchObject({
      room_id: roomId,
      next_game_id: null,
      members: expect.arrayContaining([
        expect.objectContaining({ profile_id: host.id, ready: true }),
        expect.objectContaining({ profile_id: p1.id, ready: false }),
      ]),
    });

    const second = await rematch(p1, gameId);
    expect(second.error).toBeNull();
    const next = second.data as string;
    expect(next).toBeTruthy();
    trackGame(next);

    const { data: room } = await admin.from('rooms').select('game_id, status').eq('id', roomId).single();
    expect(room).toEqual({ game_id: next, status: 'started' });
    const { data: game } = await admin.from('games').select('room_id, status, mode').eq('id', next).single();
    expect(game).toMatchObject({ room_id: roomId, status: 'active', mode: 'private' });
    const { data: players } = await admin.from('game_players').select('profile_id').eq('game_id', next);
    expect(players!.map((p) => p.profile_id).sort()).toEqual([host.id, p1.id].sort());

    // Los dos ven la nueva, y pedir otra tarde devuelve la ya empezada.
    expect(await status(host, gameId)).toMatchObject({ next_game_id: next });
    expect((await rematch(host, gameId)).data).toBe(next);
    // En la nueva nadie ha votado todavía.
    expect((await status(host, next)).members.every((m: { ready: boolean }) => !m.ready)).toBe(true);
  });

  it('si el otro vuelve al inicio, sale de la sala y ya no hay revancha (aunque haya bots)', async () => {
    const { roomId, gameId } = await roomGame([host, p1], true);
    await win(gameId, p1);

    expect((await p1.client.rpc('leave_room_game', { p_game_id: gameId })).error).toBeNull();
    expect(await status(p1, gameId)).toBeNull(); // ya no está en la sala
    expect(await status(host, gameId)).toMatchObject({ members: [expect.objectContaining({ profile_id: host.id, ready: false })] });

    expect((await rematch(host, gameId)).data).toBeNull();
    const { data: room } = await admin.from('rooms').select('game_id').eq('id', roomId).single();
    expect(room!.game_id).toBe(gameId);
  });

  it('si sale el anfitrión, la sala sigue y pasa a ser anfitrión quien entró antes', async () => {
    const { roomId, gameId } = await roomGame([host, p1, p2]);
    await win(gameId, p2);

    await host.client.rpc('leave_room_game', { p_game_id: gameId });
    const { data: room } = await admin.from('rooms').select('host_id, status').eq('id', roomId).single();
    expect(room).toEqual({ host_id: p1.id, status: 'started' });

    // Con los dos que quedan, la revancha sigue funcionando.
    expect((await rematch(p1, gameId)).data).toBeNull();
    const next = (await rematch(p2, gameId)).data as string;
    expect(next).toBeTruthy();
    trackGame(next);
    const { data: players } = await admin.from('game_players').select('profile_id').eq('game_id', next);
    expect(players!.map((p) => p.profile_id).sort()).toEqual([p1.id, p2.id].sort());
  });

  it('quien abandonó la partida no cuenta: no hace falta su voto', async () => {
    const { gameId } = await roomGame([host, p1, p2]);
    await p2.client.rpc('abandon_game', { p_game_id: gameId });
    await win(gameId, host);

    expect((await status(host, gameId)).members.map((m: { profile_id: string }) => m.profile_id).sort()).toEqual(
      [host.id, p1.id].sort(),
    );
    expect((await rematch(host, gameId)).data).toBeNull();
    const next = (await rematch(p1, gameId)).data as string;
    expect(next).toBeTruthy();
    trackGame(next);
  });

  it('si al salir no queda nadie, la sala se cierra', async () => {
    const { roomId, gameId } = await roomGame([host, p1]);
    await win(gameId, host);
    await p1.client.rpc('leave_room_game', { p_game_id: gameId });
    await host.client.rpc('leave_room_game', { p_game_id: gameId });
    const { data: room } = await admin.from('rooms').select('status').eq('id', roomId).single();
    expect(room!.status).toBe('expired');
  });
});
