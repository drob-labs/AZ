-- AZ Zeiterfassung: skema fillestare
-- Zbatohet vetëm pasi projekti Supabase (Frankfurt) të krijohet dhe konfirmohet.

create type app_role as enum ('worker', 'admin');
create type shift_source as enum ('app', 'admin');
create type break_kind as enum ('button', 'declared');

create table employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  personnel_no text not null unique,
  first_name text not null,
  last_name text not null,
  role app_role not null default 'worker',
  weekly_hours numeric(5, 2) not null default 40,
  locale text not null default 'sq' check (locale in ('sq', 'de')),
  entry_date date,
  exit_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table employee_rates (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id) on delete cascade,
  valid_from date not null,
  hourly_rate_cents integer not null check (hourly_rate_cents > 0),
  unique (employee_id, valid_from)
);

create table sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  active boolean not null default true
);

create table shifts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique,
  employee_id uuid not null references employees (id),
  site_id uuid references sites (id),
  started_at timestamptz not null,
  ended_at timestamptz,
  device_started_at timestamptz not null,
  device_ended_at timestamptz,
  received_at timestamptz not null default now(),
  start_lat numeric(9, 6),
  start_lng numeric(9, 6),
  start_accuracy_m numeric(8, 2),
  end_lat numeric(9, 6),
  end_lng numeric(9, 6),
  end_accuracy_m numeric(8, 2),
  declared_break_min integer check (declared_break_min between 0 and 240),
  source shift_source not null default 'app',
  flagged boolean not null default false,
  flag_reason text,
  month_closed boolean not null default false,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at > started_at)
);
create index shifts_employee_started_idx on shifts (employee_id, started_at);
-- Një punëtor nuk mund të ketë dy turne të hapura njëkohësisht.
create unique index shifts_one_open_per_employee on shifts (employee_id) where ended_at is null;

create table breaks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique,
  shift_id uuid not null references shifts (id) on delete cascade,
  kind break_kind not null default 'button',
  started_at timestamptz not null,
  ended_at timestamptz,
  check (ended_at is null or ended_at > started_at)
);
create index breaks_shift_idx on breaks (shift_id);

create table month_closings (
  year integer not null,
  month integer not null check (month between 1 and 12),
  closed_by uuid not null references employees (id),
  closed_at timestamptz not null default now(),
  snapshot jsonb not null,
  pdf_path text,
  xlsx_path text,
  primary key (year, month)
);

-- Një rresht i vetëm me cilësimet e kompanisë.
create table settings (
  id boolean primary key default true check (id),
  require_site boolean not null default false,
  capture_location boolean not null default false,
  break_mode text not null default 'ask_at_stop' check (break_mode in ('button', 'ask_at_stop', 'fixed')),
  fixed_break_min integer not null default 30,
  overtime_daily_after_h numeric(4, 2),
  overtime_weekly_after_h numeric(5, 2),
  overtime_surcharge_pct numeric(5, 2) not null default 25,
  min_wage_cents_by_year jsonb not null default '{"2026": 1390, "2027": 1460}',
  reminder_after_h integer not null default 10,
  retention_years integer not null default 2 check (retention_years >= 2)
);
insert into settings default values;

-- Gjurma e ndryshimeve: vetëm shtim, kurrë fshirje.
create table audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id uuid not null,
  action text not null,
  old_row jsonb,
  new_row jsonb,
  changed_by uuid,
  reason text,
  changed_at timestamptz not null default now()
);

create function audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  why text := nullif(current_setting('app.change_reason', true), '');
begin
  insert into audit_log (table_name, row_id, action, old_row, new_row, changed_by, reason)
  values (
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then old.id else new.id end), gen_random_uuid()),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    auth.uid(),
    why
  );
  return coalesce(new, old);
end $$;

create trigger shifts_audit after insert or update or delete on shifts
  for each row execute function audit_row();
create trigger breaks_audit after insert or update or delete on breaks
  for each row execute function audit_row();
create trigger rates_audit after insert or update or delete on employee_rates
  for each row execute function audit_row();

create function audit_block_changes() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log është vetëm për shtim';
end $$;
create trigger audit_no_update before update or delete on audit_log
  for each row execute function audit_block_changes();

-- Ndihmëse për politikat
create function current_employee_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from employees where user_id = auth.uid() and active
$$;

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from employees where user_id = auth.uid() and active and role = 'admin')
$$;

-- Turni i mbyllur në muaj të mbyllur nuk ndryshohet më.
create function block_closed_month() returns trigger
language plpgsql as $$
begin
  if old.month_closed then
    raise exception 'muaji është mbyllur, turni nuk mund të ndryshohet';
  end if;
  return coalesce(new, old);
end $$;
create trigger shifts_closed_guard before update or delete on shifts
  for each row execute function block_closed_month();

-- Korrigjimi nga pronari: arsyeja është e detyrueshme.
create function correct_shift(
  p_shift_id uuid,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_declared_break_min integer,
  p_reason text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'vetëm pronari mund të korrigjojë orët';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'arsyeja e korrigjimit është e detyrueshme';
  end if;
  perform set_config('app.change_reason', p_reason, true);
  update shifts
     set started_at = p_started_at,
         ended_at = p_ended_at,
         declared_break_min = p_declared_break_min,
         source = 'admin'
   where id = p_shift_id;
end $$;

-- RLS
alter table employees enable row level security;
alter table employee_rates enable row level security;
alter table sites enable row level security;
alter table shifts enable row level security;
alter table breaks enable row level security;
alter table month_closings enable row level security;
alter table settings enable row level security;
alter table audit_log enable row level security;

create policy employees_self on employees for select
  using (user_id = auth.uid() or is_admin());
create policy employees_admin_write on employees for all
  using (is_admin()) with check (is_admin());

create policy rates_read on employee_rates for select
  using (employee_id = current_employee_id() or is_admin());
create policy rates_admin_write on employee_rates for all
  using (is_admin()) with check (is_admin());

create policy sites_read on sites for select using (auth.uid() is not null);
create policy sites_admin_write on sites for all
  using (is_admin()) with check (is_admin());

create policy shifts_read on shifts for select
  using (employee_id = current_employee_id() or is_admin());
-- Punëtori shton vetëm turne për veten dhe vetëm nga aplikacioni.
create policy shifts_worker_insert on shifts for insert
  with check (employee_id = current_employee_id() and source = 'app');
-- Punëtori mund vetëm ta mbyllë turnin e vet të hapur (STOP). Korrigjimet i bën pronari.
create policy shifts_worker_stop on shifts for update
  using (employee_id = current_employee_id() and ended_at is null and not month_closed)
  with check (employee_id = current_employee_id());

create policy breaks_read on breaks for select
  using (
    exists (select 1 from shifts s where s.id = shift_id
            and (s.employee_id = current_employee_id() or is_admin()))
  );
create policy breaks_worker_write on breaks for all
  using (exists (select 1 from shifts s where s.id = shift_id
                 and s.employee_id = current_employee_id() and not s.month_closed))
  with check (exists (select 1 from shifts s where s.id = shift_id
                      and s.employee_id = current_employee_id() and not s.month_closed));

create policy closings_admin on month_closings for all
  using (is_admin()) with check (is_admin());
create policy settings_read on settings for select using (auth.uid() is not null);
create policy settings_admin_write on settings for update
  using (is_admin()) with check (is_admin());
create policy audit_admin_read on audit_log for select using (is_admin());
