# ForgeHandoff

**Client onboarding · project handoff · invoice recovery**

Signed throughout by **Mourad.Soltani**.

Indie agencies and freelancers lose hours to messy kickoffs and unpaid invoices. ForgeHandoff is a local-first workspace that tracks the handoff checklist and ranks which invoices to chase.

## Why this product

2026 demand clusters around:

- client portals / project handoff for agencies
- invoice follow-up / payment recovery
- onboarding checklists for professional services

ForgeHandoff is the wedge: one workspace, browser-only or Node API, clear path to hosted SaaS + Stripe.

## Quick start

```bash
node --test tests/*.test.js   # health tests (must pass)
node server.js                # http://127.0.0.1:4173
```

Node 18+.

### Modes

| Mode | How | Data |
|------|-----|------|
| Browser | Open `public/` or Vercel static | `localStorage` |
| API | `node server.js` | `data/workspace.json` |

### Stripe (optional)

```bash
export STRIPE_SECRET_KEY=sk_test_...
# optional STRIPE_PRICE_PRO=price_...
node server.js
# POST /api/billing/checkout  { "planId": "pro" }
```

Plans in `src/billing.js`: Free · Pro $29/mo · Agency $99/mo.

## Health

```bash
npm test
# or
node --test tests/*.test.js
```

## Sale / partnership

- Author: **Mourad.Soltani**
- License: MIT
- Ask band: $4,500–$12,000 (pre-revenue MVP — no fake MRR)
- Docs: `docs/SALE.md`, `docs/ACQUIRE_LISTING.md`, `docs/OUTREACH.md`, `docs/DESIGN_PARTNER.md`, `docs/CHECKLIST.md`

Repo: https://github.com/Mourad-Soltani/forgehandoff

## Signature

Every module, page, API response, and health payload carries **Mourad.Soltani**.
