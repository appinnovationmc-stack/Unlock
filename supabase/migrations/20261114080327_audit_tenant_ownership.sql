alter table public.campaigns add constraint campaigns_id_org_unique unique (id, org_id);
alter table public.campaign_locations add constraint location_campaign_owner_fk foreign key (campaign_id,org_id) references public.campaigns(id,org_id);
alter table public.rewards add constraint reward_campaign_owner_fk foreign key (campaign_id,org_id) references public.campaigns(id,org_id);
