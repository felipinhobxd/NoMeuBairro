-- Candidaturas novas sempre começam como "interested".
-- O candidato continua podendo desistir e a empresa continua controlando
-- viewed/contacted pelas policies de UPDATE existentes.

drop policy if exists job_applications_owner_insert on public.job_applications;
create policy job_applications_owner_insert
on public.job_applications
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'interested'
  and exists (
    select 1 from public.users u
    where u.id = (select auth.uid())
      and u.account_type = 'resident'::public.account_type
  )
);
