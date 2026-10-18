# TaskRabbit Clone (MVP)

A React Native (Expo) marketplace app: clients post tasks, taskers browse and bid, the two
chat once a bid is accepted, and payment happens through Paystack, in Rand, when the task
is done.

Stack: **Expo + TypeScript + Expo Router**, **Supabase** (Postgres/PostGIS, Auth, Realtime,
Edge Functions), **Paystack** for payments.

## 1. Install prerequisites

- **Node.js LTS** (20.x or later) — https://nodejs.org, or via `nvm-windows`
- **Expo Go** app on your phone (iOS App Store / Google Play) — easiest way to run this
  without setting up Xcode/Android Studio
- A free **Supabase** project — https://supabase.com
- A **Paystack** account (South Africa) in **test mode** — https://dashboard.paystack.com
- The **Supabase CLI** (for running migrations and deploying the Edge Functions):
  `npm install -g supabase`

## 2. Install project dependencies

From this folder:

```bash
npm install
npx expo install --fix
```

`expo install --fix` aligns every `expo-*` / React Native package to the exact versions
this Expo SDK expects — run it once after the initial install.

## 3. Set up Supabase

1. Create a new Supabase project.
2. Link the CLI and push the schema in `supabase/migrations/`:
   ```bash
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase db push
   ```
   This creates the `profiles`, `tasks`, `bids`, `chat_threads`, `chat_messages`, and
   `payments` tables, enables PostGIS, sets up Row Level Security, and turns on Realtime
   for chat messages.
3. In the Supabase dashboard under **Project Settings > API**, copy the **Project URL**
   and **anon public** key.

## 4. Set up Paystack (test mode)

The app never holds a Paystack key. Two Edge Functions talk to Paystack: `paystack-initialize`
starts a Rand (ZAR) transaction and returns Paystack's hosted checkout page, which the app
opens in an in-app browser; `paystack-verify` re-checks the transaction with Paystack
(status, currency and exact amount) before marking the task complete.

1. In the Paystack dashboard, make sure you're in **Test mode**, then copy your **Test
   Secret Key** (`sk_test_...`) from **Settings > API Keys & Webhooks**.
2. Give it to Supabase as a function secret — never put it in the app:
   ```bash
   supabase secrets set PAYSTACK_SECRET_KEY=sk_test_your_key
   ```
   (or in the dashboard: **Edge Functions > Secrets**). The name is case-sensitive: it must be
   exactly `PAYSTACK_SECRET_KEY`.
3. Deploy the two Edge Functions:
   ```bash
   supabase functions deploy paystack-initialize
   supabase functions deploy paystack-verify
   ```
   (or in the dashboard: **Edge Functions > Deploy a new function > Via editor**, pasting
   each `supabase/functions/<name>/index.ts`). The editor suggests a random function name at
   the bottom; change it to exactly `paystack-initialize` / `paystack-verify`, and make sure
   each gets its own file (initialize starts "...starts a Paystack payment", verify starts
   "...confirms a Paystack payment").

## 5. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

## 6. Run the app

```bash
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS), or press `i` / `a` to
launch an iOS Simulator / Android emulator if you have one configured.

## 7. Walk the golden path

1. **Sign up** as a client (role: "I need help").
2. **Post a task** — fill in the form and tap "Use my location" to attach your position
   (grant the location permission prompt).
3. **Sign up a second account** (different email, or a second device/simulator) as a
   tasker (role: "I want to work").
4. On the tasker account, go to **Browse**, find the task, open it, and **submit a bid**.
5. Back on the client account, open the task from **My Tasks > Posted by me** and
   **accept the bid** — this opens a chat thread and moves the task to "assigned".
6. Exchange a message or two in **Messages**.
7. As the client, tap **Mark complete & pay** on the task, then **Pay now**, and pay in
   Paystack's checkout with one of the test cards it offers in test mode.
8. Confirm the task now shows **Completed**.

## Notes

- All payments in this app run against **Paystack test mode only**. No real charges are
  ever created — `PAYSTACK_SECRET_KEY` should always be a `sk_test_...` key during
  development.
- Row Level Security is enforced on every table — a tasker cannot read another tasker's
  bid amounts, and chat/payment rows are only visible to the two people involved. You can
  spot-check this from the Supabase SQL editor by running queries as different users
  (`select auth.uid()` under **Authentication > Impersonate**, or by comparing what each
  logged-in account can fetch).
- There's no automated test suite for this MVP — the golden path above is the acceptance
  bar. If you add automated tests later, Detox (E2E) or Jest + React Native Testing
  Library (unit/component) are the standard choices for an Expo Router app.
- The Browse map uses `react-native-maps`, which works in Expo Go as-is. A standalone
  Android build (EAS / dev client) additionally needs a Google Maps API key configured via
  the `react-native-maps` config plugin.
- PostGIS lives in the `extensions` schema (migration 0018). It was originally installed in
  `public`, where its `spatial_ref_sys` table was exposed through the API without RLS, and
  Supabase doesn't allow enabling RLS on it. 0018 reinstalls PostGIS in `extensions`,
  saving and restoring every task's coordinates, and rolls back if any location is lost.
- The RPCs the app calls (`accept_bid`, `submit_rating`, `mark_thread_read`, ...) are
  SECURITY DEFINER and callable by signed-in users on purpose; each checks `auth.uid()`
  itself. The advisor may list them as warnings.
- Supabase free-tier projects pause after a week of inactivity. If the app suddenly can't
  reach the backend (the project URL stops resolving), restore the project from the
  Supabase dashboard.
- Not built yet (left for a follow-up iteration): push notifications for new bids/messages
  (remote push no longer works in Expo Go, so this needs a development build), and a
  Paystack webhook (`charge.success`) as a second, server-triggered path to confirm payments
  (currently confirmation happens when the app calls `paystack-verify` right after checkout,
  so a payment completed while the app is closed is only picked up on the next attempt).
