# EMaxing — going live (auth + subscriptions)

The app runs fully **without** any of this (free tier works; paid tier stays
locked / previewable with `?unlock=1`). These steps activate real sign-in +
paid subscriptions. Only Manuel can do the account/key steps — Claude can't
create Firebase projects or financial accounts.

Everything is wired to flip on with **one flag** (`EMAXING_CONFIG_READY`) once
the placeholders in `emaxing-config.js` are filled.

## 1. New Firebase project (separate from the personal cockpit)
1. Firebase console → **Add project** (a NEW project — do not reuse
   `advanced-numerology-d3f0f`).
2. **Authentication** → enable **Email/Password**.
3. **Firestore Database** → create (production mode).
4. **Firestore rules** — the subscription flag must be backend-write-only:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid} {
         allow read: if request.auth != null && request.auth.uid == uid;
         // clients may write their own doc BUT never the subscription field;
         // only the Cloud Function (admin) writes subscription.
         allow write: if request.auth != null && request.auth.uid == uid
                      && !('subscription' in request.resource.data);
       }
     }
   }
   ```
5. Project settings → **Web app** → copy the config into
   `emaxing-config.js` → `EMAXING_FIREBASE_CONFIG`.

## 2. Stripe (test mode first)
1. Stripe dashboard → **Product** "EMAX Personal" → **recurring price $4.90/mo**.
   Copy the price id (`price_...`) into `EMAXING_STRIPE.monthlyPriceId`.
2. Copy the **publishable** test key (`pk_test_...`) into
   `EMAXING_STRIPE.publishableKey`.
3. Copy the **secret** test key (`sk_test_...`) — used by the function (step 3).

## 3. Deploy the Cloud Functions (`functions/`)
```
cd functions && npm install && cd ..
firebase functions:config:set stripe.secret="sk_test_..." stripe.webhook_secret="whsec_..."
firebase deploy --only functions
```
- Put the deployed base URL (e.g. `https://us-central1-<project>.cloudfunctions.net`)
  into `EMAXING_FUNCTIONS_BASE`.
- Stripe dashboard → **Webhooks** → add endpoint `<base>/stripeWebhook`, listen
  for `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`. Copy its signing secret (`whsec_...`) into the
  `functions:config:set` above and re-deploy.

## 4. Flip it on
In `emaxing-config.js` set `window.EMAXING_CONFIG_READY = true;` (after every
placeholder above is a real value). Sign-in, the subscription check, and Stripe
checkout all activate — no other code change.

## Test flow (test mode)
Sign up → Unlock → Stripe test card `4242 4242 4242 4242` → webhook writes
`users/{uid}.subscription.active = true` → the paid card unlocks on return.

## Going to live keys
Swap the Stripe test keys for live keys, re-set the function config, re-deploy,
and update the webhook endpoint's signing secret. Set
`EMAX_ORIGIN` (function env) to the real site origin to tighten CORS.
