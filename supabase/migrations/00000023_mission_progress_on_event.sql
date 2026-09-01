-- Advance mission_progress when a matching verified interaction event is recorded.

create or replace function public.advance_mission_progress_for_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_step mission_steps%rowtype;
  v_mission missions%rowtype;
  v_progress mission_progress%rowtype;
  v_step_count integer;
  v_next integer;
begin
  if NEW.verification_status is distinct from 'verified' then
    return NEW;
  end if;
  if NEW.campaign_id is null then
    return NEW;
  end if;

  for v_mission in
    select * from missions where campaign_id = NEW.campaign_id
  loop
    select * into v_step
    from mission_steps
    where mission_id = v_mission.id
      and required_event_type = NEW.event_type
    order by sort_order
    limit 1;

    if not found then
      continue;
    end if;

    select * into v_progress
    from mission_progress
    where mission_id = v_mission.id and user_id = NEW.user_id;

    select count(*) into v_step_count from mission_steps where mission_id = v_mission.id;

    if not found then
      -- create progress at this step index
      insert into mission_progress (mission_id, user_id, current_step, completed_at, metadata)
      values (
        v_mission.id,
        NEW.user_id,
        v_step.sort_order + 1,
        case when v_step.sort_order + 1 >= v_step_count then now() else null end,
        jsonb_build_object('last_event', NEW.event_type, 'last_event_id', NEW.id)
      );
    else
      if v_progress.completed_at is not null then
        continue;
      end if;
      -- only advance if this step is the current one (sort_order == current_step)
      if v_step.sort_order = v_progress.current_step then
        v_next := v_progress.current_step + 1;
        update mission_progress
        set current_step = v_next,
            completed_at = case when v_next >= v_step_count then now() else null end,
            metadata = metadata || jsonb_build_object('last_event', NEW.event_type, 'last_event_id', NEW.id)
        where id = v_progress.id;
      end if;
    end if;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_advance_mission_on_interaction on interaction_events;
create trigger trg_advance_mission_on_interaction
  after insert or update of verification_status on interaction_events
  for each row
  execute function public.advance_mission_progress_for_event();
