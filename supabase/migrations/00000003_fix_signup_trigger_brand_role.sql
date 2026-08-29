-- Fix: brand signups were silently also getting a spurious consumers row,
-- because the original trigger only special-cased 'creator' and defaulted
-- everything else (including 'brand') to consumer provisioning.

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
  elsif chosen_role = 'brand' then
    -- brands get an organization via the onboarding flow, not a consumer/creator row
    null;
  else
    insert into public.consumers (id, handle) values (new.id, chosen_handle)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;
