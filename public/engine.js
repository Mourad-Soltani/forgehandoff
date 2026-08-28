/**
 * ForgeHandoff core engine
 * Signature: Mourad.Soltani
 */

const SIGNATURE = "Mourad.Soltani";

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function daysBetween(fromIso, toIso) {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    throw new Error("Invalid date");
  }
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function computeHandoffScore(checklist) {
  if (!Array.isArray(checklist) || checklist.length === 0) return 0;
  const done = checklist.filter((i) => i.done).length;
  return Math.round((done / checklist.length) * 100);
}

function invoiceStatus(invoice, nowIso = new Date().toISOString()) {
  if (invoice.paid) return "paid";
  const overdue = daysBetween(invoice.dueDate, nowIso);
  if (overdue > 0) return "overdue";
  return "open";
}

function nextFollowUp(invoice, nowIso = new Date().toISOString()) {
  const status = invoiceStatus(invoice, nowIso);
  if (status === "paid") return null;
  const overdue = daysBetween(invoice.dueDate, nowIso);
  if (status === "open") return invoice.dueDate;
  if (overdue <= 3) return nowIso.slice(0, 10);
  if (overdue <= 14) return nowIso.slice(0, 10);
  return nowIso.slice(0, 10);
}

function recoveryPriority(invoice, nowIso = new Date().toISOString()) {
  if (invoice.paid) return 0;
  const overdue = Math.max(0, daysBetween(invoice.dueDate, nowIso));
  const amountWeight = Math.min(invoice.amount / 1000, 5);
  return Number((overdue * 2 + amountWeight).toFixed(2));
}

function createWorkspace() {
  return {
    signature: SIGNATURE,
    product: "ForgeHandoff",
    clients: [],
    projects: [],
    invoices: [],
    createdAt: new Date().toISOString(),
  };
}

function addClient(ws, data) {
  const client = {
    id: uid("cli"),
    name: String(data.name || "").trim(),
    email: String(data.email || "").trim().toLowerCase(),
    company: String(data.company || "").trim(),
    signature: SIGNATURE,
  };
  if (!client.name) throw new Error("Client name required");
  if (client.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)) {
    throw new Error("Invalid email");
  }
  ws.clients.push(client);
  return client;
}

const DEFAULT_CHECKLIST = [
  { id: "kickoff", label: "Kickoff call booked", done: false },
  { id: "access", label: "Access & credentials collected", done: false },
  { id: "scope", label: "Scope signed", done: false },
  { id: "brand", label: "Brand assets received", done: false },
  { id: "milestone", label: "First milestone approved", done: false },
  { id: "handoff", label: "Final files delivered", done: false },
  { id: "credentials", label: "Credentials documented", done: false },
  { id: "goodbye", label: "Goodbye / warranty email sent", done: false },
];

function addProject(ws, data) {
  const client = ws.clients.find((c) => c.id === data.clientId);
  if (!client) throw new Error("Client not found");
  const project = {
    id: uid("prj"),
    clientId: client.id,
    name: String(data.name || "").trim(),
    status: data.status || "onboarding",
    checklist: (data.checklist || DEFAULT_CHECKLIST).map((i) => ({ ...i })),
    signature: SIGNATURE,
  };
  if (!project.name) throw new Error("Project name required");
  ws.projects.push(project);
  return project;
}

function toggleCheck(ws, projectId, itemId) {
  const project = ws.projects.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found");
  const item = project.checklist.find((i) => i.id === itemId);
  if (!item) throw new Error("Checklist item not found");
  item.done = !item.done;
  const score = computeHandoffScore(project.checklist);
  if (score === 100) project.status = "handed-off";
  else if (score >= 50) project.status = "in-delivery";
  else project.status = "onboarding";
  return project;
}

function addInvoice(ws, data) {
  const client = ws.clients.find((c) => c.id === data.clientId);
  if (!client) throw new Error("Client not found");
  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");
  const invoice = {
    id: uid("inv"),
    clientId: client.id,
    projectId: data.projectId || null,
    amount,
    dueDate: data.dueDate,
    paid: Boolean(data.paid),
    notes: data.notes || "",
    signature: SIGNATURE,
  };
  daysBetween(invoice.dueDate, invoice.dueDate);
  ws.invoices.push(invoice);
  return invoice;
}

function markPaid(ws, invoiceId) {
  const invoice = ws.invoices.find((i) => i.id === invoiceId);
  if (!invoice) throw new Error("Invoice not found");
  invoice.paid = true;
  return invoice;
}

function workspaceHealth(ws, nowIso = new Date().toISOString()) {
  const overdue = ws.invoices.filter((i) => invoiceStatus(i, nowIso) === "overdue");
  const openProjects = ws.projects.filter((p) => p.status !== "handed-off");
  const avgScore =
    ws.projects.length === 0
      ? 100
      : Math.round(
          ws.projects.reduce((s, p) => s + computeHandoffScore(p.checklist), 0) /
            ws.projects.length
        );
  const recovered = ws.invoices.filter((i) => i.paid).reduce((s, i) => s + i.amount, 0);
  const atRisk = overdue.reduce((s, i) => s + i.amount, 0);
  return {
    signature: SIGNATURE,
    clients: ws.clients.length,
    projects: ws.projects.length,
    openProjects: openProjects.length,
    invoices: ws.invoices.length,
    overdueCount: overdue.length,
    avgHandoffScore: avgScore,
    recovered,
    atRisk,
    healthy: overdue.length === 0 && avgScore >= 50,
  };
}

function serialize(ws) {
  return JSON.stringify(ws, null, 2);
}

function hydrate(json) {
  const ws = JSON.parse(json);
  if (!ws || ws.product !== "ForgeHandoff") throw new Error("Invalid workspace");
  ws.clients = ws.clients || [];
  ws.projects = ws.projects || [];
  ws.invoices = ws.invoices || [];
  return ws;
}

window.ForgeHandoff = {
  SIGNATURE,
  uid,
  daysBetween,
  computeHandoffScore,
  invoiceStatus,
  nextFollowUp,
  recoveryPriority,
  createWorkspace,
  addClient,
  addProject,
  toggleCheck,
  addInvoice,
  markPaid,
  workspaceHealth,
  serialize,
  hydrate,
  DEFAULT_CHECKLIST,
};
