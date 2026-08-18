-- Stream new chat messages to subscribed clients in real time.
alter publication supabase_realtime add table public.chat_messages;
