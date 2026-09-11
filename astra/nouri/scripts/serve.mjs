import http from "node:http";
import { createRequire } from "node:module";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const require = createRequire(import.meta.url);
const { createRequestHandler } = require("expo-server/adapter/http");
const client = resolve("dist/client"),
  handler = createRequestHandler({ build: resolve("dist/server") });
const types = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".json": "application/json",
};
const server = http.createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      ),
      file = resolve(client, `.${path}`);
    if (
      (req.method === "GET" || req.method === "HEAD") &&
      file.startsWith(client + sep)
    ) {
      try {
        const info = await stat(file);
        if (info.isFile()) {
          res.writeHead(200, {
            "Content-Type": types[extname(file)] || "application/octet-stream",
            "Cache-Control": path.startsWith("/_expo/")
              ? "public,max-age=31536000,immutable"
              : "public,max-age=3600",
            "X-Content-Type-Options": "nosniff",
          });
          if (req.method === "HEAD") res.end();
          else createReadStream(file).pipe(res);
          return;
        }
      } catch {}
    }
    await handler(req, res, (error) => {
      if (!res.headersSent) {
        res.writeHead(error ? 500 : 404, { "Content-Type": "text/plain" });
        res.end(
          error
            ? "Server error. Check your deployment configuration."
            : "Not found",
        );
      }
    });
  } catch {
    if (!res.headersSent) {
      res.writeHead(400);
      res.end("Invalid request");
    }
  }
});
const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () =>
  console.log(`Nouri production server: http://localhost:${port}`),
);
