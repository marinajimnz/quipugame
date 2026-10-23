-- T043: programa la tarea de los bots (pg_cron, cada segundo). Ningún servicio externo (P8).
create extension if not exists pg_cron with schema pg_catalog;

-- Si ya existía un trabajo con este nombre, cron.schedule lo actualiza.
select cron.schedule('play-bot-turns', '1 second', $$select game_internal.play_bot_turns()$$);
