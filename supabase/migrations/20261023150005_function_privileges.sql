-- Endurecimiento: las funciones nuevas ya no nacen ejecutables por PUBLIC.
--
-- Postgres concede EXECUTE a PUBLIC en toda función nueva. Un ALTER DEFAULT PRIVILEGES
-- limitado a un esquema solo puede AÑADIR permisos, nunca quitar ese PUBLIC implícito, así que
-- el revoke "in schema game_internal" de la migración de tipos no tenía efecto. Aquí se quita
-- globalmente para el rol que ejecuta las migraciones. Cada función invocable por RPC ya
-- concede EXECUTE a authenticated de forma explícita.
alter default privileges for role postgres revoke execute on functions from public;

-- Funciones que ya existían: se retira el permiso a PUBLIC, anon y authenticated.
revoke execute on all functions in schema game_internal from public, anon, authenticated;
