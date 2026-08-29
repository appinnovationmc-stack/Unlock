-- Physical product-hunt claims: unique per-unit QR codes, proof-of-find,
-- store location, and share-gated provisional rewards.
--
-- Flow: ad QR (existing qr_scan mechanic) -> clue/quiz unlocks campaign ->
-- consumer finds physical unit -> scans that unit's UNIQUE code -> uploads
-- proof photo + store location -> reward is 'pending' until cosign/share
-- confirms real engagement, then flips to 'claimed'.

create type product_code_status as enum ('unclaimed', 'reserved', 'claimed');

create table if not exists product_codes (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  code text not null unique,                 -- value encoded in the physical QR
  store_location text,                       -- optional: pre-assign to a store's stock
  status product_code_status not null default 'unclaimed',
  claimed_by uuid references consumers(id),
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists product_codes_campaign_idx on product_codes (campaign_id);
create index if not exists product_codes_status_idx on product_codes (campaign_id, status);

alter table product_codes enable row level security;

-- Consumers never read the raw code list directly (that would let them
-- guess/scrape unclaimed codes) -- only org members managing the campaign do.
create policy "org members manage their product codes" on product_codes
  for all using (
    campaign_id in (
      select id from campaigns
      where org_id in (select org_id from org_members where user_id = auth.uid())
    )
  )
  with check (
    campaign_id in (
      select id from campaigns
      where org_id in (select org_id from org_members where user_id = auth.uid())
    )
  );

-- Proof-of-find + share-gating fields on the existing claims table.
alter table reward_claims
  add column if not exists product_code_id uuid references product_codes(id),
  add column if not exists proof_photo_url text,
  add column if not exists claim_store_location text,
  add column if not exists shared_externally boolean not null default false;

do $$ begin
  alter type reward_claim_status add value if not exists 'pending_verification';
exception when duplicate_object then null;
end $$;

-- Atomically validate + reserve a physical unit's code, then create a
-- pending claim. Reward flips from pending_verification -> claimed only
-- once the cosign/share step confirms (see confirm_product_claim below).
create or replace function public.claim_product_code(
  p_campaign_id uuid,
  p_code text,
  p_proof_photo_url text default null,
  p_store_location text default null
)
returns table(claim_id uuid, reward_label text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_status campaign_status;
  v_code_id uuid;
  v_code_status product_code_status;
  v_reward_id uuid;
  v_reward_label text;
  v_claim_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select c.status into v_status from campaigns c where c.id = p_campaign_id;
  if v_status is null then
    raise exception 'Campaign not found';
  end if;
  if v_status is distinct from 'live' then
    raise exception 'Campaign is not live';
  end if;

  -- Lock the row so two people scanning the same physical unit can't both win.
  select id, status into v_code_id, v_code_status
  from product_codes
  where campaign_id = p_campaign_id and code = p_code
  for update;

  if v_code_id is null then
    raise exception 'Code does not match this campaign';
  end if;

  if v_code_status is distinct from 'unclaimed' then
    raise exception 'This unit has already been claimed';
  end if;

  update product_codes
  set status = 'claimed',
      claimed_by = auth.uid(),
      claimed_at = now()
  where id = v_code_id;

  select r.id, r.label into v_reward_id, v_reward_label
  from rewards r
  where r.campaign_id = p_campaign_id
  order by r.id
  limit 1;

  if v_reward_id is null then
    raise exception 'No reward configured for this campaign';
  end if;

  insert into reward_claims (
    reward_id, campaign_id, consumer_id, status,
    product_code_id, proof_photo_url, claim_store_location
  )
  values (
    v_reward_id, p_campaign_id, auth.uid(), 'pending_verification',
    v_code_id, p_proof_photo_url, p_store_location
  )
  returning id into v_claim_id;

  return query select v_claim_id, v_reward_label;
end;
$$;

grant execute on function public.claim_product_code(uuid, text, text, text) to authenticated;

-- Flips a pending claim to fully claimed once the share/cosign step
-- (handled in application logic or a future cosign table) confirms it.
create or replace function public.confirm_product_claim(p_claim_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_consumer uuid;
  v_status reward_claim_status;
  v_reward_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select consumer_id, status, reward_id into v_consumer, v_status, v_reward_id
  from reward_claims
  where id = p_claim_id
  for update;

  if v_consumer is null then
    raise exception 'Claim not found';
  end if;

  if v_consumer is distinct from auth.uid() then
    raise exception 'Not your claim';
  end if;

  if v_status is distinct from 'pending_verification' then
    raise exception 'Claim is not awaiting verification';
  end if;

  update reward_claims
  set status = 'claimed',
      shared_externally = true
  where id = p_claim_id;

  update rewards
  set redeemed_count = redeemed_count + 1
  where id = v_reward_id
    and (stock is null or redeemed_count < stock);

  return true;
end;
$$;

grant execute on function public.confirm_product_claim(uuid) to authenticated;
