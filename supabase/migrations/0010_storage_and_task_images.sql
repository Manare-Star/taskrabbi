alter table public.tasks add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('task-images', 'task-images', true)
on conflict (id) do nothing;

-- avatars/{user_id}/... : anyone can view (bucket is public), only the owning user can write
create policy "avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- task-images/{task_id}/... : anyone can view, only the task's client can write
create policy "task images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'task-images');

create policy "task clients can upload their task images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'task-images'
    and exists (
      select 1 from public.tasks t
      where t.id::text = (storage.foldername(name))[1] and t.client_id = auth.uid()
    )
  );

create policy "task clients can update their task images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'task-images'
    and exists (
      select 1 from public.tasks t
      where t.id::text = (storage.foldername(name))[1] and t.client_id = auth.uid()
    )
  );

create policy "task clients can delete their task images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'task-images'
    and exists (
      select 1 from public.tasks t
      where t.id::text = (storage.foldername(name))[1] and t.client_id = auth.uid()
    )
  );
