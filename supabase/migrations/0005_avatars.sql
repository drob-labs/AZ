-- Fotoja e profilit. Plani falas i Supabase ka kufi egress, prandaj:
--  * foto 256x256 JPEG (~20 KB), bucket-i refuzon çdo skedar mbi 100 KB;
--  * emër i ri skedari për çdo ngarkim + Cache-Control 1 vit, pra shfletuesi e shkarkon vetëm një herë;
--  * fotot shfaqen vetëm te header-i dhe profili, jo te listat.

alter table employees add column avatar_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 102400, array['image/jpeg'])
on conflict (id) do update
  set public = true, file_size_limit = 102400, allowed_mime_types = array['image/jpeg'];

-- Çdokush ngarkon/fshin vetëm brenda folderit të vet (emri i parë = employee id).
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = current_employee_id()::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = current_employee_id()::text);

-- Punëtori nuk shkruan te employees drejtpërdrejt, prandaj ndryshimi kalon nga kjo funksion.
create function set_avatar(p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := current_employee_id();
begin
  if me is null then
    raise exception 'pa qasje';
  end if;
  if p_path is not null and p_path not like me::text || '/%.jpg' then
    raise exception 'rruga e fotos nuk është e vlefshme';
  end if;
  update employees set avatar_path = p_path where id = me;
end $$;
revoke all on function set_avatar(text) from public, anon;
grant execute on function set_avatar(text) to authenticated;
