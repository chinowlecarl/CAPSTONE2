// routes/activity.cjs
//
// Activity log for customers AND admins (separate from order transactions).
//
//  1. A middleware watches every API request. When a request that matches one
//     of the RULES below succeeds, one row is written to `activity_logs`
//     (who, what, when, from which IP). New routes can be covered by adding a rule.
//  2. POST /api/activity/event      -> the browser reports LOGIN / LOGOUT (whitelisted)
//  3. GET  /api/admin/activity      -> the admin "Activity Log" page
//
// Accounts are logged by a database trigger in the Supabase admin-features migration.
//
// Privacy: request bodies are never stored. Only the small `summary`/`details`
// built by each rule are saved: no passwords, payment proofs, addresses or images.
// Logging can never break a request: every failure is caught and only warned.

module.exports = function registerActivity(app, { supabase, auth, adminOnly }) {
  const TABLE = "activity_logs";

  const short = (id) => (id ? String(id).slice(0, 8).toUpperCase() : "");
  const clip = (s, n) => (typeof s === "string" ? s.slice(0, n) : null);
  const peso = (n) => `₱${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Every action the system can write (also used to validate the admin filter).
  // PRODUCT_DELETED and USER_STATUS_CHANGED are kept so old log rows still show up in the filter.
  const ACTIONS = [
    "ACCOUNT_CREATED", "LOGIN", "LOGOUT", "PROFILE_UPDATED", "PASSWORD_CHANGED", "PASSWORD_CHANGE_FAILED",
    "ORDER_PLACED", "ORDER_CANCELLED", "PAYMENT_SUBMITTED",
    "ORDER_STATUS_CHANGED", "PAYMENT_APPROVED", "PAYMENT_REJECTED", "PAYMENT_PROOF_VIEWED",
    "PRODUCT_CREATED", "PRODUCT_UPDATED", "PRODUCT_ARCHIVED", "PRODUCT_RESTORED", "PRODUCT_PURGED", "PRODUCT_DELETED",
    "CATEGORY_CREATED", "CATEGORY_RENAMED", "CATEGORY_DELETED",
    "USER_SUSPENDED", "USER_ACTIVATED", "USER_STATUS_CHANGED",
  ];

  // ctx: { p: regex groups from the URL, body: request body, out: JSON the route replied with, pre: lookup done before the route ran }
  const RULES = [
    { m: "POST", re: /^\/api\/products$/, action: "PRODUCT_CREATED", entity: "product",
      entityId: (c) => c.out?.product?.id,
      summary: (c) => `Added product “${c.out?.product?.title ?? "?"}”` },

    { m: "PUT", re: /^\/api\/products\/([^/]+)$/, action: "PRODUCT_UPDATED", entity: "product",
      entityId: (c) => c.p[0],
      summary: (c) => `Updated product “${c.out?.product?.title ?? short(c.p[0])}”` },

    // DELETE /api/products/:id now ARCHIVES the product (see routes/archive.cjs)
    { m: "DELETE", re: /^\/api\/products\/([^/]+)$/, action: "PRODUCT_ARCHIVED", entity: "product",
      entityId: (c) => c.p[0],
      summary: (c) => `Archived product “${c.out?.product?.title ?? short(c.p[0])}” (can be restored for 10 days)` },

    { m: "POST", re: /^\/api\/admin\/products\/([^/]+)\/restore$/, action: "PRODUCT_RESTORED", entity: "product",
      entityId: (c) => c.p[0],
      summary: (c) => `Restored product “${c.out?.product?.title ?? short(c.p[0])}” from the archive` },

    { m: "POST", re: /^\/api\/orders$/, action: "ORDER_PLACED", entity: "order",
      entityId: (c) => c.out?.order?.id,
      summary: (c) => `Placed order #${short(c.out?.order?.id)}${c.out?.order?.total_amount != null ? ` (${peso(c.out.order.total_amount)})` : ""}` },

    { m: "PUT", re: /^\/api\/orders\/([^/]+)$/, action: "ORDER_CANCELLED", entity: "order",
      entityId: (c) => c.p[0],
      summary: (c) => `Cancelled order #${short(c.p[0])}` },

    { m: "PUT", re: /^\/api\/orders\/([^/]+)\/payment$/, action: "PAYMENT_SUBMITTED", entity: "order",
      entityId: (c) => c.p[0],
      summary: (c) => `Submitted ${["GCASH", "MAYA"].includes(c.body?.payment_method) ? c.body.payment_method : ""} payment for order #${short(c.p[0])}`.replace("  ", " "),
      details: (c) => (["GCASH", "MAYA"].includes(c.body?.payment_method) ? { method: c.body.payment_method } : null) },

    { m: "PUT", re: /^\/api\/admin\/orders\/([^/]+)$/, action: "ORDER_STATUS_CHANGED", entity: "order",
      entityId: (c) => c.p[0],
      summary: (c) => `Changed order #${short(c.p[0])} to ${c.body?.status}`,
      details: (c) => ({ status: c.body?.status }) },

    { m: "PUT", re: /^\/api\/admin\/orders\/([^/]+)\/verify-payment$/, entity: "order",
      action: (c) => (c.body?.decision === "approve" ? "PAYMENT_APPROVED" : "PAYMENT_REJECTED"),
      entityId: (c) => c.p[0],
      summary: (c) => `${c.body?.decision === "approve" ? "Approved" : "Rejected"} the payment for order #${short(c.p[0])}` },

    { m: "GET", re: /^\/api\/admin\/orders\/([^/]+)\/payment-proof$/, action: "PAYMENT_PROOF_VIEWED", entity: "order",
      entityId: (c) => c.p[0],
      summary: (c) => `Viewed the payment proof for order #${short(c.p[0])}` },

    // Who did it = the actor columns. Which user = entity_id + details.target. When = created_at.
    { m: "PUT", re: /^\/api\/admin\/users\/([^/]+)\/status$/, entity: "user",
      action: (c) => (c.body?.status === "suspended" ? "USER_SUSPENDED" : "USER_ACTIVATED"),
      entityId: (c) => c.p[0],
      summary: (c) => `${c.body?.status === "suspended" ? "Suspended" : "Activated"} user ${c.out?.user?.username ?? short(c.p[0])}`,
      details: (c) => ({
        status: c.body?.status,
        target: { id: c.p[0], username: c.out?.user?.username ?? null, name: c.out?.user?.fullname ?? null },
      }) },

    { m: "PUT", re: /^\/api\/me$/, action: "PROFILE_UPDATED", entity: "user",
      summary: () => "Updated their profile details" },

    { m: "POST", re: /^\/api\/account\/change-password$/, action: "PASSWORD_CHANGED", entity: "user",
      summary: (c) => (c.out?.otherSessionsSignedOut ? "Changed their password (other devices signed out)" : "Changed their password") },

    { m: "POST", re: /^\/api\/admin\/categories$/, action: "CATEGORY_CREATED", entity: "category",
      entityId: (c) => c.out?.category?.id,
      summary: (c) => `Added category “${c.out?.category?.name}”` },

    { m: "PUT", re: /^\/api\/admin\/categories\/([^/]+)$/, action: "CATEGORY_RENAMED", entity: "category",
      entityId: (c) => c.p[0],
      summary: (c) => `Renamed category “${c.out?.previousName}” to “${c.out?.category?.name}”`,
      details: (c) => ({ from: c.out?.previousName, to: c.out?.category?.name, productsUpdated: c.out?.productsUpdated ?? 0 }) },

    { m: "DELETE", re: /^\/api\/admin\/categories\/([^/]+)$/, action: "CATEGORY_DELETED", entity: "category",
      entityId: (c) => c.p[0],
      summary: (c) => `Deleted category “${c.out?.name}”` },
  ];

  function matchRule(method, path) {
    for (const rule of RULES) {
      if (rule.m !== method) continue;
      const hit = path.match(rule.re);
      if (hit) return { rule, p: hit.slice(1) };
    }
    return null;
  }

  const actorFields = (req) => ({
    actor_id: req.user?.id ?? null,
    actor_name: req.user?.username || req.user?.email || "unknown",
    actor_role: req.user?.role ?? null,
    ip: clip(req.ip, 64),
    user_agent: clip(req.headers?.["user-agent"], 200),
  });

  // Never throws. Returns true when the row was saved.
  async function write(entry) {
    try {
      const { error } = await supabase.from(TABLE).insert([entry]);
      if (error) {
        console.warn(`[ACTIVITY LOG] could not save "${entry.action}": ${error.message}`);
        return false;
      }
      return true;
    } catch (err) {
      console.warn(`[ACTIVITY LOG] could not save "${entry.action}": ${err.message}`);
      return false;
    }
  }

  // ── 1. automatic request logging ───────────────────────────
  async function middleware(req, res, next) {
    let hit = null;
    try {
      const path = (req.originalUrl || req.url).split("?")[0].replace(/\/+$/, "") || "/";
      hit = matchRule(req.method, path);
    } catch (_) { /* ignore */ }
    if (!hit) return next();

    const ctx = { p: hit.p, pre: null, out: null, body: req.body };

    // A few actions (like delete) need the thing's name BEFORE it disappears.
    if (hit.rule.before && req.headers.authorization) {
      try { ctx.pre = await hit.rule.before(ctx); } catch (_) { /* ignore */ }
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      ctx.out = body;
      return originalJson(body);
    };

    res.on("finish", () => {
      try {
        if (res.statusCode >= 400 || !req.user) return;
        const { rule } = hit;
        ctx.body = req.body;
        const action = typeof rule.action === "function" ? rule.action(ctx) : rule.action;
        const details = rule.details ? rule.details(ctx) : null;
        write({
          ...actorFields(req),
          action,
          entity_type: rule.entity ?? null,
          entity_id: rule.entityId ? clip(String(rule.entityId(ctx) ?? ""), 100) || null : null,
          summary: clip(rule.summary(ctx), 300),
          details: details && Object.keys(details).length ? details : null,
        });
      } catch (err) {
        console.warn(`[ACTIVITY LOG] ${err.message}`);
      }
    });

    next();
  }
  app.use(middleware);

  // ── 2. login / logout reported by the browser ──────────────
  const CLIENT_EVENTS = { LOGIN: "Signed in", LOGOUT: "Signed out" };

  app.post("/api/activity/event", auth, async (req, res) => {
    const action = String(req.body?.action || "");
    if (!CLIENT_EVENTS[action]) return res.status(400).json({ error: "Unknown event" });
    await write({ ...actorFields(req), action, entity_type: "user", entity_id: req.user.id, summary: CLIENT_EVENTS[action] });
    res.json({ ok: true });
  });

  // ── 3. admin: read the log ─────────────────────────────────
  const YMD = /^\d{4}-\d{2}-\d{2}$/;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const manilaStartUtc = (ymd) => new Date(Date.parse(`${ymd}T00:00:00Z`) - 8 * 3600 * 1000).toISOString();
  const nextDay = (ymd) => new Date(Date.parse(`${ymd}T00:00:00Z`) + 24 * 3600 * 1000).toISOString().slice(0, 10);

  app.get("/api/admin/activity", auth, adminOnly, async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(10, parseInt(req.query.pageSize, 10) || 50));
    const { role, action, q, from, to, actor } = req.query;

    try {
      let query = supabase
        .from(TABLE)
        .select("id,created_at,actor_id,actor_name,actor_role,action,entity_type,entity_id,summary,details,ip", { count: "exact" });

      if (role === "admin" || role === "customer" || role === "system") query = query.eq("actor_role", role);
      if (ACTIONS.includes(action)) query = query.eq("action", action);
      if (UUID.test(actor || "")) query = query.eq("actor_id", actor);
      if (YMD.test(from || "")) query = query.gte("created_at", manilaStartUtc(from));
      if (YMD.test(to || "")) query = query.lt("created_at", manilaStartUtc(nextDay(to)));

      if (q) {
        // strip characters that have meaning inside a PostgREST filter string
        const term = String(q).replace(/[^\p{L}\p{N} @._#-]/gu, "").trim().slice(0, 60);
        if (term) query = query.or(`actor_name.ilike.%${term}%,summary.ilike.%${term}%`);
      }

      const start = (page - 1) * pageSize;
      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(start, start + pageSize - 1);
      if (error) throw error;

      res.json({ rows: data, total: count ?? 0, page, pageSize, actions: ACTIONS });
    } catch (err) {
      console.error(`[ACTIVITY READ ERROR] ${err.message}`);
      res.status(500).json({ error: "Failed to load the activity log" });
    }
  });

  return { write, actorFields, ACTIONS };
};
