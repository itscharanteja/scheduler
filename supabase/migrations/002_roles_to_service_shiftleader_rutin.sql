
-- Run this only if you already applied 001 with the old roles (grill, counter, manager, cashier, cleaner).
-- Drops the old role check and adds the new one; maps existing data to the new roles.

alter table public.employees drop constraint if exists employees_role_check;

update public.employees set role = 'service' where role in ('grill', 'counter', 'cashier');
update public.employees set role = 'shiftleader' where role = 'manager';
update public.employees set role = 'rutin' where role = 'cleaner';

alter table public.employees add constraint employees_role_check
  check (role in ('service', 'shiftleader', 'rutin'));
