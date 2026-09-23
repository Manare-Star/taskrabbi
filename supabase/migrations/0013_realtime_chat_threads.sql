-- Let the Messages inbox pick up a newly opened conversation (created by accept_bid)
-- without a manual refresh.
alter publication supabase_realtime add table public.chat_threads;
