import { afterAll, describe, expect, it } from 'vitest';
import { cleanup, createGame, createGuest, createPlayer, getState } from '../helpers';

// El estado de la partida dice si cada rival humano es invitado o tiene cuenta, para mostrar
// «Invitado» / «Verificado» junto a su nombre.

afterAll(cleanup);

describe('is_guest en el estado de la partida', () => {
  it('el rival con cuenta es verificado y el invitado no', async () => {
    const [account, guest] = [await createPlayer(), await createGuest()];
    const game = await createGame([account, guest]);

    const seenByAccount = await getState(game, 0);
    expect(seenByAccount.players).toHaveLength(1);
    expect(seenByAccount.players[0].is_guest).toBe(true);

    const seenByGuest = await getState(game, 1);
    expect(seenByGuest.players[0].is_guest).toBe(false);
  });
});
