-- T052: Realtime. Se publican las tablas que el cliente escucha. Realtime aplica las políticas
-- RLS a cada suscriptor, así que nadie recibe cambios de partidas o salas ajenas.
--
-- game_tiles NO se publica nunca (R1): ahí viven los números ocultos. Un test lo comprueba.
alter publication supabase_realtime add table
  public.games,
  public.game_players,
  public.game_events,
  public.game_clues,
  public.rooms,
  public.room_members;
