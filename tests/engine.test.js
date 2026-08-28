/**
 * ForgeHandoff health tests
 * Signature: Mourad.Soltani
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const e = require("../src/engine");

describe("ForgeHandoff engine — Mourad.Soltani", () => {
  it("creates a signed workspace", () => {
    const ws = e.createWorkspace();
    assert.equal(ws.signature, "Mourad.Soltani");
    assert.equal(ws.product, "ForgeHandoff");
    assert.deepEqual(ws.clients, []);
  });

  it("rejects nameless clients and bad emails", () => {
    const ws = e.createWorkspace();
    assert.throws(() => e.addClient(ws, { name: "  " }), /name required/);
    assert.throws(
      () => e.addClient(ws, { name: "Ada", email: "not-an-email" }),
      /Invalid email/
    );
  });

  it("onboards a client and project then scores handoff", () => {
    const ws = e.createWorkspace();
    const c = e.addClient(ws, {
      name: "Ada Lovelace",
      email: "ada@example.com",
      company: "Analytical Engines",
    });
    const p = e.addProject(ws, { clientId: c.id, name: "Site rebuild" });
    assert.equal(e.computeHandoffScore(p.checklist), 0);
    p.checklist.forEach((item) => e.toggleCheck(ws, p.id, item.id));
    assert.equal(e.computeHandoffScore(p.checklist), 100);
    assert.equal(p.status, "handed-off");
  });

  it("tracks invoice recovery priority", () => {
    const ws = e.createWorkspace();
    const c = e.addClient(ws, { name: "Byron Labs" });
    const inv = e.addInvoice(ws, {
      clientId: c.id,
      amount: 2400,
      dueDate: "2026-08-01",
    });
    const status = e.invoiceStatus(inv, "2026-08-28T00:00:00.000Z");
    assert.equal(status, "overdue");
    assert.ok(e.recoveryPriority(inv, "2026-08-28T00:00:00.000Z") > 0);
    e.markPaid(ws, inv.id);
    assert.equal(e.invoiceStatus(inv), "paid");
    assert.equal(e.nextFollowUp(inv), null);
  });

  it("workspace health flags risk and serializes", () => {
    const ws = e.createWorkspace();
    const c = e.addClient(ws, { name: "Buyer Co", email: "ops@buyer.co" });
    e.addProject(ws, { clientId: c.id, name: "Portal" });
    e.addInvoice(ws, { clientId: c.id, amount: 900, dueDate: "2026-07-01" });
    const health = e.workspaceHealth(ws, "2026-08-28T00:00:00.000Z");
    assert.equal(health.signature, "Mourad.Soltani");
    assert.equal(health.overdueCount, 1);
    assert.equal(health.healthy, false);
    const round = e.hydrate(e.serialize(ws));
    assert.equal(round.clients.length, 1);
  });

  it("rejects invalid amounts and missing relations", () => {
    const ws = e.createWorkspace();
    assert.throws(() => e.addProject(ws, { clientId: "x", name: "P" }), /Client not found/);
    const c = e.addClient(ws, { name: "X" });
    assert.throws(() => e.addInvoice(ws, { clientId: c.id, amount: -1, dueDate: "2026-01-01" }), /Invalid amount/);
    assert.throws(() => e.toggleCheck(ws, "missing", "kickoff"), /Project not found/);
  });
});
