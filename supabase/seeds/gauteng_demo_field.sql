-- DEMO FIELD — Johannesburg + Pretoria
-- Real public store / HQ addresses. Not an official brand campaign.
-- Titles carry DEMO so nobody thinks Woolworths signed.
-- Idempotent: fixed UUIDs. Re-run safe.
-- Paste in Supabase SQL editor on unlock-production.

do $$
begin
  -- Orgs
  insert into organizations (id, name, kind, industry) values
    ('11111111-1111-4111-8111-111111111101', 'Woolworths (demo)', 'brand', 'retail'),
    ('11111111-1111-4111-8111-111111111102', 'Nando''s (demo)', 'brand', 'food'),
    ('11111111-1111-4111-8111-111111111103', 'Discovery (demo)', 'brand', 'finance'),
    ('11111111-1111-4111-8111-111111111104', 'MTN (demo)', 'brand', 'telecom'),
    ('11111111-1111-4111-8111-111111111105', 'Vodacom (demo)', 'brand', 'telecom'),
    ('11111111-1111-4111-8111-111111111106', 'Cape Union Mart (demo)', 'brand', 'retail')
  on conflict (id) do update set name = excluded.name;

  -- Campaigns
  insert into campaigns (id, org_id, title, tagline, status, mechanics, starts_at, ends_at, xp_value) values
    (
      '22222222-2222-4222-8222-222222222201',
      '11111111-1111-4111-8111-111111111101',
      'DEMO · Hold at Woolworths Sandton City',
      'Walk in. Hold. Unlock a tasting voucher.',
      'live', array['geolocation']::campaign_mechanic[],
      now(), now() + interval '21 days', 40
    ),
    (
      '22222222-2222-4222-8222-222222222202',
      '11111111-1111-4111-8111-111111111101',
      'DEMO · Hold at Woolworths Menlyn Park',
      'Same drop. Pretoria side.',
      'live', array['geolocation']::campaign_mechanic[],
      now(), now() + interval '21 days', 40
    ),
    (
      '22222222-2222-4222-8222-222222222203',
      '11111111-1111-4111-8111-111111111102',
      'DEMO · Flame at Nando''s Menlyn Mall',
      'Show up. Hold at the counter. Unlock PERi.',
      'live', array['geolocation']::campaign_mechanic[],
      now(), now() + interval '21 days', 35
    ),
    (
      '22222222-2222-4222-8222-222222222204',
      '11111111-1111-4111-8111-111111111102',
      'DEMO · Flame at Nando''s Melrose Arch',
      'Johannesburg lunch drop.',
      'live', array['geolocation']::campaign_mechanic[],
      now(), now() + interval '21 days', 35
    ),
    (
      '22222222-2222-4222-8222-222222222205',
      '11111111-1111-4111-8111-111111111103',
      'DEMO · Walk the Discovery campus',
      '1 Discovery Place. Arrive. Hold. Unlock Vitality points story.',
      'live', array['geolocation']::campaign_mechanic[],
      now(), now() + interval '21 days', 50
    ),
    (
      '22222222-2222-4222-8222-222222222206',
      '11111111-1111-4111-8111-111111111104',
      'DEMO · MTN Innovation Centre',
      'Fairland campus. Planted for the field demo.',
      'live', array['geolocation']::campaign_mechanic[],
      now(), now() + interval '21 days', 45
    ),
    (
      '22222222-2222-4222-8222-222222222207',
      '11111111-1111-4111-8111-111111111105',
      'DEMO · Vodacom World Midrand',
      '082 Vodacom Boulevard. Arrive and hold.',
      'live', array['geolocation']::campaign_mechanic[],
      now(), now() + interval '21 days', 45
    ),
    (
      '22222222-2222-4222-8222-222222222208',
      '11111111-1111-4111-8111-111111111106',
      'DEMO · Cape Union Mart Brooklyn',
      'Level 2, Brooklyn Mall. Gear drop.',
      'live', array['geolocation']::campaign_mechanic[],
      now(), now() + interval '21 days', 30
    )
  on conflict (id) do update set
    title = excluded.title,
    tagline = excluded.tagline,
    status = 'live',
    ends_at = excluded.ends_at;

  -- Locations (geography point = lng, lat)
  insert into campaign_locations (id, org_id, campaign_id, label, geog, radius_m) values
    (
      '33333333-3333-4333-8333-333333333301',
      '11111111-1111-4111-8111-111111111101',
      '22222222-2222-4222-8222-222222222201',
      'Woolworths Sandton City · 79 Rivonia Rd, Sandton, 2196',
      ST_SetSRID(ST_MakePoint(28.0517, -26.1085), 4326)::geography,
      180
    ),
    (
      '33333333-3333-4333-8333-333333333302',
      '11111111-1111-4111-8111-111111111101',
      '22222222-2222-4222-8222-222222222202',
      'Woolworths Menlyn Park · Atterbury Rd & Lois Ave, Pretoria',
      ST_SetSRID(ST_MakePoint(28.2765, -25.7867), 4326)::geography,
      180
    ),
    (
      '33333333-3333-4333-8333-333333333303',
      '11111111-1111-4111-8111-111111111102',
      '22222222-2222-4222-8222-222222222203',
      'Nando''s Menlyn Mall · Shop UF21, Cnr Atterbury Rd & Lois Ave',
      ST_SetSRID(ST_MakePoint(28.2772, -25.7869), 4326)::geography,
      120
    ),
    (
      '33333333-3333-4333-8333-333333333304',
      '11111111-1111-4111-8111-111111111102',
      '22222222-2222-4222-8222-222222222204',
      'Nando''s Melrose Arch · Melrose Arch, Johannesburg',
      ST_SetSRID(ST_MakePoint(28.0683, -26.1328), 4326)::geography,
      120
    ),
    (
      '33333333-3333-4333-8333-333333333305',
      '11111111-1111-4111-8111-111111111103',
      '22222222-2222-4222-8222-222222222205',
      'Discovery · 1 Discovery Place, Sandhurst, Sandton, 2196',
      ST_SetSRID(ST_MakePoint(28.0565, -26.1078), 4326)::geography,
      200
    ),
    (
      '33333333-3333-4333-8333-333333333306',
      '11111111-1111-4111-8111-111111111104',
      '22222222-2222-4222-8222-222222222206',
      'MTN Innovation Centre · 216 14th Avenue, Fairland, 2195',
      ST_SetSRID(ST_MakePoint(27.9734, -26.1436), 4326)::geography,
      200
    ),
    (
      '33333333-3333-4333-8333-333333333307',
      '11111111-1111-4111-8111-111111111105',
      '22222222-2222-4222-8222-222222222207',
      'Vodacom World · 082 Vodacom Boulevard, Midrand, 1682',
      ST_SetSRID(ST_MakePoint(28.1284, -25.9965), 4326)::geography,
      200
    ),
    (
      '33333333-3333-4333-8333-333333333308',
      '11111111-1111-4111-8111-111111111106',
      '22222222-2222-4222-8222-222222222208',
      'Cape Union Mart · Shop 257, Level 2, Brooklyn Mall, Bronkhorst St',
      ST_SetSRID(ST_MakePoint(28.2350, -25.7712), 4326)::geography,
      150
    )
  on conflict (id) do update set
    label = excluded.label,
    geog = excluded.geog,
    radius_m = excluded.radius_m;

  insert into rewards (id, org_id, campaign_id, type, label, value, stock) values
    ('44444444-4444-4444-8444-444444444401', '11111111-1111-4111-8111-111111111101', '22222222-2222-4222-8222-222222222201', 'discount', 'DEMO tasting voucher', 'R50 off Foods', 40),
    ('44444444-4444-4444-8444-444444444402', '11111111-1111-4111-8111-111111111101', '22222222-2222-4222-8222-222222222202', 'discount', 'DEMO tasting voucher', 'R50 off Foods', 40),
    ('44444444-4444-4444-8444-444444444403', '11111111-1111-4111-8111-111111111102', '22222222-2222-4222-8222-222222222203', 'discount', 'DEMO PERi snack', 'Free regular side', 30),
    ('44444444-4444-4444-8444-444444444404', '11111111-1111-4111-8111-111111111102', '22222222-2222-4222-8222-222222222204', 'discount', 'DEMO PERi snack', 'Free regular side', 30),
    ('44444444-4444-4444-8444-444444444405', '11111111-1111-4111-8111-111111111103', '22222222-2222-4222-8222-222222222205', 'xp_bonus', 'DEMO campus stamp', '50 Impact', 80),
    ('44444444-4444-4444-8444-444444444406', '11111111-1111-4111-8111-111111111104', '22222222-2222-4222-8222-222222222206', 'xp_bonus', 'DEMO campus stamp', '45 Impact', 80),
    ('44444444-4444-4444-8444-444444444407', '11111111-1111-4111-8111-111111111105', '22222222-2222-4222-8222-222222222207', 'xp_bonus', 'DEMO campus stamp', '45 Impact', 80),
    ('44444444-4444-4444-8444-444444444408', '11111111-1111-4111-8111-111111111106', '22222222-2222-4222-8222-222222222208', 'discount', 'DEMO trail credit', 'R75 off gear', 25)
  on conflict (id) do update set label = excluded.label, value = excluded.value, stock = excluded.stock;
end $$;
