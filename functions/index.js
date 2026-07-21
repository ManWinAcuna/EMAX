/* EMaxing subscription backend — Firebase Cloud Functions + Stripe.
 *
 * This is the ONE trusted server piece. It is the only writer of
 * users/{uid}.subscription — the client can NEVER set its own "I paid" flag.
 *
 *  - createCheckoutSession: verifies the caller's Firebase ID token, opens a
 *    Stripe Checkout Session for the $4.90/mo price, tagged with their uid.
 *  - stripeWebhook: on Stripe subscription events, writes the subscription flag
 *    to Firestore (active/inactive).
 *
 * Secrets (set before deploy — see SETUP.md):
 *   firebase functions:config:set stripe.secret="sk_test_..." stripe.webhook_secret="whsec_..."
 * or env vars STRIPE_SECRET / STRIPE_WEBHOOK_SECRET.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const cfg = (functions.config && functions.config().stripe) || {};
const stripe = require('stripe')(process.env.STRIPE_SECRET || cfg.secret);
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || cfg.webhook_secret;
const ALLOWED_ORIGIN = process.env.EMAX_ORIGIN || '*'; // set to the EMAX site origin in prod

function setCors(res) {
  res.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

async function writeSub(uid, active, extra) {
  if (!uid) return;
  await db.collection('users').doc(uid).set({
    subscription: Object.assign(
      { active: !!active, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      extra || {}
    ),
  }, { merge: true });
}

exports.createCheckoutSession = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  try {
    const header = req.get('Authorization') || '';
    const idToken = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: 'missing token' });
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const { priceId, returnUrl } = req.body || {};
    const sep = returnUrl && returnUrl.includes('?') ? '&' : '?';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: uid,
      customer_email: decoded.email || undefined,
      subscription_data: { metadata: { uid } }, // so later sub events carry the uid
      success_url: (returnUrl || '') + sep + 'sub=success',
      cancel_url: (returnUrl || '') + sep + 'sub=cancel',
      metadata: { uid },
    });
    return res.json({ url: session.url });
  } catch (e) {
    console.error('createCheckoutSession', e);
    return res.status(500).json({ error: 'checkout failed' });
  }
});

exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, req.get('stripe-signature'), WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).send('bad signature');
  }
  try {
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      await writeSub(s.client_reference_id || (s.metadata && s.metadata.uid), true, {
        tier: 'personal', stripeCustomerId: s.customer, stripeSubscriptionId: s.subscription,
      });
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const active = event.type !== 'customer.subscription.deleted' && ['active', 'trialing'].includes(sub.status);
      let uid = sub.metadata && sub.metadata.uid;
      if (!uid) {
        const snap = await db.collection('users').where('subscription.stripeCustomerId', '==', sub.customer).limit(1).get();
        if (!snap.empty) uid = snap.docs[0].id;
      }
      await writeSub(uid, active, { stripeSubscriptionId: sub.id, currentPeriodEnd: sub.current_period_end });
    }
    return res.json({ received: true });
  } catch (e) {
    console.error('stripeWebhook', e);
    return res.status(500).send('handler error');
  }
});
