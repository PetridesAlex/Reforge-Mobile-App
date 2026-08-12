# Supabase setup for REFORGE

1. Create a project at https://supabase.com
2. Open **SQL Editor** and run migrations in order:
   - [`migrations/001_initial_schema.sql`](migrations/001_initial_schema.sql)
   - [`migrations/002_classes_chat_attendance.sql`](migrations/002_classes_chat_attendance.sql)
   - [`migrations/004_role_guard.sql`](migrations/004_role_guard.sql)
   - [`migrations/005_studio_content.sql`](migrations/005_studio_content.sql) — **required for admin → member sync**
   - [`migrations/006_member_fitness.sql`](migrations/006_member_fitness.sql) — **member stats, goals & progress tracking**
   - [`migrations/007_memberships.sql`](migrations/007_memberships.sql) — **billing, payment history & auto membership rows**
   - [`migrations/008_profile_gender.sql`](migrations/008_profile_gender.sql) — **optional gender on profiles for roster filters**
3. In **Authentication → Providers**, enable **Email** and **Google**
4. In **Authentication → URL configuration**:
   - **Site URL:** `reforge://auth/callback` (not `http://localhost:3000`)
   - **Redirect URLs** — add all of these:
     - `reforge://**`
     - `reforge://auth/callback`
     - `reforge://reset-password`
     - `exp://**` (required while testing in **Expo Go**)
     - `http://localhost:8081/auth/callback` (Expo web dev only)
     - `http://localhost:8081/**` (Expo web dev only)
5. Copy Project URL and API key into a root `.env` file (see `.env.example`):

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
# Either key format works — use one:
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
EXPO_PUBLIC_USE_MOCK_AUTH=false
```

6. Restart Expo (`npx expo start -c`)

### Email confirmation (sign up)

If the confirm link opens **localhost** or the account never activates:

1. Fix **Site URL** and **Redirect URLs** in Supabase (step 4 above) — remove `http://localhost:3000`
2. Restart Expo after changing auth settings
3. Register again (or resend confirmation from Supabase Dashboard → Authentication → Users)
4. Open the email link **on the same phone** where REFORGE / Expo Go is installed

While developing in Expo Go, links use `exp://…/--/auth/callback`. In a production build they use `reforge://auth/callback`.

**Optional for testing only:** disable **Confirm email** under Authentication → Providers → Email to skip confirmation during development.

### Create Andreas (owner/admin)

Add to `.env` (service role key is **secret** — never commit it):

```
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Project Settings → API → service_role
SEED_ANDREAS_PASSWORD=choose-a-strong-password
```

Then run:

```bash
npm run seed:andreas
```

This creates `petrides_andreas@hotmail.com` with role `admin`. Andreas signs in on the normal login screen and lands in the coach/owner app.

Manual fallback: create the user in **Authentication → Users**, then run [`seed/003_andreas_admin.sql`](seed/003_andreas_admin.sql).

### Roles

| Role | Who | How |
|------|-----|-------|
| `admin` | Andreas (owner) | Created via `npm run seed:andreas` |
| `member` | Everyone else | Default on app registration |

Run [`migrations/004_role_guard.sql`](migrations/004_role_guard.sql) in the SQL Editor so new signups are always `member` and users cannot promote themselves to admin.

### Admin → member sync

When Supabase is configured (`EXPO_PUBLIC_USE_MOCK_AUTH=false`), studio content is stored in the database — not in-memory mock data:

| Admin action | Member sees |
|--------------|-------------|
| Publish **Studio news** | Home → Studio news + notification banner |
| Publish **Workout of the day** | Home → WOD card |
| Create/edit **Group classes** | Bookings → Classes tab |

Changes appear when the member opens or returns to those screens, and **update live** via Supabase Realtime while the app is open.

Until keys are set, the app uses mock auth and mock data (`EXPO_PUBLIC_USE_MOCK_AUTH=true`).

### Google Sign-In

1. **Supabase** → Authentication → Providers → **Google** → Enable (Client ID + Secret from Google Cloud)
2. **Google Cloud Console** → OAuth client → Authorized redirect URI:
   - `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
3. Installed app uses `reforge://auth/callback`; Expo web dev uses `http://localhost:8081/auth/callback`
4. New Google users get role `member` automatically (migration `004_role_guard.sql`)

### Go live (App Store / Play Store)

1. Run all migrations (step 2) on production Supabase
2. Set **EAS secrets** (see `.env.example` comments):
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxxx.supabase.co"
   eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "sb_publishable_..."
   ```
3. `eas.json` production profile uses `EXPO_PUBLIC_USE_MOCK_AUTH=false`
4. **Dev build** (test Google on device): `npm run build:ios:dev`
5. **TestFlight**: `npm run build:ios:testflight`
6. **Android**: `npm run build:android` then `npx eas-cli submit --platform android --latest`
7. Register test devices: `npm run device:register` (for internal preview builds)

Demo build without Supabase: `eas build --profile preview-mock`

### Admin invites (real email)

When Supabase auth is enabled, **Invite member / Invite coach** in the app sends a real Supabase invite email. Follow these steps once:

#### Step 1 — Configure email (SMTP)

Supabase’s built-in mail is rate-limited and often lands in spam. Use a real provider:

1. Sign up at [Resend](https://resend.com) (or SendGrid, etc.)
2. Add and verify your sending domain (or use Resend’s test domain while developing)
3. In Supabase → **Project Settings → Authentication → SMTP Settings**:
   - Enable **Custom SMTP**
   - Host: `smtp.resend.com`, Port: `465`, Username: `resend`, Password: your Resend API key
   - Sender email: e.g. `REFORGE <hello@yourdomain.com>`
4. **Authentication → Email Templates → Invite user** — customize subject/body (optional)
5. **Authentication → URL configuration** — add redirect URL:
   - `reforge://reset-password`

The invited person opens the link, sets a password, and signs in to the member app.

#### Step 2 — Deploy the invite Edge Function

The app cannot use the service role key directly (it would be exposed). Invites go through a Supabase Edge Function.

```bash
# One-time: install Supabase CLI
brew install supabase/tap/supabase

# Log in and link your project (from repo root)
supabase login
supabase link --project-ref YOUR_PROJECT_REF   # ref is in the Supabase dashboard URL

# Deploy
npm run supabase:deploy-invite
```

`YOUR_PROJECT_REF` is the short id in `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`.

#### Step 3 — Test from the app

1. Sign in as Andreas (admin)
2. Go to **Members** or **Staff** → **Invite**
3. Enter name + email → **Send invite**
4. The invitee checks email (and spam), opens the link, sets a password

#### CLI fallback (without opening the app)

If the Edge Function is not deployed yet, you can still send invites from your machine:

```bash
npm run invite:user -- member friend@example.com "Maria Papadopoulou"
npm run invite:user -- coach coach@example.com "Coach Name" --phone +35799123456
```

Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env` and SMTP configured in Supabase.

#### Troubleshooting

| Problem | Fix |
|---------|-----|
| “Invite failed” / function not found | Run `npm run supabase:deploy-invite` |
| No email arrives | Check SMTP settings; check spam; Resend dashboard → Logs |
| Link doesn’t open the app | Add `reforge://reset-password` under Auth → URL configuration |
| “Only admins can invite” | Sign in as Andreas; profile role must be `admin` |
| “Account already exists” | User already registered — use **Forgot password** instead |

### Demo mock accounts

| Email | Password | Role |
|-------|----------|------|
| member@reforge.cy | password123 | member |
| coach@reforge.cy | password123 | coach |
| admin@reforge.cy | password123 | admin |
