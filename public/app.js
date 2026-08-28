/* ForgeHandoff UI — Mourad.Soltani
 * Dual mode: /api/* when server is present, else localStorage (Vercel static).
 */
const SIGNATURE = "Mourad.Soltani";
const STORE_KEY = "forgehandoff_ws_v1";

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

function uid(prefix) {
  return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function emptyWs() {
  return {
    signature: SIGNATURE,
    product: "ForgeHandoff",
    clients: [],
    projects: [],
    invoices: [],
    plan: "free",
    createdAt: new Date().toISOString(),
  };
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyWs();
    const ws = JSON.parse(raw);
    if (ws.product !== "ForgeHandoff") return emptyWs();
    return ws;
  } catch {
    return emptyWs();
  }
}

function saveLocal(ws) {
  localStorage.setItem(STORE_KEY, JSON.stringify(ws));
}

function score(checklist) {
  if (!checklist.length) return 0;
  return Math.round((checklist.filter((i) => i.done).length / checklist.length) * 100);
}

function healthOf(ws) {
  const now = new Date().toISOString().slice(0, 10);
  const overdue = ws.invoices.filter((i) => !i.paid && i.dueDate < now);
  const openProjects = ws.projects.filter((p) => p.status !== "handed-off");
  const avg =
    ws.projects.length === 0
      ? 100
      : Math.round(ws.projects.reduce((s, p) => s + score(p.checklist), 0) / ws.projects.length);
  return {
    signature: SIGNATURE,
    clients: ws.clients.length,
    projects: ws.projects.length,
    openProjects: openProjects.length,
    overdueCount: overdue.length,
    avgHandoffScore: avg,
    atRisk: overdue.reduce((s, i) => s + Number(i.amount), 0),
    plan: ws.plan || "free",
    healthy: overdue.length === 0 && avg >= 50,
  };
}

let mode = "local";
let memory = loadLocal();

