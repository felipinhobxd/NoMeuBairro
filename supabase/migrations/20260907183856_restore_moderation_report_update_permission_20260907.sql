-- moderate_content_report() is SECURITY INVOKER and intentionally relies on RLS.
-- It must lock/update report rows and, on removal, clear the referenced content id.
-- Browser roles still cannot moderate unless app_roles marks the current user as moderator/admin.
grant update on table public.content_reports to authenticated;
