/**
 * ForgeHandoff Stripe route helpers — Mourad.Soltani
 * Requires STRIPE_SECRET_KEY. Never commit secrets.
 */
const { checkoutSessionParams, planOf, SIGNATURE } = require("./billing");

function json(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "X-Signature": SIGNATURE,
  });
  res.end(JSON.stringify(body));
}

/**
 * POST /api/billing/checkout  { planId, email?, successUrl?, cancelUrl? }
 * Returns { url } when Stripe is configured, else setup instructions.
 */
async function handleCheckout(req, res, body) {
  const planId = body.planId || "pro";
  const plan = planOf(planId);
  if (plan.id === "free") {
    return json(res, 400, { error: "Free plan has no checkout", signature: SIGNATURE });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return json(res, 501, {
      error: "Stripe not configured",
      signature: SIGNATURE,
      setup: [
        "Create products in Stripe Dashboard",
        "Set STRIPE_SECRET_KEY",
        "Optional: STRIPE_PRICE_PRO / STRIPE_PRICE_AGENCY",
        "Restart server",
      ],
      preview: checkoutSessionParams({
        planId,
        successUrl: body.successUrl || "http://127.0.0.1:4173/?upgraded=1",
        cancelUrl: body.cancelUrl || "http://127.0.0.1:4173/?canceled=1",
        customerEmail: body.email,
      }),
    });
  }

  try {
    const params = checkoutSessionParams({
      planId,
      successUrl: body.successUrl || "http://127.0.0.1:4173/?upgraded=1",
      cancelUrl: body.cancelUrl || "http://127.0.0.1:4173/?canceled=1",
      customerEmail: body.email,
    });
    // Minimal Stripe REST without SDK dependency
    const form = new URLSearchParams();
    form.set("mode", params.mode);
    form.set("success_url", params.success_url);
    form.set("cancel_url", params.cancel_url);
    if (params.customer_email) form.set("customer_email", params.customer_email);
    form.set("metadata[product]", "ForgeHandoff");
    form.set("metadata[plan]", plan.id);
    form.set("metadata[signature]", SIGNATURE);
    if (params.line_items[0].price) {
      form.set("line_items[0][price]", params.line_items[0].price);
      form.set("line_items[0][quantity]", "1");
    } else {
      const li = params.line_items[0].price_data;
      form.set("line_items[0][price_data][currency]", li.currency);
      form.set("line_items[0][price_data][unit_amount]", String(li.unit_amount));
      form.set("line_items[0][price_data][recurring][interval]", li.recurring.interval);
      form.set("line_items[0][price_data][product_data][name]", li.product_data.name);
      form.set("line_items[0][quantity]", "1");
    }

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + secret,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const data = await stripeRes.json();
    if (!stripeRes.ok) {
      return json(res, 502, { error: data.error && data.error.message ? data.error.message : "Stripe error", signature: SIGNATURE });
    }
    return json(res, 200, { url: data.url, id: data.id, signature: SIGNATURE });
  } catch (err) {
    return json(res, 500, { error: err.message, signature: SIGNATURE });
  }
}

/**
 * POST /api/billing/webhook — raw body + Stripe-Signature required in production.
 * This is a structural stub: verifies presence of env, acknowledges events.
 */
async function handleWebhook(req, res, rawBody) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return json(res, 501, {
      error: "STRIPE_WEBHOOK_SECRET not set",
      signature: SIGNATURE,
      note: "Configure endpoint in Stripe Dashboard → Developers → Webhooks",
    });
  }
  // Full signature verification needs stripe SDK or careful HMAC; keep stub honest.
  return json(res, 200, {
    received: true,
    signature: SIGNATURE,
    note: "Wire stripe.webhooks.constructEvent before trusting payload",
  });
}

module.exports = { handleCheckout, handleWebhook, SIGNATURE };
