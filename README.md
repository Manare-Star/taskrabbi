# TaskRabbit Clone (MVP)

A React Native (Expo) marketplace app: clients post tasks, taskers browse and bid, the two
chat once a bid is accepted, and payment happens through Stripe when the task is done.

Stack: **Expo + TypeScript + Expo Router**, **Supabase** (Postgres/PostGIS, Auth, Realtime,
Edge Functions), **Stripe** for payments.

## 1. Install prerequisites

- **Node.js LTS** (20.x or later) — https://nodejs.org, or via `nvm-windows`
- **Expo Go** app on your phone (iOS App Store / Google Play) — easiest way to run this
  without setting up Xcode/Android Studio
- A free **Supabase** project — https://supabase.com
- A free **Stripe** account in **test mode** — https://dashboard.stripe.com
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

## 4. Set up Stripe (test mode)

1. In the Stripe dashboard, make sure you're in **Test mode** (toggle top-right).
2. Copy your **Publishable key** (`pk_test_...`) and **Secret key** (`sk_test_...`) from
   **Developers > API keys**.
3. Give the secret key to Supabase as a function secret — never put it in the app:
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_test_your_key
   ```
4. Deploy the two Edge Functions:
   ```bash
   supabase functions deploy create-payment-intent
   supabase functions deploy confirm-payment
   ```

## 5. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key
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
7. As the client, tap **Mark complete & pay** on the task, then **Pay now** — use the
   Stripe test card `4242 4242 4242 4242`, any future expiry date, any CVC.
8. Confirm the task now shows **Completed**.

## Notes

- All payments in this app run against **Stripe test mode only**. No real charges are
  ever created — `STRIPE_SECRET_KEY` should always be a `sk_test_...` key during
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
- Supabase free-tier projects pause after a week of inactivity. If the app suddenly can't
  reach the backend (the project URL stops resolving), restore the project from the
  Supabase dashboard.
- Not built yet (left for a follow-up iteration): push notifications for new bids/messages
  (remote push no longer works in Expo Go, so this needs a development build), and a Stripe
  webhook as a second, server-triggered path to confirm payments (currently confirmation
  happens when the app calls the `confirm-payment` function right after checkout).
