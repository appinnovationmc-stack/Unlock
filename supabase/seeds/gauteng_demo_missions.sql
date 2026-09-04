-- Run AFTER gauteng_demo_field.sql
-- Adds a real visit mission + steps + experience config per demo campaign.
-- Still DEMO. Not an official brand partnership.

do $$
begin
  insert into experience_configs (id, campaign_id, organisation_id, primary_type, verification_required, map_visible, reward_preview)
  values
    ('55555555-5555-4555-8555-555555555501', '22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111101', 'VISIT', '{location,authenticated_session}', true, '{"label":"R50 Foods tasting"}'::jsonb),
    ('55555555-5555-4555-8555-555555555502', '22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111101', 'VISIT', '{location,authenticated_session}', true, '{"label":"R50 Foods tasting"}'::jsonb),
    ('55555555-5555-4555-8555-555555555503', '22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111102', 'VISIT', '{location,authenticated_session}', true, '{"label":"PERi side"}'::jsonb),
    ('55555555-5555-4555-8555-555555555504', '22222222-2222-4222-8222-222222222204', '11111111-1111-4111-8111-111111111102', 'VISIT', '{location,authenticated_session}', true, '{"label":"PERi side"}'::jsonb),
    ('55555555-5555-4555-8555-555555555505', '22222222-2222-4222-8222-222222222205', '11111111-1111-4111-8111-111111111103', 'VISIT', '{location,authenticated_session}', true, '{"label":"Campus stamp"}'::jsonb),
    ('55555555-5555-4555-8555-555555555506', '22222222-2222-4222-8222-222222222206', '11111111-1111-4111-8111-111111111104', 'VISIT', '{location,authenticated_session}', true, '{"label":"Campus stamp"}'::jsonb),
    ('55555555-5555-4555-8555-555555555507', '22222222-2222-4222-8222-222222222207', '11111111-1111-4111-8111-111111111105', 'VISIT', '{location,authenticated_session}', true, '{"label":"Campus stamp"}'::jsonb),
    ('55555555-5555-4555-8555-555555555508', '22222222-2222-4222-8222-222222222208', '11111111-1111-4111-8111-111111111106', 'VISIT', '{location,authenticated_session}', true, '{"label":"R75 gear"}'::jsonb)
  on conflict (campaign_id) do update set
    primary_type = excluded.primary_type,
    verification_required = excluded.verification_required,
    reward_preview = excluded.reward_preview;

  insert into missions (id, campaign_id, organisation_id, title, description, experience_type, sort_order, is_required) values
    ('66666666-6666-4666-8666-666666666601', '22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111101', 'Arrive at Sandton City Foods', 'Walk to Woolworths Sandton City. Get inside the radius. Hold.', 'VISIT', 0, true),
    ('66666666-6666-4666-8666-666666666602', '22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111101', 'Arrive at Menlyn Park Foods', 'Walk to Woolworths Menlyn. Get inside the radius. Hold.', 'VISIT', 0, true),
    ('66666666-6666-4666-8666-666666666603', '22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111102', 'Arrive at Nando''s Menlyn', 'Walk to shop UF21. Get close to the counter. Hold.', 'VISIT', 0, true),
    ('66666666-6666-4666-8666-666666666604', '22222222-2222-4222-8222-222222222204', '11111111-1111-4111-8111-111111111102', 'Arrive at Nando''s Melrose Arch', 'Walk into Melrose Arch. Get inside the radius. Hold.', 'VISIT', 0, true),
    ('66666666-6666-4666-8666-666666666605', '22222222-2222-4222-8222-222222222205', '11111111-1111-4111-8111-111111111103', 'Walk 1 Discovery Place', 'Arrive at the Sandhurst campus. Hold at the pin.', 'VISIT', 0, true),
    ('66666666-6666-4666-8666-666666666606', '22222222-2222-4222-8222-222222222206', '11111111-1111-4111-8111-111111111104', 'Walk the Fairland campus', 'Arrive at 216 14th Avenue. Hold at the pin.', 'VISIT', 0, true),
    ('66666666-6666-4666-8666-666666666607', '22222222-2222-4222-8222-222222222207', '11111111-1111-4111-8111-111111111105', 'Walk Vodacom World', 'Arrive at 082 Vodacom Boulevard. Hold at the pin.', 'VISIT', 0, true),
    ('66666666-6666-4666-8666-666666666608', '22222222-2222-4222-8222-222222222208', '11111111-1111-4111-8111-111111111106', 'Arrive Brooklyn Level 2', 'Walk to Cape Union Mart, shop 257. Hold at the pin.', 'VISIT', 0, true)
  on conflict (id) do update set title = excluded.title, description = excluded.description;

  insert into mission_steps (id, mission_id, title, description, required_event_type, verification_methods, sort_order) values
    ('77777777-7777-4777-8777-777777777701', '66666666-6666-4666-8666-666666666601', 'Get close', 'Stand inside 180 m of the Foods hall.', 'LOCATION_CHECKIN', '{location}', 0),
    ('77777777-7777-4777-8777-777777777702', '66666666-6666-4666-8666-666666666601', 'Hold', 'Hold on the experience to unlock the tasting voucher.', 'REWARD_UNLOCK', '{authenticated_session,location}', 1),
    ('77777777-7777-4777-8777-777777777711', '66666666-6666-4666-8666-666666666602', 'Get close', 'Stand inside 180 m of Menlyn Foods.', 'LOCATION_CHECKIN', '{location}', 0),
    ('77777777-7777-4777-8777-777777777712', '66666666-6666-4666-8666-666666666602', 'Hold', 'Hold to unlock the tasting voucher.', 'REWARD_UNLOCK', '{authenticated_session,location}', 1),
    ('77777777-7777-4777-8777-777777777721', '66666666-6666-4666-8666-666666666603', 'Get close', 'Stand inside 120 m of UF21.', 'LOCATION_CHECKIN', '{location}', 0),
    ('77777777-7777-4777-8777-777777777722', '66666666-6666-4666-8666-666666666603', 'Hold', 'Hold at the counter to unlock the side.', 'REWARD_UNLOCK', '{authenticated_session,location}', 1),
    ('77777777-7777-4777-8777-777777777731', '66666666-6666-4666-8666-666666666604', 'Get close', 'Stand inside 120 m of Melrose Arch.', 'LOCATION_CHECKIN', '{location}', 0),
    ('77777777-7777-4777-8777-777777777732', '66666666-6666-4666-8666-666666666604', 'Hold', 'Hold to unlock the side.', 'REWARD_UNLOCK', '{authenticated_session,location}', 1),
    ('77777777-7777-4777-8777-777777777741', '66666666-6666-4666-8666-666666666605', 'Get close', 'Stand inside 200 m of 1 Discovery Place.', 'LOCATION_CHECKIN', '{location}', 0),
    ('77777777-7777-4777-8777-777777777742', '66666666-6666-4666-8666-666666666605', 'Hold', 'Hold for the campus stamp.', 'REWARD_UNLOCK', '{authenticated_session,location}', 1),
    ('77777777-7777-4777-8777-777777777751', '66666666-6666-4666-8666-666666666606', 'Get close', 'Stand inside 200 m of the Innovation Centre.', 'LOCATION_CHECKIN', '{location}', 0),
    ('77777777-7777-4777-8777-777777777752', '66666666-6666-4666-8666-666666666606', 'Hold', 'Hold for the campus stamp.', 'REWARD_UNLOCK', '{authenticated_session,location}', 1),
    ('77777777-7777-4777-8777-777777777761', '66666666-6666-4666-8666-666666666607', 'Get close', 'Stand inside 200 m of Vodacom World.', 'LOCATION_CHECKIN', '{location}', 0),
    ('77777777-7777-4777-8777-777777777762', '66666666-6666-4666-8666-666666666607', 'Hold', 'Hold for the campus stamp.', 'REWARD_UNLOCK', '{authenticated_session,location}', 1),
    ('77777777-7777-4777-8777-777777777771', '66666666-6666-4666-8666-666666666608', 'Get close', 'Stand inside 150 m of shop 257.', 'LOCATION_CHECKIN', '{location}', 0),
    ('77777777-7777-4777-8777-777777777772', '66666666-6666-4666-8666-666666666608', 'Hold', 'Hold for the trail credit.', 'REWARD_UNLOCK', '{authenticated_session,location}', 1)
  on conflict (id) do update set title = excluded.title, description = excluded.description;
end $$;
