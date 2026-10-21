// routes/archive.cjs
//
// Archive (soft delete) for products.
//
//   DELETE /api/products/:id               admin: ARCHIVES the product (replaces the old hard delete)
//   GET    /api/admin/products/archived    admin: archived products with days remaining
//   POST   /api/admin/products/:id/restore admin: bring it back (only inside the 10-day window)
//
// After 10 days an archived product is deleted for good by the database job
// `purge_archived_products()` (pg_cron, daily). As a safety net this module also
// runs the same purge when an admin opens the Archive tab and every 6 hours while
// the server is awake, so it works even if pg_cron was never enabled.
//
// Register this route instead of adding a hard-delete handler for the same endpoint.
//
// Products that appear in past orders are never permanently deleted (that would
// break order history): they stay archived and hidden, and the Archive tab says so.

module.exports = function registerArchive(app, { supabase, auth, adminOnly }) {
  const RETENTION_DAYS = 10;
  const DAY = 24 * 60 * 60 * 1000;
  const HOUR = 60 * 60 * 1000;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // ── purge (same function the cron job runs) ────────────────
  let lastPurge = 0;
  async function purgeIfDue(force = false) {
    if (!force && Date.now() - lastPurge < 10 * 60 * 1000) return null;
    try {
      const { data, error } = await supabase.rpc("purge_archived_products", { p_days: RETENTION_DAYS });
      if (error) throw error;
      lastPurge = Date.now();
      return data;
    } catch (err) {
      console.error(`[ARCHIVE PURGE ERROR] ${err.message}`);
      throw err;
    }
  }
  const timer = setInterval(() => {
    purgeIfDue(true).catch((err) => console.error(`[ARCHIVE PURGE TIMER ERROR] ${err.message}`));
  }, 6 * HOUR);
  if (timer.unref) timer.unref();

  const windowInfo = (archivedAt) => {
    const msLeft = Date.parse(archivedAt) + RETENTION_DAYS * DAY - Date.now();
    return {
      daysLeft: Math.max(0, Math.ceil(msLeft / DAY)),
      hoursLeft: Math.max(0, Math.ceil(msLeft / HOUR)),
      deletesAt: new Date(Date.parse(archivedAt) + RETENTION_DAYS * DAY).toISOString(),
      expired: msLeft <= 0,
    };
  };

  // ── archive instead of delete ──────────────────────────────
  app.delete("/api/products/:id", auth, adminOnly, async (req, res) => {
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Product not found" });
    try {
      const { data: product, error: findErr } = await supabase.from("products").select("id,title,archived_at").eq("id", req.params.id).maybeSingle();
      if (findErr) throw findErr;
      if (!product) return res.status(404).json({ error: "Product not found" });
      if (product.archived_at) return res.status(409).json({ error: "This product is already archived" });

      const archivedAt = new Date().toISOString();
      const { error } = await supabase.from("products").update({ archived_at: archivedAt, archived_by: req.user.id }).eq("id", product.id);
      if (error) throw error;

      // Take it out of every cart so nobody can check out an archived item.
      const { error: cartErr } = await supabase.from("cart_items").delete().eq("product_id", product.id);
      if (cartErr) console.warn(`[ARCHIVE] could not clear carts for ${product.id}: ${cartErr.message}`);

      res.json({
        message: "Product archived",
        product: { id: product.id, title: product.title, archived_at: archivedAt },
        retentionDays: RETENTION_DAYS,
      });
    } catch (err) {
      console.error(`[ARCHIVE ERROR] ${err.message}`);
      res.status(500).json({ error: "Failed to archive product" });
    }
  });

  // ── archived list ──────────────────────────────────────────
  app.get("/api/admin/products/archived", auth, adminOnly, async (req, res) => {
    try {
      await purgeIfDue();

      const { data, error } = await supabase
        .from("products")
        .select("id,title,category,price,stock,archived_at,archived_by")
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false });
      if (error) throw error;

      const ids = data.map((p) => p.id);
      const inOrders = new Set();
      if (ids.length) {
          const { data: used, error: usedErr } = await supabase.from("order_items").select("product_id").in("product_id", ids);
          if (usedErr) throw usedErr;
          used.forEach((r) => inOrders.add(r.product_id));
      }

      const adminIds = [...new Set(data.map((p) => p.archived_by).filter(Boolean))];
      const names = new Map();
      if (adminIds.length) {
        const { data: who } = await supabase.from("profiles").select("id,username,fullname").in("id", adminIds);
        (who || []).forEach((w) => names.set(w.id, w.username || w.fullname));
      }

      res.json({
        retentionDays: RETENTION_DAYS,
        items: data.map((p) => ({
          ...p,
          archivedByName: names.get(p.archived_by) || null,
          inOrderHistory: inOrders.has(p.id),
          ...windowInfo(p.archived_at),
        })),
      });
    } catch (err) {
      console.error(`[ARCHIVE LIST ERROR] ${err.message}`);
      res.status(500).json({ error: "Failed to load archived products" });
    }
  });

  // ── restore ────────────────────────────────────────────────
  app.post("/api/admin/products/:id/restore", auth, adminOnly, async (req, res) => {
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Product not found" });
    try {
      const { data: product, error: findErr } = await supabase.from("products").select("id,title,archived_at").eq("id", req.params.id).maybeSingle();
      if (findErr) throw findErr;
      if (!product) return res.status(404).json({ error: "Product not found" });
      if (!product.archived_at) return res.status(409).json({ error: "This product is not archived" });
      if (windowInfo(product.archived_at).expired)
        return res.status(410).json({ error: `The ${RETENTION_DAYS}-day restore window for this product has ended` });

      const { error } = await supabase.from("products").update({ archived_at: null, archived_by: null }).eq("id", product.id);
      if (error) throw error;
      res.json({ message: "Product restored", product: { id: product.id, title: product.title } });
    } catch (err) {
      console.error(`[RESTORE ERROR] ${err.message}`);
      res.status(500).json({ error: "Failed to restore product" });
    }
  });

  return { purgeIfDue, RETENTION_DAYS };
};
