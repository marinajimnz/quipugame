import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, anonClient, cleanup, createGuest, createPlayer, trackGame, trackRoom, type Player } from '../helpers';

// T051: salas privadas.

let host: Player;
let p1: Player;
let p2: Player;
let p3: Player;

beforeAll(async () => {
  [host, p1, p2, p3] = await Promise.all([createPlayer(), createPlayer(), createPlayer(), createPlayer()]);
});
afterAll(cleanup);

async function create(player: Player, seats: number, bots = false): Promise<{ code: string; id: string }> {
  const { data: code, error } = await player.client.rpc('create_room', { p_seats: seats, p_fill_bots: bots });
  expect(error).toBeNull();
  const { data: room } = await admin.from('rooms').select('id').eq('code', code as string).single();
  trackRoom(room!.id);
  return { code: code as string, id: room!.id };
}

describe('create_room', () => {
  it('crea la sala: código sin caracteres ambiguos, anfitrión dentro, caduca en 30 min', async () => {
    const { code, id } = await create(host, 3);
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);

    const { data: room } = await admin.from('rooms').select('*').eq('id', id).single();
    expect(room).toMatchObject({ host_id: host.id, seats: 3, status: 'open', fill_with_bots: false, game_id: null });
    const minutes = (new Date(room!.expires_at).getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(29);
    expect(minutes).toBeLessThan(31);

    const { data: members } = await admin.from('room_members').select('profile_id').eq('room_id', id);
    expect(members).toEqual([{ profile_id: host.id }]);
  });

  it('rechaza un número de plazas inválido y exige sesión', async () => {
    for (const seats of [1, 5, 0]) {
      expect((await host.client.rpc('create_room', { p_seats: seats })).error?.message, String(seats)).toBe('invalid_seats');
    }
    expect((await anonClient().rpc('create_room', { p_seats: 2 })).error).not.toBeNull();
  });

  it('los códigos no se repiten', async () => {
    const guest = await createGuest();
    const codes = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const { code } = await create(guest, 2);
      codes.add(code);
    }
    expect(codes.size).toBe(8);
  });

  it('cada anfitrión tiene una sola sala abierta: crear otra cierra la anterior', async () => {
    const guest = await createGuest();
    const first = await create(guest, 2);
    const second = await create(guest, 2);
    const { data } = await admin.from('rooms').select('id, status').in('id', [first.id, second.id]);
    expect(data!.find((r) => r.id === first.id)?.status).toBe('expired');
    expect(data!.find((r) => r.id === second.id)?.status).toBe('open');
  });
});

describe('join_room y leave_room', () => {
  it('unirse con minúsculas y espacios, idempotente, y rechaza la sala llena', async () => {
    const { code, id } = await create(host, 3);
    const joined = await p1.client.rpc('join_room', { p_code: ` ${code.toLowerCase()} ` });
    expect(joined.error).toBeNull();
    expect(joined.data).toBe(id);
    expect((await p1.client.rpc('join_room', { p_code: code })).data).toBe(id); // idempotente

    expect((await p2.client.rpc('join_room', { p_code: code })).error).toBeNull();
    const full = await p3.client.rpc('join_room', { p_code: code });
    expect(full.error?.message).toBe('room_full');

    const { data } = await admin.from('room_members').select('profile_id').eq('room_id', id);
    expect(data).toHaveLength(3);
  });

  it('código inexistente, sala caducada y sala cerrada', async () => {
    expect((await p1.client.rpc('join_room', { p_code: 'ZZZZZZ' })).error?.message).toBe('room_not_found');

    const { code, id } = await create(host, 2);
    await admin.from('rooms').update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', id);
    expect((await p1.client.rpc('join_room', { p_code: code })).error?.message).toBe('room_expired');
  });

  it('salir libera la plaza; si sale el anfitrión, la sala se cierra', async () => {
    const { code, id } = await create(host, 2);
    await p1.client.rpc('join_room', { p_code: code });
    expect((await p1.client.rpc('leave_room', { p_room_id: id })).error).toBeNull();
    expect(((await admin.from('room_members').select('profile_id').eq('room_id', id)).data ?? [])).toHaveLength(1);
    expect((await p2.client.rpc('join_room', { p_code: code })).error).toBeNull(); // la plaza vuelve a estar libre

    expect((await host.client.rpc('leave_room', { p_room_id: id })).error).toBeNull();
    const { data: room } = await admin.from('rooms').select('status').eq('id', id).single();
    expect(room?.status).toBe('expired');
    expect((await p3.client.rpc('join_room', { p_code: code })).error?.message).toBe('room_expired');
  });

  it('quien no es miembro no puede salir', async () => {
    const { id } = await create(host, 2);
    expect((await p3.client.rpc('leave_room', { p_room_id: id })).error?.message).toBe('not_a_member');
  });
});

