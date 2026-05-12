# Migration Status

Run all migrations in order via Supabase Dashboard → SQL Editor.

| # | File | Status | What it adds |
|---|------|--------|--------------|
| 001 | `001_initial_schema.sql` | ✅ Applied | locations, employees, shifts, inventory, chat |
| 002 | `002_roles_to_service_shiftleader_rutin.sql` | ✅ Applied | role model |
| 003 | `003_rls_policies.sql` | ✅ Applied | RLS for core tables |
| 004 | `004_seed_real_data.sql` | ✅ Applied | seed data |
| 005 | `005_sales_alerts_activity.sql` | ✅ Applied | daily_sales, dashboard_alerts, employee_activity |
| 006 | `006_tasks.sql` | ✅ Applied | shift_logs + tasks |
| 007 | `007_auth_roles.sql` | ✅ Applied | user_profiles + auto-create trigger |
| 008 | `008_tasks_created_by.sql` | ✅ Applied | created_by on tasks |
| 009 | `009_auto_delete_completed_tasks.sql` | ✅ Applied | cleanup trigger |
| 010 | `010_authenticated_rls.sql` | ✅ Applied | RLS for authenticated users |
| 011 | `011_user_profiles_rls.sql` | ✅ Applied | RLS for user_profiles |
| 012 | `012_social_feed.sql` | ✅ Applied | social feed tables |
| 013 | `013_user_profiles_email.sql` | ✅ Applied | email on user_profiles |
| 014 | `014_chat_features.sql` | ✅ Applied | pin/edit/soft-delete, channel_members |
| 015 | `015_channel_created_by.sql` | ✅ Applied | channel ownership |
| 016 | `016_shift_checklists.sql` | ✅ Applied | shift leader checklist templates + submissions |
| 017 | `017_multi_location.sql` | ✅ Applied | multi-location branch support |
| 018 | `018_attendance.sql` | ✅ Applied | attendance_sessions (punch in/out) |
| 019 | `019_custom_forms.sql` | ⚠️ **Pending** | custom_forms, custom_form_fields, custom_form_submissions, custom_form_responses |

**019 must be run before the Forms feature works.**
