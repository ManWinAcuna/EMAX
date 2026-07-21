/* EMaxing auth + subscription gate.
 *
 * Owns "is this user a paying subscriber?" and the sign-in / checkout flow.
 * Config-gated (see emaxing-config.js): while EMAXING_CONFIG_READY is false it
 * no-ops gracefully — Firebase never loads, the paid tier stays locked, and the
 * ?unlock=1 demo flag still previews it. When Manuel drops real config and flips
 * the flag, sign-in + the Firestore subscription check + Stripe checkout all go
 * live with no other code change.
 *
 * Real security note: the client check below is UX only. The subscription flag
 * lives at Firestore users/{uid}.subscription and is written ONLY by the Stripe
 * webhook Cloud Function (functions/index.js) — never by the client. Firestore
 * rules must make that field backend-write-only + owner-read (see SETUP.md), so
 * a user can't self-grant access. Paid CONTENT can be moved behind those rules
 * later if we want it un-scrapeable; v1 ships content client-side.
 */

const EMAXING_DEMO_UNLOCK_KEY = 'emaxing_demo_unlock';

// Owner comp: these emails always get the paid tier, no payment needed (mirrors
// the cockpit's owner gate). Only takes effect once auth is live and the user is
// signed in as one of them — until then, the ?unlock=1 demo flag covers testing.
// Note: emails ship in the client source; keep it to accounts you own.
const EMAXING_OWNER_EMAILS = ['horseyear2026manuel@gmail.com'];

let emaxingFbLoadPromise = null;
let emaxingCurrentUser = null;
let emaxingSubActive = false;      // last-known Firestore subscription.active
let emaxingAuthMode = 'signin';

// The app sets this to re-render the paid card when auth/subscription changes.
window.emaxingOnSubscriptionChange = window.emaxingOnSubscriptionChange || null;
function emaxingNotifyChange() {
  if (typeof window.emaxingOnSubscriptionChange === 'function') window.emaxingOnSubscriptionChange();
}

function emaxingConfigReady() {
  return !!window.EMAXING_CONFIG_READY;
}

// True when the signed-in user is a comped owner. Case-insensitive; only ever
// true once Firebase auth is live and this account is signed in.
function emaxingIsOwner() {
  const email = emaxingCurrentUser && emaxingCurrentUser.email;
  return !!email && EMAXING_OWNER_EMAILS.indexOf(String(email).trim().toLowerCase()) !== -1;
}

// The real subscriber check (sync, best-effort). Owner comp + the demo unlock
// flag both preview the tier without a paid subscription/backend.
function emaxingIsSubscriber() {
  if (emaxingIsOwner()) return true;
  try {
    const p = new URLSearchParams(location.search);
    if (p.get('unlock') === '1') localStorage.setItem(EMAXING_DEMO_UNLOCK_KEY, '1');
    if (p.get('unlock') === '0') localStorage.removeItem(EMAXING_DEMO_UNLOCK_KEY);
    if (localStorage.getItem(EMAXING_DEMO_UNLOCK_KEY) === '1') return true;
  } catch (e) { /* ignore */ }
  return emaxingSubActive;
}

function emaxingLoadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('failed ' + src));
    document.body.appendChild(s);
  });
}

// Loads Firebase (auth + firestore) only when real config exists.
function emaxingLoadFirebase() {
  if (!emaxingConfigReady()) return Promise.resolve(false);
  if (window.firebase && firebase.apps && firebase.apps.length) return Promise.resolve(true);
  if (!emaxingFbLoadPromise) {
    const base = 'https://www.gstatic.com/firebasejs/10.13.2/';
    emaxingFbLoadPromise = ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js']
      .reduce((chain, f) => chain.then(() => emaxingLoadScript(base + f)), Promise.resolve())
      .then(() => {
        firebase.initializeApp(window.EMAXING_FIREBASE_CONFIG);
        firebase.auth().onAuthStateChanged(emaxingOnAuth);
        return true;
      })
      .catch(() => false);
  }
  return emaxingFbLoadPromise;
}

function emaxingOnAuth(user) {
  emaxingCurrentUser = user || null;
  if (user) emaxingRefreshSubscription();
  else { emaxingSubActive = false; emaxingNotifyChange(); }
}

// Reads users/{uid}.subscription.active. The doc is written by the Stripe webhook
// function, never the client.
function emaxingRefreshSubscription() {
  if (!emaxingCurrentUser || !window.firebase) return Promise.resolve(false);
  return firebase.firestore().collection('users').doc(emaxingCurrentUser.uid).get()
    .then((doc) => {
      const sub = doc.exists && doc.data().subscription;
      emaxingSubActive = !!(sub && sub.active);
      emaxingNotifyChange();
      return emaxingSubActive;
    })
    .catch(() => emaxingSubActive);
}

/* ---------- Sign-in / sign-up modal ---------- */

