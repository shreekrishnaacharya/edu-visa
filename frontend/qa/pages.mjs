// Headless QA harness. Logs in through the real API, injects the tokens the app
// expects in localStorage, then drives each page over the Chrome DevTools
// Protocol and reports what the DOM actually contains plus any console errors.
//
// Run: node qa-browser.mjs            (checks every page)
//      node qa-browser.mjs <path>     (one page, dumps visible text)
import { spawn } from "child_process";
import axios from "axios";
import WebSocket from "ws";

const API = process.env.API || "http://localhost:3000";
const WEB = process.env.WEB || "http://localhost:5173";
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  "/usr/bin/google-chrome",
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--window-size=1500,2400",
    "about:blank",
  ],
  { stdio: "ignore" },
);
process.on("exit", () => chrome.kill());

async function findPageTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const { data } = await axios.get(`http://127.0.0.1:${PORT}/json/list`);
      const p = data.find((t) => t.type === "page");
      if (p?.webSocketDebuggerUrl) return p;
    } catch {}
    await sleep(300);
  }
  throw new Error("Chrome did not expose a page target");
}

class Session {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.consoleErrors = [];
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
      if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        this.consoleErrors.push(
          msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(" ").slice(0, 300),
        );
      }
      if (msg.method === "Runtime.exceptionThrown") {
        this.consoleErrors.push(
          "UNCAUGHT: " +
            (msg.params.exceptionDetails?.exception?.description ??
              msg.params.exceptionDetails?.text ??
              "unknown").slice(0, 300),
        );
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`${method} timed out`));
        }
      }, 30000);
    });
  }
  async evaluate(expression) {
    const r = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return r.result?.value;
  }
  async goto(path) {
    this.consoleErrors = [];
    await this.send("Page.navigate", { url: `${WEB}${path}` });
    // Let the SPA mount, fetch, and settle.
    await sleep(1200);
    for (let i = 0; i < 20; i++) {
      const busy = await this.evaluate(
        `!!document.querySelector('.MuiCircularProgress-root, .MuiLinearProgress-root')`,
      );
      if (!busy) break;
      await sleep(500);
    }
    await sleep(600);
  }
  text() {
    return this.evaluate(`document.body.innerText`);
  }
}

