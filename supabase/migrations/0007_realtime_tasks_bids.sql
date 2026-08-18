-- Stream task/bid status changes to subscribed clients, so a tasker's screen updates
-- live the moment a client accepts their bid, instead of only refreshing on next fetch.
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.bids;
