revoke delete on table public.job_applications from authenticated;
drop policy if exists job_applications_owner_delete on public.job_applications;

drop policy if exists user_resumes_owner_insert on public.user_resumes;
create policy user_resumes_owner_insert
on public.user_resumes
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.users u
    where u.id = (select auth.uid())
      and u.account_type = 'resident'::public.account_type
  )
  and (
    nullif(btrim(coalesce(email, '')), '') is not null
    or nullif(btrim(coalesce(phone, '')), '') is not null
  )
  and (
    nullif(btrim(coalesce(objective, '')), '') is not null
    or nullif(btrim(coalesce(experience, '')), '') is not null
    or nullif(btrim(coalesce(education, '')), '') is not null
    or nullif(btrim(coalesce(skills, '')), '') is not null
  )
);

drop policy if exists user_resumes_owner_update on public.user_resumes;
create policy user_resumes_owner_update
on public.user_resumes
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    nullif(btrim(coalesce(email, '')), '') is not null
    or nullif(btrim(coalesce(phone, '')), '') is not null
  )
  and (
    nullif(btrim(coalesce(objective, '')), '') is not null
    or nullif(btrim(coalesce(experience, '')), '') is not null
    or nullif(btrim(coalesce(education, '')), '') is not null
    or nullif(btrim(coalesce(skills, '')), '') is not null
  )
);

drop policy if exists user_resumes_owner_delete on public.user_resumes;
create policy user_resumes_owner_delete
on public.user_resumes
for delete
to authenticated
using (
  (select auth.uid()) = user_id
  and not exists (
    select 1
    from public.job_applications a
    where a.user_id = user_resumes.user_id
      and a.status <> 'withdrawn'
  )
);

create or replace function public.notify_job_application_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  company_id uuid;
begin
  select jp.company_id
  into company_id
  from public.job_posts jp
  where jp.id = new.job_id;

  if tg_op = 'INSERT' and new.status <> 'withdrawn' then
    if company_id is not null and company_id <> new.user_id then
      insert into public.notifications(user_id, actor_id, type, job_id, application_id)
      values (company_id, new.user_id, 'job_interest', new.job_id, new.id)
      on conflict do nothing;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.status is distinct from new.status and new.status = 'withdrawn' then
      delete from public.notifications
      where application_id = new.id
        and type = 'job_interest';
    elsif old.status = 'withdrawn' and new.status = 'interested' and company_id is not null then
      delete from public.notifications
      where application_id = new.id
        and type = 'job_interest';
      insert into public.notifications(user_id, actor_id, type, job_id, application_id)
      values (company_id, new.user_id, 'job_interest', new.job_id, new.id)
      on conflict do nothing;
    end if;

    if old.status is distinct from new.status and new.status = 'viewed' then
      insert into public.notifications(user_id, actor_id, type, job_id, application_id)
      values (new.user_id, company_id, 'application_viewed', new.job_id, new.id)
      on conflict do nothing;
    elsif old.status is distinct from new.status and new.status = 'contacted' then
      insert into public.notifications(user_id, actor_id, type, job_id, application_id)
      values (new.user_id, company_id, 'application_contacted', new.job_id, new.id)
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.notify_job_application_activity() from public, anon, authenticated;
grant execute on function public.notify_job_application_activity() to service_role;
