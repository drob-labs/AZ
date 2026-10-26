-- Mbyllja e muajit: bllokon turnet e muajit dhe ruan fotografinë e raportit.
-- Aplikacioni e llogarit raportin; serveri kontrollon që asgjë nuk ka ndryshuar ndërkohë.

create function close_month(p_year integer, p_month integer, p_snapshot jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  first_day date := make_date(p_year, p_month, 1);
  last_day date := (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date;
  expected integer := (p_snapshot ->> 'shiftCount')::integer;
  actual integer;
  open_count integer;
  me uuid := current_employee_id();
begin
  if not is_admin() then
    raise exception 'vetëm pronari mund ta mbyllë muajin';
  end if;
  if exists (select 1 from month_closings where year = p_year and month = p_month) then
    raise exception 'muaji është mbyllur tashmë';
  end if;

  select count(*), count(*) filter (where ended_at is null)
    into actual, open_count
    from shifts
   where (started_at at time zone 'Europe/Berlin')::date between first_day and last_day;

  if open_count > 0 then
    raise exception 'ka % turne të hapura: mbyllini ose korrigjojini para mbylljes', open_count;
  end if;
  if actual <> expected then
    raise exception 'orët kanë ndryshuar (% në databazë, % në raport): rifreskoje raportin', actual, expected;
  end if;

  perform set_config('app.change_reason', 'month_closed', true);
  update shifts set month_closed = true
   where (started_at at time zone 'Europe/Berlin')::date between first_day and last_day;

  insert into month_closings (year, month, closed_by, snapshot)
  values (p_year, p_month, me, p_snapshot);
end $$;

revoke all on function close_month(integer, integer, jsonb) from public;
grant execute on function close_month(integer, integer, jsonb) to authenticated;

-- Turn që mbërrin pasi muaji është mbyllur (telefon offline): ruhet, por shënohet për pronarin.
create or replace function sync_shift(p jsonb) returns void
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
  started_day date := (started at time zone 'Europe/Berlin')::date;
  clock_ahead boolean := started > now() + interval '5 minutes'
                      or (ended is not null and ended > now() + interval '5 minutes');
  late_after_close boolean := exists (
    select 1 from month_closings
     where year = extract(year from started_day)::integer
       and month = extract(month from started_day)::integer);
  reason text := case
    when late_after_close then 'late_after_month_closing'
    when clock_ahead then 'device_clock_ahead'
  end;
begin
  if emp is null then
    raise exception 'përdoruesi nuk është punëtor aktiv';
  end if;

  select * into existing from shifts where client_id = cid;

  if found then
    if existing.employee_id <> emp then
      raise exception 'turn i huaj';
    end if;
    if existing.ended_at is not null then
      return;
    end if;
    update shifts
       set ended_at = ended,
           device_ended_at = ended,
           declared_break_min = declared,
           flagged = flagged or reason is not null,
           flag_reason = coalesce(reason, flag_reason)
     where id = existing.id;
    sid := existing.id;
  else
    insert into shifts (client_id, employee_id, site_id, started_at, ended_at,
                        device_started_at, device_ended_at, declared_break_min,
                        flagged, flag_reason)
    values (cid, emp, site, started, ended, started, ended, declared,
            reason is not null, reason)
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
