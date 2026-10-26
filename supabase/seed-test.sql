-- Provo vetëm pasi të krijosh përdoruesit te Authentication → Users:
--   1001@workers.az-innenausbau.de   (PIN 123456)  → punëtor test
--   admin@workers.az-innenausbau.de  (PIN 654321)  → pronar test
insert into employees (user_id, personnel_no, first_name, last_name, role, locale)
select id, '1001', 'Test', 'Punëtor', 'worker', 'sq' from auth.users
 where email = '1001@workers.az-innenausbau.de';

insert into employees (user_id, personnel_no, first_name, last_name, role, locale)
select id, 'admin', 'Test', 'Pronar', 'admin', 'sq' from auth.users
 where email = 'admin@workers.az-innenausbau.de';

insert into employee_rates (employee_id, valid_from, hourly_rate_cents)
select id, '2026-01-01', 1800 from employees where personnel_no = '1001';

select personnel_no, role from employees;
