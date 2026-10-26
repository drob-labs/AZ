-- Sinkronizimi nga aplikacioni: telefoni dërgon fotografinë e turnit (me pauzat),
-- dhe funksioni e shton ose e përditëson në mënyrë idempotente sipas client_id.
-- Dërgimi i së njëjtës fotografi disa herë nuk krijon dublikata.

create function sync_shift(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  emp uuid := current_employee_id();
  cid uuid := (p ->> 'clientId')::uuid;
  started timestamptz := (p ->> 'startedAt')::timestamptz;
  ended timestamptz := nullif(p ->> 'endedAt', '')::timestamptz;
  declared integer := nullif(p ->> 'declaredBreakMin', '')::integer;
  site uuid := nullif(p ->> 'siteId', '')::uuid;
  existing shifts%rowtype;
  sid uuid;
  b jsonb;
  clock_ahead boolean := started > now() + interval '5 minutes'
                      or (ended is not null and ended > now() + interval '5 minutes');
begin
  if emp is null then
    raise exception 'përdoruesi nuk është punëtor aktiv';
  end if;

  select * into existing from shifts where client_id = cid;

  if found then
    if existing.employee_id <> emp then
      raise exception 'turn i huaj';
    end if;
    -- Turni i mbyllur nuk ndryshohet nga aplikacioni; korrigjimet i bën pronari.
    if existing.ended_at is not null then
      return;
    end if;
    update shifts
       set ended_at = ended,
           device_ended_at = ended,
           declared_break_min = declared,
           flagged = flagged or clock_ahead,
           flag_reason = case when clock_ahead then 'device_clock_ahead' else flag_reason end
     where id = existing.id;
    sid := existing.id;
  else
    insert into shifts (client_id, employee_id, site_id, started_at, ended_at,
                        device_started_at, device_ended_at, declared_break_min,
                        flagged, flag_reason)
    values (cid, emp, site, started, ended, started, ended, declared,
            clock_ahead, case when clock_ahead then 'device_clock_ahead' end)
    returning id into sid;
  end if;

  for b in select * from jsonb_array_elements(coalesce(p -> 'breaks', '[]'::jsonb)) loop
    insert into breaks (client_id, shift_id, kind, started_at, ended_at)
    values ((b ->> 'clientId')::uuid, sid, 'button',
            (b ->> 'startedAt')::timestamptz, nullif(b ->> 'endedAt', '')::timestamptz)
    on conflict (client_id) do update
      set ended_at = excluded.ended_at
      where breaks.ended_at is null and breaks.shift_id = sid;
  end loop;
end $$;

revoke all on function sync_shift(jsonb) from public;
grant execute on function sync_shift(jsonb) to authenticated;
