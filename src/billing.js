/**
 * ForgeHandoff billing skeleton — Mourad.Soltani
 * Wire real Stripe keys via env. No secrets in source.
 */

const SIGNATURE = "Mourad.Soltani";

const PLANS = {
  free: {
    id: "free",
    name: "Free",
    priceCents: 0,
    limits: { clients: 5, projects: 10, invoices: 20 },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceCents: 2900,
    interval: "month",
    limits: { clients: 200, projects: 500, invoices: 2000 },
  },
  agency: {
    id: "agency",
    name: "Agency",
    priceCents: 9900,
    interval: "month",
    limits: { clients: 2000, projects: 5000, invoices: 20000 },
  },
};

function planOf(id) {
  return PLANS[id] || PLANS.free;
}

function withinLimits(ws, kind) {
  const plan = planOf(ws.plan || "free");
  const count =
    kind === "clients"
      ? ws.clients.length
      : kind === "projects"
        ? ws.projects.length
        : ws.invoices.length;
  return count < plan.limits[kind];
}

/**
 * Returns a Checkout Session payload shape for Stripe.
 * Caller must post to Stripe with a real secret key.
 */
function checkoutSessionParams({ planId, successUrl, cancelUrl, customerEmail }) {
  const plan = planOf(planId);
  if (plan.id === "free") throw new Error("Free plan has no checkout");
  const price = process.env.STRIPE_PRICE_PRO || process.env[`STRIPE_PRICE_${plan.id.toUpperCase()}`];
  return {
    signature: SIGNATURE,
    mode: "subscription",
    line_items: price
      ? [{ price, quantity: 1 }]
      : [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `ForgeHandoff ${plan.name}`,
                metadata: { signature: SIGNATURE },
              },
              unit_amount: plan.priceCents,
              recurring: { interval: plan.interval || "month" },
            },
            quantity: 1,
          },
        ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: customerEmail || undefined,
    metadata: {
      product: "ForgeHandoff",
      plan: plan.id,
      signature: SIGNATURE,
    },
  };
}

function applyPlan(ws, planId) {
  const plan = planOf(planId);
  ws.plan = plan.id;
  ws.planUpdatedAt = new Date().toISOString();
  ws.signature = SIGNATURE;
  return ws;
}

module.exports = {
  SIGNATURE,
  PLANS,
  planOf,
  withinLimits,
  checkoutSessionParams,
  applyPlan,
};
