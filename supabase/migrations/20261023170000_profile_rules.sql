-- T035 + T036: reglas del nombre visible y paso de invitado a cuenta permanente.

-- El nombre no puede tener espacios sobrantes ni caracteres de control.
alter table public.profiles
  add constraint profiles_display_name_clean check (
    display_name::text = btrim(display_name::text)
    and display_name::text !~ '[[:cntrl:]]'
  );

-- Cuando una cuenta anónima se convierte en permanente (Auth pone is_anonymous = false),
-- el perfil conserva el mismo id, las partidas y el ELO; solo cambia is_guest.
create function public.sync_guest_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set is_guest = coalesce(new.is_anonymous, false)
   where id = new.id;
  return new;
end;
$$;

revoke execute on function public.sync_guest_flag() from public, anon, authenticated;

create trigger on_auth_user_anonymity_changed
  after update of is_anonymous on auth.users
  for each row
  when (old.is_anonymous is distinct from new.is_anonymous)
  execute function public.sync_guest_flag();
