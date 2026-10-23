import { describe, expect, it } from 'vitest';
import { seqGap } from '@/lib/game/seqGap';
import { cleanRoomCode, isRoomCode, roomErrorKey } from '@/lib/room/roomErrors';

describe('seqGap', () => {
  it('detecta un hueco en la numeración de eventos', () => {
    expect(seqGap(0, 5)).toBe(false); // aún no había visto ninguno
    expect(seqGap(4, 5)).toBe(false); // el siguiente esperado
    expect(seqGap(4, 4)).toBe(false); // repetido
    expect(seqGap(4, 3)).toBe(false); // atrasado
    expect(seqGap(4, 6)).toBe(true); //  falta el 5
    expect(seqGap(1, 128)).toBe(true);
  });
});

describe('códigos de sala', () => {
  it('normaliza lo que escribe el usuario', () => {
    expect(cleanRoomCode('ab3 k9z')).toBe('AB3K9Z');
    expect(cleanRoomCode('0O1Iabcdef')).toBe('ABCDEF'); // sin 0, O, 1, I
    expect(cleanRoomCode('ABCDEFGHJK')).toBe('ABCDEF'); // máximo 6
    expect(cleanRoomCode('--//')).toBe('');
  });

  it('valida el formato', () => {
    expect(isRoomCode('AB3K9Z')).toBe(true);
    expect(isRoomCode('AB3K9')).toBe(false);
    expect(isRoomCode('AB3K9I')).toBe(false);
    expect(isRoomCode('ab3k9z')).toBe(false);
  });

  it('traduce errores del servidor', () => {
    expect(roomErrorKey({ message: 'room_full' })).toBe('room_full');
    expect(roomErrorKey({ message: 'algo_raro' })).toBe('generic');
    expect(roomErrorKey(null)).toBe('generic');
  });
});
