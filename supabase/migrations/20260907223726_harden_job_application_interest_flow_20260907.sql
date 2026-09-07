drop policy if exists job_applications_owner_insert on public.job_applications;
create policy job_applications_owner_insert
on public.job_applications
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'interested'
  and exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.account_type = 'resident'::public.account_type
  )
  and exists (
    select 1
    from public.user_resumes r
    where r.user_id = (select auth.uid())
      and (
        nullif(btrim(coalesce(r.email, '')), '') is not null
        or nullif(btrim(coalesce(r.phone, '')), '') is not null
      )
      and (
        nullif(btrim(coalesce(r.objective, '')), '') is not null
        or nullif(btrim(coalesce(r.experience, '')), '') is not null
        or nullif(btrim(coalesce(r.education, '')), '') is not null
        or nullif(btrim(coalesce(r.skills, '')), '') is not null
      )
  )
  and exists (
    select 1
    from public.public_job_posts p
    where p.id = job_id
      and p.is_active = true
      and (p.expires_at is null or p.expires_at >= ((now() at time zone 'America/Sao_Paulo')::date))
  )
);

drop policy if exists job_applications_update_allowed on public.job_applications;
create policy job_applications_update_allowed
on public.job_applications
for update
to authenticated
using (
  (select auth.uid()) = user_id
  or (
    status <> 'withdrawn'
    and exists (
      select 1
      from public.job_posts j
      where j.id = job_applications.job_id
        and j.company_id = (select auth.uid())
    )
  )
)
with check (
  (
    (select auth.uid()) = user_id
    and (
      status = 'withdrawn'
      or (
        status = 'interested'
        and exists (
          select 1
          from public.user_resumes r
          where r.user_id = (select auth.uid())
            and (
              nullif(btrim(coalesce(r.email, '')), '') is not null
              or nullif(btrim(coalesce(r.phone, '')), '') is not null
            )
            and (
              nullif(btrim(coalesce(r.objective, '')), '') is not null
              or nullif(btrim(coalesce(r.experience, '')), '') is not null
              or nullif(btrim(coalesce(r.education, '')), '') is not null
              or nullif(btrim(coalesce(r.skills, '')), '') is not null
            )
        )
        and exists (
          select 1
          from public.public_job_posts p
          where p.id = job_id
            and p.is_active = true
            and (p.expires_at is null or p.expires_at >= ((now() at time zone 'America/Sao_Paulo')::date))
        )
      )
    )
  )
  or (
    exists (
      select 1
      from public.job_posts j
      where j.id = job_applications.job_id
        and j.company_id = (select auth.uid())
    )
    and status = any (array['interested'::text, 'viewed'::text, 'contacted'::text])
  )
);
