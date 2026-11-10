# Releasing Siza

What has to be true before Siza goes into the App Store and Google Play, and how to build
and submit it. Items marked **(you)** need a decision, an account or a document that can't
come from the codebase.

## 1. Before real users

### Decisions and documents (you)

- [ ] **Support email.** Set `EXPO_PUBLIC_SUPPORT_EMAIL` to a real, monitored inbox. It's
      shown in the app and in the legal pages. The default `support@example.com` must not ship.
- [ ] **Operator name.** Set `EXPO_PUBLIC_OPERATOR_NAME` to the legal entity running Siza.
- [ ] **Legal review.** The Terms and Privacy Policy in `lib/legal.ts` describe what the
      app does and are written for South African law (POPIA, the CPA), but they are a
      starting point. Have an attorney review them.
- [ ] **Public URLs for the legal pages.** Both stores ask for a privacy policy URL, and
      Apple for a support URL. Publish the same text as in the app on a website.
- [ ] **Trademark.** Check "Siza" with CIPC before investing in the name.
- [ ] **Information Officer.** POPIA requires registering one with the Information Regulator.

### Backend

- [ ] **Supabase Pro.** Free projects pause after a week of inactivity.
- [ ] **Turn email confirmation on** (Authentication > Sign In / Providers > Email). It was
      turned off during development. The app already handles the confirmation code.
- [ ] **Custom SMTP** (Authentication > Emails > SMTP). Supabase's built-in sender is
      limited to a few emails an hour and is for testing only.
- [ ] **Email templates** contain `{{ .Token }}` (see README, "Email codes").
- [ ] **Paystack live mode:** business verification, then set `PAYSTACK_SECRET_KEY` to the
      `sk_live_` key and point the **live** webhook URL at `paystack-webhook`.
- [ ] **Payouts to taskers.** Not built. Paystack subaccounts (split payments) is the
      intended route. Until then, payouts are manual.
- [ ] **Run the Security Advisor** in Supabase and clear anything new.
- [ ] **Backups.** Confirm daily backups are on (Pro), and try a restore once.

### Operations

- [ ] Someone checks the `reports` table daily. Apple expects objectionable content to be
      acted on within 24 hours.
- [ ] A way to remove a user: delete them under Authentication > Users (their data goes
      with them).

## 2. Accounts

| Account | Cost | Notes |
|---|---|---|
| Apple Developer Program | US$99 / year | Enrolling as a company needs a D-U-N-S number (free, 1 to 2 weeks). |
| Google Play Console | US$25 once | New personal accounts must run a closed test with 12 testers for 14 days first. |
| Expo (EAS) | Free tier | Builds run in Expo's cloud, so no Mac is needed for iOS. |
| Google Cloud | Free tier | For the Android Maps key below. |

## 3. Build configuration

Already in the repo: the app name, bundle ID and package (`za.co.siza.app`), icon,
adaptive icon, splash screen, permission texts, and `eas.json` with development, preview
and production profiles.

Still needed:

1. **Link the project to EAS** (once):
   ```bash
   npm install -g eas-cli
   eas login
   eas init
   ```
   This adds `extra.eas.projectId` to `app.json`. Commit it.

2. **Environment variables for builds.** `.env` isn't uploaded. Add the four
   `EXPO_PUBLIC_*` variables to the `production` environment:
   ```bash
   eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR-REF.supabase.co
   ```
   (and likewise for the anon key, support email and operator name).

3. **Android Maps key.** `react-native-maps` needs a Google Maps key in a standalone Android
   build (Expo Go has its own; iOS uses Apple Maps). Create a key restricted to the Maps SDK
   for Android and your package name, then add to `app.json`:
   ```json
   "android": { "config": { "googleMaps": { "apiKey": "YOUR_KEY" } } }
   ```

4. **A different icon?** Replace the PNGs in `assets/`, or change the drawing in
   `scripts/generate-icons.mjs` and run `npm run icons`.

## 4. Build, test, submit

```bash
eas build --profile preview --platform android     # an APK to install and test directly
eas build --profile production --platform all      # store builds
eas submit --profile production --platform ios     # to App Store Connect / TestFlight
eas submit --profile production --platform android # to Google Play
```

Test the production build through TestFlight and a Play internal test before submitting
for review. Things that only show up in a real build: the splash screen and icon, Android
maps, the session surviving a restart, and the keyboard on small phones.

## 5. Store listings

- **Screenshots:** 6.9" iPhone and a phone-sized Android set. Browse, a task, a bid being
  accepted, chat, checkout.
- **Demo accounts for review:** Apple needs to log in. Create one client and one tasker
  account, with a task between them in progress, and put both logins in the review notes.
  Mention that payments are for real-world services, so Apple's in-app purchase doesn't apply.
- **Privacy questionnaires** (App Privacy on Apple, Data safety on Google). What the app
  collects: name, email, photos the user chooses, approximate and precise location (while
  in use), messages, and payment information (processed by Paystack; card details never
  reach the app). Nothing is used for tracking or advertising.
- **Account deletion:** in the app at Profile > Delete account. Google also asks for a web
  link where a user can request deletion; the support email address serves.
- **Age rating:** 17+/18+. The Terms require users to be adults.

## 6. Every release

- [ ] `npm run check` passes.
- [ ] New migrations were run against production, in order, before the build ships.
- [ ] If a migration added a column to `tasks`, it's in the `GRANT SELECT` list and in
      `TASK_COLUMNS`.
- [ ] Changed Edge Functions were redeployed.
- [ ] `version` in `app.json` was bumped for a store release (build numbers increment by
      themselves).
- [ ] The golden path works on a real phone: sign up, post, bid, hire, chat, mark done,
      pay, review, with two accounts.
