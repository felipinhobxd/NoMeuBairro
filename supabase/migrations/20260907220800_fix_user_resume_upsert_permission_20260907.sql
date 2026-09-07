-- The resume editor uses PostgREST upsert with user_id as the conflict key.
-- PostgreSQL requires UPDATE privilege for every column included in the
-- ON CONFLICT update list, including user_id, even when that value is unchanged.
-- RLS still restricts UPDATE to the row owned by auth.uid() and its WITH CHECK
-- prevents moving the resume to a different user_id.

grant update (user_id) on table public.user_resumes to authenticated;
