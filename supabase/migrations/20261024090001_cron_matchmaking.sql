-- T071: emparejamiento cada 3 s (spec §8).
select cron.schedule('resolve-matchmaking', '3 seconds', $$select game_internal.resolve_matchmaking()$$);
