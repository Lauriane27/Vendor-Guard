import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "vendguard.py");

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error("The review request is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export function reviewBridge() {
  return {
    name: "review-bridge",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== "/api/review") {
          next();
          return;
        }
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ ok: false, error: "Use POST." }));
          return;
        }

        let body;
        try {
          body = await readBody(req);
        } catch (error) {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, error: error.message }));
          return;
        }

        const child = spawn("python", [script], { cwd: root, windowsHide: true });
        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => child.kill(), 300_000);
        child.stdout.on("data", (chunk) => {
          stdout += chunk;
        });
        child.stderr.on("data", (chunk) => {
          stderr += chunk;
        });
        child.stdin.write(body);
        child.stdin.end();
        child.on("error", (error) => {
          clearTimeout(timer);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: `Could not start vendguard.py. ${error.message}` }));
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          if (res.writableEnded) return;
          res.setHeader("Content-Type", "application/json");
          if (code !== 0) {
            res.statusCode = 502;
            res.end(JSON.stringify({ ok: false, error: stderr.trim() || `vendguard.py exited with code ${code}.` }));
            return;
          }
          try {
            JSON.parse(stdout);
          } catch {
            res.statusCode = 502;
            res.end(JSON.stringify({ ok: false, error: "vendguard.py did not return JSON." }));
            return;
          }
          res.end(stdout);
        });
      });
    },
  };
}