async function api(path, method, body) {
  method = method || "GET";
  if (mode === "local") throw new Error("local");
  const res = await fetch(path, {
    method: method,
    headers: { "Content-Type": "application/json", "X-Client": SIGNATURE },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function getWorkspace() {
  try {
    const ws = await api("/api/workspace");
    mode = "api";
    return ws;
  } catch (e) {
    mode = "local";
    memory = loadLocal();
    return memory;
  }
}

async function getHealth() {
  if (mode === "api") {
    try {
      return await api("/api/health");
    } catch (e) {
      mode = "local";
    }
  }
  return { ok: true, product: "ForgeHandoff", signature: SIGNATURE, workspace: healthOf(memory) };
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content;
}

async function refresh() {
  const ws = await getWorkspace();
  if (mode === "local") memory = ws;
  const health = await getHealth();
  const h = health.workspace;
  document.getElementById("health").innerHTML =
    "<strong>" + (h.healthy ? "Healthy" : "Needs attention") + "</strong>" +
    '<div class="muted">' + h.clients + " clients · " + h.openProjects + " open · plan: " + (h.plan || "free") + "</div>" +
    "<div>Avg handoff " + h.avgHandoffScore + "% · At risk $" + h.atRisk + "</div>" +
    '<div class="muted">' + (mode === "api" ? "API mode" : "Browser mode") + " · " + health.signature + "</div>";

  const clients = document.getElementById("clients");
  clients.innerHTML = "";
  ws.clients.forEach(function (c) {
    clients.appendChild(
      el("<li><strong>" + c.name + '</strong><div class="muted">' + (c.company || "") + " " + (c.email || "") + "</div></li>")
    );
  });

  const opts = ws.clients.map(function (c) {
    return '<option value="' + c.id + '">' + c.name + "</option>";
  }).join("");
  document.getElementById("clientSelect").innerHTML = opts || '<option value="">Add a client first</option>';
  document.getElementById("invoiceClient").innerHTML = opts || '<option value="">Add a client first</option>';

  const projects = document.getElementById("projects");
  projects.innerHTML = "";
  ws.projects.forEach(function (p) {
    const client = ws.clients.find(function (c) { return c.id === p.clientId; });
    const items = p.checklist
      .map(function (i) {
        return '<label class="check"><input type="checkbox" data-p="' + p.id + '" data-i="' + i.id + '" ' +
          (i.done ? "checked" : "") + "/> " + i.label + "</label>";
      })
      .join("");
    projects.appendChild(
      el(
        '<div class="card"><strong>' + p.name + "</strong> · " + (client ? client.name : "") +
          '<div class="muted">' + p.status + " · score " + score(p.checklist) + "% · Mourad.Soltani</div>" + items + "</div>"
      )
    );
  });

  const invoices = document.getElementById("invoices");
  invoices.innerHTML = "";
  const now = new Date().toISOString().slice(0, 10);
  ws.invoices
    .slice()
    .reverse()
    .forEach(function (inv) {
      const client = ws.clients.find(function (c) { return c.id === inv.clientId; });
      const overdue = !inv.paid && inv.dueDate < now;
      invoices.appendChild(
        el(
          "<li><strong>$" + inv.amount + "</strong> · " + (client ? client.name : "") +
            '<div class="' + (inv.paid ? "ok" : overdue ? "warn" : "") + '">' +
            (inv.paid ? "Paid" : overdue ? "Overdue" : "Open") + " · due " + inv.dueDate + "</div>" +
            (inv.paid ? "" : '<button data-pay="' + inv.id + '">Mark paid</button>') +
            "</li>"
        )
      );
    });

  const planEl = document.getElementById("planBadge");
  if (planEl) planEl.textContent = "Plan: " + (ws.plan || "free") + " · Mourad.Soltani";
}

async function addClient(data) {
  if (mode === "api") {
    await api("/api/clients", "POST", data);
    return;
  }
  if (!String(data.name || "").trim()) throw new Error("Client name required");
  memory.clients.push({
    id: uid("cli"),
    name: String(data.name).trim(),
    email: String(data.email || "").trim().toLowerCase(),
    company: String(data.company || "").trim(),
    signature: SIGNATURE,
  });
  saveLocal(memory);
}

async function addProject(data) {
  if (mode === "api") {
    await api("/api/projects", "POST", data);
    return;
  }
  const client = memory.clients.find(function (c) { return c.id === data.clientId; });
  if (!client) throw new Error("Client not found");
  memory.projects.push({
    id: uid("prj"),
    clientId: client.id,
    name: String(data.name).trim(),
    status: "onboarding",
    checklist: DEFAULT_CHECKLIST.map(function (i) { return Object.assign({}, i); }),
    signature: SIGNATURE,
  });
  saveLocal(memory);
}

async function toggleItem(projectId, itemId) {
  if (mode === "api") {
    await api("/api/check", "POST", { projectId: projectId, itemId: itemId });
    return;
  }
  const p = memory.projects.find(function (x) { return x.id === projectId; });
  if (!p) return;
  const item = p.checklist.find(function (i) { return i.id === itemId; });
  if (!item) return;
  item.done = !item.done;
  const s = score(p.checklist);
  p.status = s === 100 ? "handed-off" : s >= 50 ? "in-delivery" : "onboarding";
  saveLocal(memory);
}

async function addInvoice(data) {
  if (mode === "api") {
    await api("/api/invoices", "POST", data);
    return;
  }
  const client = memory.clients.find(function (c) { return c.id === data.clientId; });
  if (!client) throw new Error("Client not found");
  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");
  memory.invoices.push({
    id: uid("inv"),
    clientId: client.id,
    amount: amount,
    dueDate: data.dueDate,
    paid: false,
    signature: SIGNATURE,
  });
  saveLocal(memory);
}

async function markPaid(invoiceId) {
  if (mode === "api") {
    await api("/api/invoices/paid", "POST", { invoiceId: invoiceId });
    return;
  }
  const inv = memory.invoices.find(function (i) { return i.id === invoiceId; });
  if (inv) inv.paid = true;
  saveLocal(memory);
}

document.getElementById("clientForm").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  try {
    await addClient(Object.fromEntries(new FormData(ev.target)));
    ev.target.reset();
    refresh();
  } catch (e) {
    alert(e.message);
  }
});

document.getElementById("projectForm").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  try {
    await addProject(Object.fromEntries(new FormData(ev.target)));
    ev.target.reset();
    refresh();
  } catch (e) {
    alert(e.message);
  }
});

document.getElementById("invoiceForm").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  try {
    const f = Object.fromEntries(new FormData(ev.target));
    f.amount = Number(f.amount);
    await addInvoice(f);
    ev.target.reset();
    refresh();
  } catch (e) {
    alert(e.message);
  }
});

document.body.addEventListener("change", async function (ev) {
  const t = ev.target;
  if (t.dataset.p && t.dataset.i) {
    await toggleItem(t.dataset.p, t.dataset.i);
    refresh();
  }
});

document.body.addEventListener("click", async function (ev) {
  const id = ev.target.dataset.pay;
  if (!id) return;
  await markPaid(id);
  refresh();
});

const upgradeBtn = document.getElementById("upgradeBtn");
if (upgradeBtn) {
  upgradeBtn.addEventListener("click", function () {
    alert(
      "Stripe Checkout placeholder.\nSet STRIPE_PRICE_PRO + STRIPE_SECRET_KEY on the server to go live.\n— Mourad.Soltani"
    );
  });
}

refresh().catch(function (err) {
  document.getElementById("health").textContent = err.message;
});
