/* ForgeHandoff UI — Mourad.Soltani */
async function api(path, method = "GET", body) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", "X-Client": "Mourad.Soltani" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content;
}

async function refresh() {
  const ws = await api("/api/workspace");
  const health = await api("/api/health");
  const h = health.workspace;
  document.getElementById("health").innerHTML = `
    <strong>${h.healthy ? "Healthy" : "Needs attention"}</strong>
    <div class="muted">${h.clients} clients · ${h.openProjects} open projects</div>
    <div>Avg handoff ${h.avgHandoffScore}% · At risk $${h.atRisk}</div>
    <div class="muted">Signed ${health.signature}</div>`;

  const clients = document.getElementById("clients");
  clients.innerHTML = "";
  ws.clients.forEach((c) => {
    clients.appendChild(el(`<li><strong>${c.name}</strong><div class="muted">${c.company || ""} ${c.email || ""}</div></li>`));
  });

  const opts = ws.clients
    .map((c) => `<option value="${c.id}">${c.name}</option>`)
    .join("");
  document.getElementById("clientSelect").innerHTML = opts || `<option value="">Add a client first</option>`;
  document.getElementById("invoiceClient").innerHTML = opts || `<option value="">Add a client first</option>`;

  const projects = document.getElementById("projects");
  projects.innerHTML = "";
  ws.projects.forEach((p) => {
    const client = ws.clients.find((c) => c.id === p.clientId);
    const items = p.checklist
      .map(
        (i) =>
          `<label class="check"><input type="checkbox" data-p="${p.id}" data-i="${i.id}" ${i.done ? "checked" : ""}/> ${i.label}</label>`
      )
      .join("");
    projects.appendChild(
      el(`<div class="card"><strong>${p.name}</strong> · ${client ? client.name : ""}
        <div class="muted">${p.status} · Mourad.Soltani</div>${items}</div>`)
    );
  });

  const invoices = document.getElementById("invoices");
  invoices.innerHTML = "";
  const now = new Date().toISOString();
  ws.invoices
    .slice()
    .reverse()
    .forEach((inv) => {
      const client = ws.clients.find((c) => c.id === inv.clientId);
      const overdue = !inv.paid && inv.dueDate < now.slice(0, 10);
      invoices.appendChild(
        el(`<li>
          <strong>$${inv.amount}</strong> · ${client ? client.name : ""}
          <div class="${inv.paid ? "ok" : overdue ? "warn" : ""}">${inv.paid ? "Paid" : overdue ? "Overdue" : "Open"} · due ${inv.dueDate}</div>
          ${inv.paid ? "" : `<button data-pay="${inv.id}">Mark paid</button>`}
        </li>`)
      );
    });
}

document.getElementById("clientForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = Object.fromEntries(new FormData(ev.target));
  await api("/api/clients", "POST", f);
  ev.target.reset();
  refresh();
});

document.getElementById("projectForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = Object.fromEntries(new FormData(ev.target));
  await api("/api/projects", "POST", f);
  ev.target.reset();
  refresh();
});

document.getElementById("invoiceForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = Object.fromEntries(new FormData(ev.target));
  f.amount = Number(f.amount);
  await api("/api/invoices", "POST", f);
  ev.target.reset();
  refresh();
});

document.body.addEventListener("change", async (ev) => {
  const t = ev.target;
  if (t.dataset.p && t.dataset.i) {
    await api("/api/check", "POST", { projectId: t.dataset.p, itemId: t.dataset.i });
    refresh();
  }
});

document.body.addEventListener("click", async (ev) => {
  const id = ev.target.dataset.pay;
  if (!id) return;
  await api("/api/invoices/paid", "POST", { invoiceId: id });
  refresh();
});

refresh().catch((err) => {
  document.getElementById("health").textContent = err.message;
});
