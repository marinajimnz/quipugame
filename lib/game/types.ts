// Forma del JSON que devuelve get_game_state. El servidor decide qué ve cada jugador;
// el cliente solo lo pinta (P1).
export type Phase = 'reveal' | 'clue';
export type GameStatus = 'waiting' | 'dealing' | 'active' | 'finished' | 'cancelled';
export type PlayerState = 'active' | 'eliminated' | 'abandoned';
export type ColorIndex = 0 | 1 | 2 | 3 | 4;

export interface PublicTile {
  number: number;
  color_index: number;
  points: 1 | 2 | 3;
}

export interface OtherPlayer {
  player_id: string;
  seat: number;
  display_name: string | null; // null en los bots
  avatar_key: string | null;
  is_bot: boolean;
  is_guest: boolean; // invitado (sin cuenta); false en los bots
  state: PlayerState;
  has_declared: boolean;
  last_seen_at: string;
  support: (PublicTile & { slot: number })[];
}

export interface Clue {
  id: string;
  asker_id: string;
  tile_number: number;
  kind: 'classify' | 'compare';
  target_slot: number | null;
  answer_position: number | null;
  answer_same: boolean | null;
  created_at: string;
}

export interface GameState {
  game: {
    status: GameStatus;
    mode: 'ranked' | 'private' | 'practice';
    phase: Phase;
    current_seat: number | null;
    turn_deadline: string | null;
    winner_player_id: string | null;
    server_time: string;
    reserve_by_color: number[];
  };
  me: {
    player_id: string;
    seat: number;
    state: PlayerState;
    has_declared: boolean;
    support: { slot: number; color_index: number; resolved_number: number | null }[];
  };
  players: OtherPlayer[];
  pool: PublicTile[];
  clues: Clue[];
  event_seq: number;
}

export function isMyTurn(state: GameState): boolean {
  return (
    state.game.status === 'active' &&
    state.me.state === 'active' &&
    state.game.current_seat === state.me.seat
  );
}
