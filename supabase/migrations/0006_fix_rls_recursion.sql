-- tasks' select policy reads bids (to let a tasker see a task they bid on), and bids'
-- policies read tasks (to let a client see/manage bids on their task) — evaluating either
-- policy triggers the other table's RLS, which triggers the first again, which Postgres
-- reports as "infinite recursion detected in policy for relation tasks". These
-- SECURITY DEFINER helpers run as the function owner, which (as the tables' owner)
-- bypasses RLS entirely, so the cross-table checks no longer re-enter each other's policies.

create or replace function public.is_task_open(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.tasks where id = p_task_id and status = 'open');
$$;

create or replace function public.is_task_client(p_task_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.tasks where id = p_task_id and client_id = p_user_id);
$$;

create or replace function public.has_bid_on_task(p_task_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.bids where task_id = p_task_id and tasker_id = p_user_id);
$$;

grant execute on function public.is_task_open(uuid) to authenticated;
grant execute on function public.is_task_client(uuid, uuid) to authenticated;
grant execute on function public.has_bid_on_task(uuid, uuid) to authenticated;

drop policy if exists "open tasks and own tasks are readable" on public.tasks;
create policy "open tasks and own tasks are readable"
  on public.tasks for select
  to authenticated
  using (
    status = 'open'
    or client_id = auth.uid()
    or public.has_bid_on_task(id, auth.uid())
  );

drop policy if exists "bids readable by the bidder or the task's client" on public.bids;
create policy "bids readable by the bidder or the task's client"
  on public.bids for select
  to authenticated
  using (
    tasker_id = auth.uid()
    or public.is_task_client(task_id, auth.uid())
  );

drop policy if exists "taskers can place bids on open tasks" on public.bids;
create policy "taskers can place bids on open tasks"
  on public.bids for insert
  to authenticated
  with check (
    tasker_id = auth.uid()
    and public.is_task_open(task_id)
  );

drop policy if exists "clients can accept or reject bids on their tasks" on public.bids;
create policy "clients can accept or reject bids on their tasks"
  on public.bids for update
  to authenticated
  using (public.is_task_client(task_id, auth.uid()))
  with check (public.is_task_client(task_id, auth.uid()));