describe('get_room_by_code y visibilidad', () => {
  it('cualquiera con el código ve los datos básicos, pero no la lista de salas', async () => {
    const { code, id } = await create(host, 4);
    const { data, error } = await p3.client.rpc('get_room_by_code', { p_code: code.toLowerCase() });
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ id, code, host_id: host.id, seats: 4, status: 'open', members: 1 });

    const direct = await p3.client.from('rooms').select('id').eq('id', id);
    expect(direct.data).toEqual([]); // sin ser miembro, RLS no deja leer la sala
    expect((await host.client.from('rooms').select('id').eq('id', id)).data).toHaveLength(1);
  });
});

describe('start_game', () => {
  it('solo el anfitrión puede iniciar y hacen falta 2 personas si no hay bots', async () => {
    const { code, id } = await create(host, 3);
    expect((await host.client.rpc('start_game', { p_room_id: id })).error?.message).toBe('not_enough_players');

    await p1.client.rpc('join_room', { p_code: code });
    expect((await p1.client.rpc('start_game', { p_room_id: id })).error?.message).toBe('not_host');
  });

  it('inicia la partida privada con las personas de la sala y sortea los asientos', async () => {
    const { code, id } = await create(host, 3);
    await p1.client.rpc('join_room', { p_code: code });
    await p2.client.rpc('join_room', { p_code: code });

    const { data: gameId, error } = await host.client.rpc('start_game', { p_room_id: id });
    expect(error).toBeNull();
    trackGame(gameId as string);

    const { data: game } = await admin.from('games').select('mode, status').eq('id', gameId as string).single();
    expect(game).toEqual({ mode: 'private', status: 'active' });
    const { data: players } = await admin.from('game_players').select('profile_id, seat, is_bot').eq('game_id', gameId as string).order('seat');
    expect(players!.map((x) => x.seat)).toEqual([0, 1, 2]);
    expect(players!.every((x) => !x.is_bot)).toBe(true);
    expect(new Set(players!.map((x) => x.profile_id))).toEqual(new Set([host.id, p1.id, p2.id]));

    const { data: room } = await admin.from('rooms').select('status, game_id').eq('id', id).single();
    expect(room).toEqual({ status: 'started', game_id: gameId });

    // Una vez iniciada: no se puede iniciar otra vez ni entrar nuevos, pero los miembros vuelven.
    expect((await host.client.rpc('start_game', { p_room_id: id })).error?.message).toBe('room_not_open');
    expect((await p3.client.rpc('join_room', { p_code: code })).error?.message).toBe('room_not_open');
    expect((await p1.client.rpc('join_room', { p_code: code })).data).toBe(id);
    expect((await p1.client.rpc('get_game_state', { p_game_id: gameId })).error).toBeNull();
  });

  it('con "rellenar con bots" el anfitrión inicia solo y las plazas libres se cubren', async () => {
    const { id } = await create(host, 4, true);
    const { data: gameId, error } = await host.client.rpc('start_game', { p_room_id: id });
    expect(error).toBeNull();
    trackGame(gameId as string);

    const { data: players } = await admin.from('game_players').select('seat, is_bot, bot_difficulty').eq('game_id', gameId as string).order('seat');
    expect(players).toHaveLength(4);
    expect(players!.filter((x) => x.is_bot)).toHaveLength(3);
    expect(players!.filter((x) => x.is_bot).every((x) => x.bot_difficulty === 'normal')).toBe(true);
    expect(players!.map((x) => x.seat)).toEqual([0, 1, 2, 3]);
  });

  it('no afecta al ELO: la partida es privada', async () => {
    const { id } = await create(host, 2, true);
    const { data: gameId } = await host.client.rpc('start_game', { p_room_id: id });
    trackGame(gameId as string);
    const { data: game } = await admin.from('games').select('mode').eq('id', gameId as string).single();
    expect(game?.mode).toBe('private');
  });
});
