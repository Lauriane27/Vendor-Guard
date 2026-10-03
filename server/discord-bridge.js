const clients = new Set();
let lastBeat = 0;

function send(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) client.write(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 65_536) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function pdfName(value) {
  const base = String(value ?? "").split(/[/\\]/).pop().trim();
  if (!base || base.length > 180 || !base.toLowerCase().endsWith(".pdf")) return "";
  return base;
}

export function discordBridge() {
  return {
    name: "discord-bridge",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];
        if (!url?.startsWith("/api/discord")) {
          next();
          return;
        }

        if (req.method === "GET" && url === "/api/discord/events") {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });
          res.write(": connected\n\n");
          clients.add(res);
          req.on("close", () => clients.delete(res));
          return;
        }

        if (req.method === "POST" && url === "/api/discord/heartbeat") {
          lastBeat = Date.now();
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        if (req.method === "GET" && url === "/api/discord/status") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ online: Date.now() - lastBeat < 12_000 }));
          return;
        }

        if (req.method === "POST" && url === "/api/discord/documents") {
          try {
            const body = JSON.parse((await readBody(req)) || "{}");
            const name = pdfName(body.name);
            const destination = ["internal", "vendor", "ask"].includes(body.destination) ? body.destination : "ask";
            const vendorName = String(body.vendorName ?? "").trim().slice(0, 120);
            if (!name) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: "A PDF file name is required." }));
              return;
            }
            if (destination === "vendor" && !vendorName) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: "Name the vendor for a contract PDF." }));
              return;
            }
            send({
              name,
              size: Number.isFinite(body.size) ? body.size : null,
              destination,
              vendorName,
              author: String(body.author ?? "").slice(0, 80),
            });
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true }));
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: "Could not read the document." }));
          }
          return;
        }

        res.statusCode = 404;
        res.end();
      });
    },
  };
}
