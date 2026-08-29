-- On signup, a user picks a role (consumer or creator) via metadata.
-- This trigger provisions the matching row automatically so the app
-- never has to insert into consumers/creators directly.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  chosen_role text := coalesce(new.raw_user_meta_data->>'role', 'consumer');
  chosen_handle text := coalesce(new.raw_user_meta_data->>'handle', 'user_' || substr(new.id::text, 1, 8));
begin
  if chosen_role = 'creator' then
    insert into public.creators (id, handle) values (new.id, chosen_handle)
    on conflict (id) do nothing;
  else
    insert into public.consumers (id, handle) values (new.id, chosen_handle)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
