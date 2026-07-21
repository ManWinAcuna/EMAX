/* EMaxing runtime config — Firebase + Stripe.
 *
 * PLACEHOLDER MODE: EMAXING_CONFIG_READY is false until Manuel creates the real
 * (NEW, separate-from-the-cockpit) Firebase project + Stripe account and pastes
 * the values below. While false, the app runs fully in "no-backend" mode:
 * sign-in is unavailable and the paid tier stays locked (the ?unlock=1 demo flag
 * still previews it). Flip EMAXING_CONFIG_READY to true once the values are real
 * and everything (auth, subscription check, Stripe checkout) activates — no other
 * code change needed. See SETUP.md.
 */

// Flip to true only after ALL placeholders below are replaced with real values.
window.EMAXING_CONFIG_READY = false;

// Firebase — a NEW project for EMAX (do NOT reuse the cockpit's project).
window.EMAXING_FIREBASE_CONFIG = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME.firebasestorage.app',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

// Stripe — publishable key (test key while in test mode) + the $4.90/mo price id.
window.EMAXING_STRIPE = {
  publishableKey: 'pk_test_REPLACE_ME',
  monthlyPriceId: 'price_REPLACE_ME', // EMAX Personal, $4.90/mo
};

// Base URL of the deployed Cloud Functions (creates checkout sessions + takes the
// Stripe webhook). Set after `firebase deploy --only functions`.
window.EMAXING_FUNCTIONS_BASE = 'REPLACE_ME'; // e.g. https://us-central1-<project>.cloudfunctions.net
