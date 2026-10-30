// Role-based A-Z HTTP smoke: logs in as every role (cookie sessions) and exercises
// each dashboard's core workflow against a running server.
// Usage: node smoke.js  (optional SMOKE_BASE, default http://localhost:3100)
const B = process.env.SMOKE_BASE || "http://localhost:3100";
let fail = 0;
async function step(name, fn) {
  try {
    const r = await fn();
    console.log(`ok   ${name} ${r ?? ""}`);
  } catch (e) {
    fail++;
    console.log(`FAIL ${name}: ${e.message}`);
  }
}
async function req(method, path, { cookie, body, actor } = {}) {
  const r = await fetch(`${B}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...(actor ? { "x-actor": actor } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, json: j };
}
async function loginCookie(email) {
  const r = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "demo1234" }) });
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(`login ${email} -> ${r.status} ${j.error || ""}`);
  const sc = r.headers.get("set-cookie");
  if (!sc) throw new Error("no session cookie issued");
  return { role: j.data.role, cookie: sc.split(";")[0] };
}
function need(status, json, want = 200) {
  if (status !== want || (want === 200 && json.ok === false)) throw new Error(`want ${want}, got ${status} ${JSON.stringify(json).slice(0, 160)}`);
  return json.data;
}

(async () => {
  try {
    await main();
  } catch (e) {
    fail++;
    console.log(`FAIL (fatal): ${e.message}`);
  }
  console.log(fail === 0 ? "SMOKE PASS" : `SMOKE FAIL (${fail})`);
  process.exit(fail === 0 ? 0 : 1);
})();

async function main() {
  // ---- Admin: user management + guards ----
  const admin = await loginCookie("super@demo.local");
  await step("admin login role=super_admin", async () => { if (admin.role !== "super_admin") throw new Error(admin.role); return admin.role; });
  await step("admin lists users", async () => {
    const { status, json } = await req("GET", "/api/admin/users", { cookie: admin.cookie });
    const users = need(status, json);
    if (!Array.isArray(users)) throw new Error("expected array");
    if (!users.some((u) => u.email === "dispatch@demo.local")) throw new Error("seed user missing");
    if (users.some((u) => "passwordHash" in u)) throw new Error("passwordHash leaked!");
    return `${users.length} users, no hashes`;
  });
  await step("admin suspend+reactivate citizen (audited)", async () => {
    const list = (await req("GET", "/api/admin/users", { cookie: admin.cookie })).json.data;
    const c = list.find((u) => u.email === "citizen@demo.local");
    let r = await req("PATCH", `/api/admin/users/${c.id}`, { cookie: admin.cookie, body: { status: "suspended" } });
    need(r.status, r.json);
    if (r.json.data.status !== "suspended") throw new Error("not suspended");
    r = await req("PATCH", `/api/admin/users/${c.id}`, { cookie: admin.cookie, body: { status: "active" } });
    need(r.status, r.json);
    return "suspended then active";
  });
  await step("dispatcher forbidden from admin API (403)", async () => {
    const d = await loginCookie("dispatch@demo.local");
    const r = await req("GET", "/api/admin/users", { cookie: d.cookie });
    if (r.status !== 403) throw new Error(`want 403, got ${r.status}`);
    return "403 ok";
  });
  await step("signed-out approve rejected (401)", async () => {
    const r = await req("POST", "/api/assignments/INC-DEMO-001/approve", { body: {} });
    if (r.status !== 401) throw new Error(`want 401, got ${r.status}`);
    return "401 ok";
  });

  // ---- Citizen: report + track ----
  const citizen = await loginCookie("citizen@demo.local");
  let myCode = "";
  await step("citizen creates incident", async () => {
    const r = await req("POST", "/api/incidents", { cookie: citizen.cookie, body: { category: "cardiac", priority: "urgent", contactPhone: "+91-90000-00002", addressText: "Nungambakkam (SIMULATED)", requiredCapabilities: [] } });
    const d = need(r.status, r.json, 201);
    myCode = d.code;
    return myCode;
  });
  await step("citizen tracks incident", async () => {
    const r = await req("GET", `/api/incidents/${myCode}`, { cookie: citizen.cookie });
    const d = need(r.status, r.json);
    if (d.incident.code !== myCode) throw new Error("wrong incident");
    return `status=${d.incident.status}`;
  });

  // ---- Dispatcher: recommend -> propose -> approve (+dup guard) ----
  const disp = await loginCookie("dispatch@demo.local");
  await step("recommend ranks AMB-B #1, excludes AMB-C", async () => {
    const r = await req("GET", "/api/dispatch/recommend", { cookie: disp.cookie });
    const d = need(r.status, r.json);
    if (d.top3[0].vehicleId !== "AMB-B") throw new Error("top pick is " + d.top3[0].vehicleId);
    if (!d.candidates.find((c) => c.vehicleId === "AMB-C" && !c.eligible)) throw new Error("AMB-C not excluded");
    return `top=${d.top3[0].vehicleId} eta=${d.top3[0].etaSec}s`;
  });
  await step("propose+approve AMB-B", async () => {
    let r = await req("POST", "/api/assignments", { cookie: disp.cookie, actor: "dispatcher", body: { incidentCode: "INC-DEMO-001", strategy: "capability-filtered-traffic-aware" } });
    need(r.status, r.json, 201);
    r = await req("POST", "/api/assignments/INC-DEMO-001/approve", { cookie: disp.cookie, actor: "dispatcher", body: {} });
    return need(r.status, r.json).vehicleId;
  });
  await step("duplicate propose blocked", async () => {
    const r = await req("POST", "/api/assignments", { cookie: disp.cookie, body: { incidentCode: "INC-DEMO-001" } });
    if (r.status !== 409) throw new Error(`want 409, got ${r.status}`);
    return "409 ok";
  });

  // ---- Driver: ack + status chain ----
  const driver = await loginCookie("driver-b@demo.local");
  await step("driver ack + chain to athospital", async () => {
    let r = await req("POST", "/api/assignments/INC-DEMO-001/acknowledge", { cookie: driver.cookie, actor: "driver", body: { accept: true } });
    need(r.status, r.json);
    for (const to of ["enroute", "onscene", "onboard", "athospital"]) {
      r = await req("PATCH", "/api/incidents/INC-DEMO-001/status", { cookie: driver.cookie, actor: "driver", body: { to } });
      need(r.status, r.json);
    }
    return "athospital";
  });

  // ---- Closure reroute + simulation compare ----
  await step("closure reroute stays valid", async () => {
    const r = await req("POST", "/api/routes", { cookie: disp.cookie, actor: "dispatcher", body: { incidentCode: "INC-DEMO-001", closures: ["seg-a3-congested"] } });
    const d = need(r.status, r.json);
    const route = d.route || Object.values(d.recommend.routes)[0];
    if (!route || route.valid === false) throw new Error("route invalid after closure");
    await req("POST", "/api/routes", { cookie: disp.cookie, actor: "dispatcher", body: { incidentCode: "INC-DEMO-001", closures: [] } });
    const c = await req("GET", "/api/simulation/scenario", { cookie: disp.cookie });
    need(c.status, c.json);
    return `cost=${route.costSec}s nodes=${route.nodesExplored}`;
  });

  // ---- EMT: handover notify ----
  const emt = await loginCookie("emt@demo.local");
  await step("EMT handover notify", async () => {
    const r = await req("POST", "/api/handover/notify", { cookie: emt.cookie, actor: "emt", body: { incidentCode: "INC-DEMO-001", vitals: { pulse: "92" }, note: "smoke" } });
    return need(r.status, r.json).status;
  });

  // ---- Hospital: bed accept + handover ack, then complete ----
  const hosp = await loginCookie("hosp@demo.local");
  await step("hospital accept + ack, incident completed", async () => {
    let r = await req("POST", "/api/handover/ack?kind=bed", { cookie: hosp.cookie, actor: "hospital_coordinator", body: { incidentCode: "INC-DEMO-001", decision: "accept" } });
    need(r.status, r.json);
    r = await req("POST", "/api/handover/ack", { cookie: hosp.cookie, actor: "hospital_coordinator", body: { incidentCode: "INC-DEMO-001", decision: "accept" } });
    need(r.status, r.json);
    r = await req("PATCH", "/api/incidents/INC-DEMO-001/status", { cookie: driver.cookie, actor: "driver", body: { to: "handover" } });
    need(r.status, r.json);
    r = await req("PATCH", "/api/incidents/INC-DEMO-001/status", { cookie: driver.cookie, actor: "driver", body: { to: "completed" } });
    need(r.status, r.json);
    return "completed";
  });

  // ---- Admin sees audit + analytics + export ----
  await step("analytics + audit + export", async () => {
    let r = await req("GET", "/api/analytics/summary", { cookie: admin.cookie });
    const a = need(r.status, r.json);
    r = await req("GET", "/api/analytics/audit", { cookie: admin.cookie });
    const u = need(r.status, r.json);
    const csv = await fetch(`${B}/api/analytics/export`);
    if (!csv.ok || !(await csv.text()).includes("incidents")) throw new Error("csv bad");
    if (!u.some((e) => e.action === "assignment.approved")) throw new Error("approval missing from audit");
    return `incidents=${a.totals.incidents} audit=${u.length}`;
  });

  await step("fleet register + status + guard", async () => {
    let r = await req("POST", "/api/fleet", { cookie: disp.cookie, actor: "dispatcher", body: { vehicleId: "AMB-X", type: "NEONATAL", capabilities: ["oxygen", "incubator"], nodeId: "HOSP" } });
    need(r.status, r.json, 201);
    r = await req("PATCH", "/api/fleet", { cookie: disp.cookie, actor: "dispatcher", body: { vehicleId: "AMB-X", status: "maintenance" } });
    need(r.status, r.json);
    if (r.json.data.status !== "maintenance") throw new Error("status not applied");
    r = await req("POST", "/api/fleet", { cookie: disp.cookie, body: { vehicleId: "AMB-X", type: "BLS", capabilities: [], nodeId: "N1" } });
    if (r.status !== 409) throw new Error(`dup fleet want 409, got ${r.status}`);
    return "AMB-X registered + stood down";
  });

  await step("comms note lands in audit timeline", async () => {
    let r = await req("POST", "/api/comms", { cookie: disp.cookie, actor: "dispatcher", body: { incidentCode: "INC-DEMO-001", kind: "note", text: "smoke check note" } });
    need(r.status, r.json);
    r = await req("GET", "/api/analytics/audit", { cookie: admin.cookie });
    const u = need(r.status, r.json);
    if (!u.some((e) => e.action === "comms.note")) throw new Error("comms missing from audit");
    return "audited";
  });

  await step("RF tree-path traces real trees (or skips on old ML build)", async () => {
    const r = await req("POST", "/api/ml/tree-path", { cookie: disp.cookie, body: { vehicle_count: 150, avg_speed: 10, hour: 9, n_trees: 2 } });
    if (r.status === 200) {
      const d = need(r.status, r.json);
      const p0 = d.paths[0];
      if (!p0 || !p0.nodes.length || !["vehicle_count", "avg_speed", "hour"].includes(p0.nodes[0].feature)) throw new Error("bad tree path");
      return `class=${d.class} depth=${p0.nodes.length}`;
    }
    if ([502, 503, 404].includes(r.status)) return `SKIP (ML service predates tree-path: ${r.status})`;
    throw new Error(`unexpected ${r.status}: ${JSON.stringify(r.json).slice(0, 120)}`);
  });

  await step("hospital match trace is eligible with human gate", async () => {
    const r = await req("GET", "/api/incidents/INC-DEMO-001", { cookie: disp.cookie });
    const d = need(r.status, r.json);
    const m = d.hospitalMatch;
    if (!m || !m.eligible || m.steps.length !== 5) throw new Error("bad hospital match");
    if (m.humanDecision !== "accept") throw new Error("expected recorded accept, got " + m.humanDecision);
    return `${m.hospital} eligible, decided: ${m.humanDecision}`;
  });
}
