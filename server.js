#!/usr/bin/env node
/**
 * ForgeHandoff local server
 * Signature: Mourad.Soltani
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { createWorkspace, hydrate, serialize } = require("./src/engine");

const PORT = Number(process.env.PORT || 4173);
const DATA = path.join(__dirname, "data", "workspace.json");
const PUBLIC = path.join(__dirname, "public");

function load() {
  try {
    return hydrate(fs.readFileSync(DATA, "utf8"));
  } catch {
    return createWorkspace();
  }
}

function save(ws) {
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  fs.writeFileSync(DATA, serialize(ws));
}

function send(res, code, body, type = "application/json") {
  res.writeHead(code, {
    "Content-Type": type,
    "X-Signature": "Mourad.Soltani",
  });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

const engine = require("./src/engine");
const stripeRoutes = require("./src/stripe_routes");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname.startsWith("/api/")) {
    let ws = load();
    try {
      if (req.method === "GET" && url.pathname === "/api/health") {
        return send(res, 200, {
          ok: true,
          product: "ForgeHandoff",
          signature: "Mourad.Soltani",
          workspace: engine.workspaceHealth(ws),
        });
      }
      if (req.method === "GET" && url.pathname === "/api/workspace") {
        return send(res, 200, ws);
      }
      const body = req.method === "GET" ? {} : await readBody(req);
      if (req.method === "POST" && url.pathname === "/api/clients") {
        const c = engine.addClient(ws, body);
        save(ws);
        return send(res, 201, c);
      }
      if (req.method === "POST" && url.pathname === "/api/projects") {
        const p = engine.addProject(ws, body);
        save(ws);
        return send(res, 201, p);
      }
      if (req.method === "POST" && url.pathname === "/api/check") {
        const p = engine.toggleCheck(ws, body.projectId, body.itemId);
        save(ws);
        return send(res, 200, p);
      }
      if (req.method === "POST" && url.pathname === "/api/invoices") {
        const i = engine.addInvoice(ws, body);
        save(ws);
        return send(res, 201, i);
      }
      
      if (req.method === "POST" && url.pathname === "/api/billing/checkout") {
        return stripeRoutes.handleCheckout(req, res, body);
      }
      if (req.method === "POST" && url.pathname === "/api/billing/webhook") {
        return stripeRoutes.handleWebhook(req, res, JSON.stringify(body));
      }

      if (req.method === "POST" && url.pathname === "/api/invoices/paid") {
        const i = engine.markPaid(ws, body.invoiceId);
        save(ws);
        return send(res, 200, i);
      }
      return send(res, 404, { error: "Not found", signature: "Mourad.Soltani" });
    } catch (err) {
      return send(res, 400, { error: err.message, signature: "Mourad.Soltani" });
    }
  }

  let file = url.pathname === "/" ? "/index.html" : url.pathname;
  const abs = path.normalize(path.join(PUBLIC, file));
  if (!abs.startsWith(PUBLIC)) return send(res, 403, "Forbidden", "text/plain");
  fs.readFile(abs, (err, data) => {
    if (err) return send(res, 404, "Not found", "text/plain");
    send(res, 200, data, MIME[path.extname(abs)] || "application/octet-stream");
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`ForgeHandoff by Mourad.Soltani → http://127.0.0.1:${PORT}`);
  });
}

module.exports = { server };