async function main() {
  const target = await findPageTarget();
  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((r) => ws.on("open", r));
  const s = new Session(ws);
  await s.send("Page.enable");
  await s.send("Runtime.enable");

  // Real login, then plant exactly what authProvider stores.
  const { data: login } = await axios.post(`${API}/auth/login`, {
    email: "admin@edu-visa.local",
    password: "password123",
  });
  await s.send("Page.navigate", { url: WEB });
  await sleep(1200);
  await s.evaluate(`
    localStorage.setItem('ev-auth', ${JSON.stringify(login.access_token)});
    localStorage.setItem('ev-refresh', ${JSON.stringify(login.refresh_token)});
    localStorage.setItem('ev-user', ${JSON.stringify(
      JSON.stringify({
        id: login.user.id,
        name: login.user.full_name || login.user.email,
        role: login.user.role,
        branch: login.user.branch || "",
        avatar: "",
      }),
    )});
    'ok'
  `);

  // Real ids to build detail URLs with.
  const h = { Authorization: `Bearer ${login.access_token}` };
  const { data: unis } = await axios.get(
    `${API}/universities?_start=0&_end=1&name_like=New South Wales`,
    { headers: h },
  );
  const uni = unis.elements[0];
  const { data: pols } = await axios.get(`${API}/admission/institutions`, { headers: h });
  // A row with no CRICOS registry fields, to exercise the "not a register
  // record" explanation. Curtin College is the remaining one by design: it is a
  // Navitas pathway college, not Curtin University, so it was deliberately not
  // merged into the register row (see seed/merge-aggregator-duplicates.ts).
  const { data: aggUnis } = await axios.get(
    `${API}/universities?_start=0&_end=1&name_like=Curtin College`,
    { headers: h },
  );
  const aggUni = aggUnis.elements[0];
  if (!aggUni) throw new Error("no non-register university row found to test against");
  const { data: cqus } = await axios.get(
    `${API}/universities?_start=0&_end=1&cricos_provider_code_like=00219C`,
    { headers: h },
  );
  const cqu = cqus.elements[0];
  if (!cqu) throw new Error("CQU (00219C) not found — needed for the multi-campus check");
  const { data: courses } = await axios.get(`${API}/courses?_start=0&_end=1`, { headers: h });
  const course = courses.elements[0];
  const { data: runs } = await axios.get(`${API}/data-sync/runs?limit=1`, { headers: h });
  const { data: students } = await axios.get(`${API}/students?_start=0&_end=1`, { headers: h });
  const student = students.elements[0];

  const single = process.argv[2];
  const pages = single
    ? [{ name: single, path: single }]
    : [
        { name: "university detail", path: `/universities/${uni.id}`,
          expect: ["Provider type", "Government", "CRICOS provider code", "00098G",
                   "Registered address", "Kensington", "Courses", "Website"] },
        { name: "university list", path: "/universities",
          expect: ["Provider type", "Auto-sourcing", "Name contains", "Courses"] },
        { name: "admission policy list", path: "/admission",
          expect: ["Admission policies", "institutions with a policy", "Central Queensland"] },
        { name: "admission policy detail", path: `/admission/${pols[0].key}`,
          expect: ["Academic & English entry bands", "Financial requirements", "Applicant rules"] },
        { name: "catalogue", path: "/catalogue",
          expect: ["University / college", "Field contains", "Level"] },
        { name: "data sync", path: "/data-sync",
          expect: ["Institutions", "Courses", "Missing English band", "Recent runs"] },
        { name: "requirement sources", path: "/data-sync/sources",
          expect: ["Courses with a sourced English band", "cannot be auto-sourced", "pages tracked"] },
        { name: "curation start", path: "/data-sync/curation",
          expect: ["What are you curating", "Sessions in progress"] },
        { name: "university detail (non-register row)", path: `/universities/${aggUni.id}`,
          expect: ["Not a CRICOS register record", "Courses"] },
        { name: "university detail (multi-campus)", path: `/universities/${cqu.id}`,
          expect: ["Campuses", "registered locations", "primary", "Rockhampton", "Melbourne"] },
        { name: "all admission policies", path: "__ALL_POLICIES__" },
        { name: "course edit", path: `/catalogue/${course.id}/edit`, expect: ["Course"] },
        { name: "cricos wizard", path: "/data-sync/cricos",
          expect: ["Source", "Re-check records older than", "Fetch & compare"] },
        { name: "sync run detail", path: runs[0] ? `/data-sync/runs/${runs[0].id}` : "/data-sync",
          expect: ["Log"] },
        { name: "students list", path: "/students", expect: [] },
        { name: "student detail", path: `/students/${student.id}`, expect: [] },
        { name: "match result", path: `/students/${student.id}/matches`, expect: [] },
      ];

  const expanded = [];
  for (const p of pages) {
    if (p.path === "__ALL_POLICIES__") {
      for (const pol of pols) {
        expanded.push({
          name: `policy: ${pol.key}`,
          path: `/admission/${pol.key}`,
          expect: ["Academic & English entry bands", "Scholarships", "Financial requirements"],
        });
      }
    } else expanded.push(p);
  }

  const report = [];
  for (const p of expanded) {
    await s.goto(p.path);
    const body = (await s.text()) || "";
    if (single) {
      console.log(`===== ${p.path} =====\n${body}\n`);
      if (s.consoleErrors.length) console.log("CONSOLE ERRORS:\n" + s.consoleErrors.join("\n"));
      continue;
    }
    const missing = (p.expect ?? []).filter((e) => !body.toLowerCase().includes(e.toLowerCase()));
    // Signatures that mean something is broken regardless of the page.
    const flags = [];
    const redFlags = [
      ["validation error leaked to UI", /must not be (greater|less) than|should not be empty|must be a (number|string|boolean|UUID)|Bad Request/i],
      ["raw 'undefined' rendered", /\bundefined\b/],
      ["NaN rendered", /\bNaN\b/],
      ["Invalid Date", /Invalid Date/],
      ["raw object rendered", /\[object Object\]/],
      ["500/server error text", /Internal server error|statusCode/i],
    ];
    for (const [label, re] of redFlags) if (re.test(body)) flags.push(label);
    report.push({
      page: p.name,
      path: p.path,
      chars: body.length,
      missing,
      flags,
      blank: body.trim().length < 400,
      consoleErrors: [...new Set(s.consoleErrors)].slice(0, 4),
    });
  }

  if (!single) {
    console.log("\n================ BROWSER QA ================");
    for (const r of report) {
      const bad = r.blank || r.missing.length || r.consoleErrors.length || r.flags.length;
      console.log(`\n${bad ? "✗" : "✓"} ${r.page}  (${r.path})  ${r.chars} chars`);
      if (r.blank) console.log("    PAGE RENDERED BLANK");
      if (r.missing.length) console.log("    MISSING FROM DOM: " + r.missing.join(" | "));
      for (const f of r.flags) console.log("    RED FLAG: " + f);
      for (const e of r.consoleErrors) console.log("    CONSOLE: " + e);
    }
    const failed = report.filter(
      (r) => r.blank || r.missing.length || r.consoleErrors.length || r.flags.length,
    ).length;
    console.log(`\n${report.length - failed}/${report.length} pages clean`);
  }
  ws.close();
  chrome.kill();
  process.exit(0);
}

main().catch((e) => {
  console.error("HARNESS ERROR:", e.message);
  chrome.kill();
  process.exit(1);
});
