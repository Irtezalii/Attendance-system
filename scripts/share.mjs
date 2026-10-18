#!/usr/bin/env node
// Temporary public link for testing: builds the app, serves the PRODUCTION build locally
// (never the dev server, which exposes project files), and opens a Cloudflare quick tunnel.
//
//   npm run share        (Ctrl+C stops everything)
//
// Uses the local D1 database (.wrangler/state), so the dev test accounts work.
// The link lives only while this runs; each run gets a new random URL.

import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

const PORT = 8787;
const children = [];

function stopAll(code = 0) {
  for (const child of children) {
    // On Windows, kill the whole tree (wrangler starts workerd as a grandchild).
    if (process.platform === "win32" && child.pid) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill();
  }
  process.exit(code);
}
process.on("SIGINT", () => stopAll(0));

const inUse = (port) =>
  new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1");
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("error", () => resolve(false));
  });

if (await inUse(5173)) {
  console.log("Note: `npm run dev` is running and shares the same local database. Stopping it while sharing is safer.\n");
}
if (await inUse(PORT)) {
  console.error(`Port ${PORT} is already in use. Stop whatever is using it and try again.`);
  process.exit(1);
}

console.log("1/3 Building the production version…");
if (spawnSync("npm run build", { shell: true, stdio: "inherit" }).status !== 0) process.exit(1);

console.log(`\n2/3 Starting the app on http://localhost:${PORT} …`);
const wrangler = spawn(
  process.execPath,
  // --persist-to: without it, Wrangler would create an empty database next to the built config.
  ["node_modules/wrangler/bin/wrangler.js", "dev", "-c", "dist/attendance_system/wrangler.json", "--persist-to", ".wrangler/state", "--port", String(PORT), "--ip", "127.0.0.1"],
  { stdio: ["ignore", "pipe", "pipe"] },
);
children.push(wrangler);
// Show server errors so problems are visible while sharing.
wrangler.stderr.on("data", (d) => /ERROR|Unhandled/.test(String(d)) && process.stderr.write(d));
await new Promise((resolve, reject) => {
  const onData = (d) => /Ready on/i.test(String(d)) && resolve();
  wrangler.stdout.on("data", onData);
  wrangler.stderr.on("data", onData);
  wrangler.once("exit", (code) => reject(new Error(`wrangler dev exited (${code})`)));
}).catch((e) => (console.error(e.message), stopAll(1)));

console.log("3/3 Opening the Cloudflare tunnel…");
const tunnel = spawn("cloudflared", ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${PORT}`], { stdio: ["ignore", "pipe", "pipe"] });
children.push(tunnel);
tunnel.once("error", () => {
  console.error("Could not start cloudflared. Install it from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/");
  stopAll(1);
});
let shown = false;
const findUrl = (d) => {
  const text = String(d);
  if (/failed to request quick Tunnel/i.test(text)) {
    console.error("Cloudflare's quick-tunnel service did not respond. Wait a minute and run `npm run share` again.");
    stopAll(1);
  }
  const url = /https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/.exec(text)?.[0];
  if (url && !shown) {
    shown = true;
    console.log(`\n  Share this link:  ${url}\n`);
    console.log("  Test logins (password: password123)");
    console.log("    Student: ali.hassan@student.ubit.test   (Evening: rehan.akbar@student.ubit.test)");
    console.log("    Faculty: test.alpha@faculty.ubit.test\n");
    console.log("  The link works while this window stays open. Press Ctrl+C to stop.\n");
  }
};
tunnel.stdout.on("data", findUrl);
tunnel.stderr.on("data", findUrl);
for (const child of children) child.once("exit", () => stopAll(0));
