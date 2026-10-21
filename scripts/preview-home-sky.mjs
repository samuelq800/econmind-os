// Local-only preview of the exact static production build, with video byte ranges.
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";

const root = resolve("out");
if (!existsSync(`${root}/index.html`)) throw new Error("Build the static site first");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mp4": "video/mp4", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon" };
createServer((request, response) => {
  let target;
  try { target = resolve(root, `.${decodeURIComponent(new URL(request.url, "http://localhost").pathname)}`); }
  catch { response.writeHead(400).end(); return; }
  if (target !== root && !target.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  if (existsSync(target) && statSync(target).isDirectory()) target += "/index.html";
  if (!existsSync(target) || !statSync(target).isFile()) { response.writeHead(404).end(); return; }
  const size = statSync(target).size;
  const headers = { "Content-Type": types[extname(target)] || "application/octet-stream", "Accept-Ranges": "bytes", "Cache-Control": "no-store" };
  const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range || "");
  const start = match ? Number(match[1]) : 0;
  const end = match && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (start >= size || end < start) { response.writeHead(416, { "Content-Range": `bytes */${size}` }).end(); return; }
  response.writeHead(match ? 206 : 200, { ...headers, "Content-Length": end - start + 1, ...(match ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}) });
  if (request.method === "HEAD") response.end();
  else createReadStream(target, { start, end }).pipe(response);
}).listen(3052, "127.0.0.1", () => console.log("Home sky static preview: http://localhost:3052/"));
