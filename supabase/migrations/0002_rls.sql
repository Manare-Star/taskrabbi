alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.bids enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.payments enable row level security;

-- profiles: public read (browsing tasker profiles/ratings), write only your own row
create policy "profiles are readable by any authenticated user"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users can create their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- tasks: open tasks are publicly browsable; the client and any tasker who bid can also see theirs
create policy "open tasks and own tasks are readable"
  on public.tasks for select
  to authenticated
  using (
    status = 'open'
    or client_id = auth.uid()
    or exists (select 1 from public.bids b where b.task_id = tasks.id and b.tasker_id = auth.uid())
  );

create policy "clients can create tasks"
  on public.tasks for insert
  to authenticated
  with check (client_id = auth.uid());

create policy "clients can update their own tasks"
  on public.tasks for update
  to authenticated
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

create policy "clients can delete their own open tasks"
  on public.tasks for delete
  to authenticated
  using (client_id = auth.uid() and status = 'open');

-- bids: a tasker sees their own bids, a client sees bids on their own tasks
create policy "bids readable by the bidder or the task's client"
  on public.bids for select
  to authenticated
  using (
    tasker_id = auth.uid()
    or exists (select 1 from public.tasks t where t.id = bids.task_id and t.client_id = auth.uid())
  );

create policy "taskers can place bids on open tasks"
  on public.bids for insert
  to authenticated
  with check (
    tasker_id = auth.uid()
    and exists (select 1 from public.tasks t where t.id = bids.task_id and t.status = 'open')
  );

create policy "taskers can update their own pending bids"
  on public.bids for update
  to authenticated
  using (tasker_id = auth.uid() and status = 'pending')
  with check (tasker_id = auth.uid());

create policy "clients can accept or reject bids on their tasks"
  on public.bids for update
  to authenticated
  using (exists (select 1 from public.tasks t where t.id = bids.task_id and t.client_id = auth.uid()))
  with check (exists (select 1 from public.tasks t where t.id = bids.task_id and t.client_id = auth.uid()));

-- chat: only the two participants on a task can see/create their thread and messages
create policy "participants can read their chat threads"
  on public.chat_threads for select
  to authenticated
  using (client_id = auth.uid() or tasker_id = auth.uid());

create policy "participants can create their chat thread"
  on public.chat_threads for insert
  to authenticated
  with check (client_id = auth.uid() or tasker_id = auth.uid());

create policy "participants can read messages in their threads"
  on public.chat_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.chat_threads th
      where th.id = chat_messages.thread_id
        and (th.client_id = auth.uid() or th.tasker_id = auth.uid())
    )
  );

create policy "participants can send messages in their threads"
  on public.chat_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.chat_threads th
      where th.id = chat_messages.thread_id
        and (th.client_id = auth.uid() or th.tasker_id = auth.uid())
    )
  );

-- payments: readable by the task's client or the accepted tasker; writes only via the
-- service-role key from the create-payment-intent Edge Function, so no insert/update policy here
create policy "task participants can read payment status"
  on public.payments for select
  to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = payments.task_id
        and (
          t.client_id = auth.uid()
          or exists (
            select 1 from public.bids b
            where b.task_id = t.id and b.tasker_id = auth.uid() and b.status = 'accepted'
          )
        )
    )
  );
