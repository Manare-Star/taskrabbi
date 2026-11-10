# Siza

Siza (isiZulu/isiXhosa for "help") is a marketplace app for South Africa: clients post
tasks, taskers browse and bid, the two chat once a bid is accepted, and payment happens
through Paystack, in Rand, when the work is done.

Stack: **Expo (React Native) + TypeScript + Expo Router**, **Supabase** (Postgres/PostGIS,
Auth, Realtime, Storage, Edge Functions), **Paystack** for payments.

Getting ready to publish? See [docs/RELEASE.md](docs/RELEASE.md).

## What's in the app

- **Accounts:** sign up, log in, email confirmation and password reset by emailed code,
  change password, edit profile, delete account.
- **Tasks:** post with a photo, budget, timing and location; browse nearby as a list or on
  a map; search and filter by category.
- **Bids:** taskers bid, withdraw and re-bid; the client hires one, which opens a chat.
- **Jobs:** the tasker marks the job done, the client pays in the app, both leave a review.
  Either side can cancel before payment.
- **Chat and activity:** realtime messages with unread badges, and an activity feed.
- **Safety:** report a person or task, block people, in-app Terms and Privacy Policy.

## Run it

Prerequisites: Node.js 20 or later, the Expo Go app on your phone, a Supabase project and a
Paystack account in test mode.

```bash
npm install
cp .env.example .env    # then fill in your Supabase URL and anon key
npx expo start          # add --tunnel if your phone can't reach your computer
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

## Set up Supabase

1. **Schema.** Run each file in `supabase/migrations/` in order in the SQL Editor (or
   `supabase db push` with the CLI). Each file is safe to run as a single script.
2. **Paystack secret.** In **Edge Functions > Secrets**, add `PAYSTACK_SECRET_KEY` with your
   Paystack **secret** key (`sk_test_...` while testing). The name is case-sensitive. Never
   put this key in the app or in git.
3. **Edge Functions.** Deploy the three functions in `supabase/functions/`:
   `paystack-initialize`, `paystack-verify` and `paystack-webhook`. In the dashboard editor,
   change the suggested random name to the exact folder name. Turn **Enforce JWT
   verification** off for `paystack-webhook` only (Paystack can't send a Supabase token; the
   function checks Paystack's signature instead).
4. **Paystack webhook.** In Paystack under **Settings > API Keys & Webhooks**, set the
   webhook URL to `https://YOUR-PROJECT-REF.supabase.co/functions/v1/paystack-webhook`.
5. **Email codes.** Password reset and email confirmation use a code typed into the app, so
   the emails must contain it. In **Authentication > Emails**, edit the **Reset Password**
   and **Confirm signup** templates to include `{{ .Token }}`, for example:
   `Your Siza code is {{ .Token }}`.

## How it's protected

The app only ever holds Supabase's public (anon) key, so everything below is enforced in
the database, not in the app.

- **Row Level Security** on every table decides which rows a user can read or write.
- **Guard triggers** (migration 0019) decide which *changes* a user can make directly. A
  task is assigned only by `accept_bid()` and completed only by a verified payment; a bid's
  amount belongs to the tasker and its acceptance to the client; ratings are computed.
- **Private locations** (migration 0021). A task's street address and exact coordinates are
  unreadable through the API. Everyone sees the suburb and a position snapped to a ~500 m
  grid; `task_private_details()` gives the real address to the client and the hired tasker.
  A new column on `tasks` must be added to the `GRANT SELECT (...)` in that migration's
  style before the app can read it, and the app must select `TASK_COLUMNS`, never `*`.
- **Payments** are confirmed two ways, whichever happens first: the app calls
  `paystack-verify` when checkout returns, and Paystack calls `paystack-webhook`. Both
  re-check the transaction with Paystack (status, ZAR, exact amount).
- **Blocking** stops bids and messages in both directions and hides each person's tasks
  from the other. **Reports** land in the `reports` table for the operator to review.

## Checks

```bash
npm run check        # everything below
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm test             # unit tests (Jest): validation, formatting, errors, contrast
npm run test:db      # database tests: replays every migration on PGlite (Postgres in
                     # WASM, with PostGIS) and exercises the policies as different users
```

The same checks, plus an Android and iOS bundle, run on every push (`.github/workflows`).

`tests/db/harness.mjs` stubs Supabase's roles, `auth.uid()` and storage schema, so a new
migration can be proven locally before it's run against the real project.

## Project layout

```
app/                 screens (Expo Router): (auth), (tabs), task, chat, checkout, settings
components/          shared UI; components/task for the task screen's pieces
lib/                 theme, validation, formatting, auth context, toasts
lib/queries/         every Supabase read and write, as React Query hooks
supabase/migrations  the database, in order
supabase/functions   Paystack Edge Functions (Deno)
tests/unit, tests/db unit and database tests
scripts/             generate-icons.mjs draws the app icon set into assets/
```

## Notes

- **Moderating reports.** Review new rows in **Table Editor > reports** and set `status`.
  The app stores expect reports to be acted on promptly (Apple: within 24 hours).
- **Push notifications** aren't built: remote push doesn't work in Expo Go and needs a
  development build. The in-app activity feed and badges are realtime.
- **Payouts to taskers** aren't built: payments land in the platform's Paystack balance.
- **Supabase free tier** pauses a project after a week without activity.
- **Android maps** in a standalone build need a Google Maps API key (see docs/RELEASE.md).
