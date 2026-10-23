-- T060 + T061: programa las tareas periódicas (pg_cron).
select cron.schedule('tick-timeouts', '2 seconds', $$select game_internal.tick_timeouts()$$);
select cron.schedule('expire-rooms', '* * * * *', $$select game_internal.expire_rooms()$$);