function emaxingEnsureAuthModal() {
  if (document.getElementById('emaAuthOverlay')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="ema-modal-overlay" id="emaAuthOverlay">
      <div class="ema-modal">
        <button class="ema-modal-close" id="emaAuthClose" title="Close">&times;</button>
        <div class="ema-modal-title" id="emaAuthTitle">Sign in</div>
        <div class="ema-modal-sub">Unlock your personal daily guidance.</div>
        <input class="ema-modal-input" type="email" id="emaAuthEmail" placeholder="Email" autocomplete="email">
        <input class="ema-modal-input" type="password" id="emaAuthPass" placeholder="Password" autocomplete="current-password">
        <div class="ema-modal-error" id="emaAuthError"></div>
        <button class="ema-btn" id="emaAuthSubmit">Sign in</button>
        <button class="ema-link" id="emaAuthToggle" type="button">Need an account? Sign up</button>
      </div>
    </div>`);

  const overlay = document.getElementById('emaAuthOverlay');
  document.getElementById('emaAuthClose').addEventListener('click', emaxingCloseAuthModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) emaxingCloseAuthModal(); });
  document.getElementById('emaAuthToggle').addEventListener('click', () => {
    emaxingSetAuthMode(emaxingAuthMode === 'signin' ? 'signup' : 'signin');
  });
  document.getElementById('emaAuthSubmit').addEventListener('click', emaxingSubmitAuth);
  document.getElementById('emaAuthPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') emaxingSubmitAuth(); });
}

function emaxingSetAuthMode(mode) {
  emaxingAuthMode = mode;
  document.getElementById('emaAuthTitle').textContent = mode === 'signup' ? 'Create account' : 'Sign in';
  document.getElementById('emaAuthSubmit').textContent = mode === 'signup' ? 'Sign up' : 'Sign in';
  document.getElementById('emaAuthToggle').textContent = mode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Sign up';
  document.getElementById('emaAuthError').textContent = '';
}

function emaxingOpenAuthModal() {
  emaxingEnsureAuthModal();
  emaxingSetAuthMode('signin');
  document.getElementById('emaAuthError').textContent = '';
  document.getElementById('emaAuthOverlay').classList.add('active');
}
function emaxingCloseAuthModal() {
  const o = document.getElementById('emaAuthOverlay');
  if (o) o.classList.remove('active');
}

const EMAXING_AUTH_ERRORS = {
  'auth/invalid-email': 'That email looks invalid.',
  'auth/user-not-found': 'No account with that email — try Sign up.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/email-already-in-use': 'An account already exists — try Sign in.',
  'auth/weak-password': 'Password should be at least 6 characters.',
};

function emaxingSubmitAuth() {
  const email = document.getElementById('emaAuthEmail').value.trim();
  const pass = document.getElementById('emaAuthPass').value;
  const errEl = document.getElementById('emaAuthError');
  if (!email || !pass) { errEl.textContent = 'Enter your email and password.'; return; }
  const btn = document.getElementById('emaAuthSubmit');
  btn.disabled = true;
  const fn = emaxingAuthMode === 'signup'
    ? firebase.auth().createUserWithEmailAndPassword(email, pass)
    : firebase.auth().signInWithEmailAndPassword(email, pass);
  fn.then(() => emaxingRefreshSubscription())
    .then(() => {
      emaxingCloseAuthModal();
      // If they signed in specifically to subscribe and aren't active yet, go to checkout.
      if (!emaxingSubActive) emaxingStartCheckout();
    })
    .catch((err) => { errEl.textContent = EMAXING_AUTH_ERRORS[err && err.code] || (err && err.message) || 'Something went wrong.'; })
    .finally(() => { btn.disabled = false; });
}

function emaxingSignOut() {
  if (window.firebase && firebase.auth) firebase.auth().signOut();
}

/* ---------- Checkout ---------- */

// Kicks off Stripe Checkout for the $4.90/mo plan. Asks the Cloud Function to
// create a session for this signed-in user, then redirects. Placeholder-safe.
function emaxingStartCheckout() {
  if (!emaxingConfigReady()) { alert('Subscriptions launch soon — EMAX Personal will be $4.90/mo.'); return; }
  if (!emaxingCurrentUser) { emaxingOpenAuthModal(); return; }
  const base = window.EMAXING_FUNCTIONS_BASE;
  emaxingCurrentUser.getIdToken().then((token) =>
    fetch(base + '/createCheckoutSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ priceId: window.EMAXING_STRIPE.monthlyPriceId, returnUrl: location.href }),
    })
  ).then((r) => r.json())
    .then((data) => { if (data && data.url) location.href = data.url; else throw new Error('no session url'); })
    .catch(() => alert('Could not start checkout — please try again.'));
}

// The paywall "Unlock" button calls this: not signed in -> auth modal; signed in
// but not subscribed -> checkout; subscribed -> nothing (already unlocked).
function emaxingHandleUnlock() {
  if (emaxingIsSubscriber()) { emaxingNotifyChange(); return; }
  if (!emaxingConfigReady()) { alert('Subscriptions launch soon — EMAX Personal will be $4.90/mo.'); return; }
  if (!emaxingCurrentUser) { emaxingOpenAuthModal(); return; }
  emaxingStartCheckout();
}

// Kick off Firebase load in the background (real config only) so a returning
// subscriber's paid tier unlocks on load without a click.
if (emaxingConfigReady()) {
  if (document.readyState !== 'loading') emaxingLoadFirebase();
  else document.addEventListener('DOMContentLoaded', emaxingLoadFirebase);
}
