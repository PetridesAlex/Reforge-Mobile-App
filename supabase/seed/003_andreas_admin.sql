-- Promote Andreas Petrides to owner/admin (run after auth user exists).
-- Prefer: npm run seed:andreas (creates auth user + profile automatically).
--
-- Manual fallback: create user in Supabase → Authentication → Users, then run:

update public.profiles
set
  role = 'admin',
  full_name = 'Andreas Petrides',
  phone = '+35799860056'
where email = 'petrides_andreas@hotmail.com';

-- Verify:
-- select id, email, full_name, role from public.profiles where email = 'petrides_andreas@hotmail.com';
