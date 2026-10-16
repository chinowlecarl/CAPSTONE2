// routes/categories.cjs
//
// Product categories managed by the admin (replaces the hardcoded lists).
//
//   GET    /api/categories             public: [{ id, name, product_count }]
//   POST   /api/admin/categories       admin: { name }  -> add
//   PUT    /api/admin/categories/:id   admin: { name }  -> rename (products move to the new name)
//   DELETE /api/admin/categories/:id   admin: only when no product uses it
//
// Names: 2-30 characters, letters / numbers / spaces / & / - only. (The server's
// sanitize() strips quotes and semicolons from product categories, so allowing
// them here would make a category and its products drift apart.)
// "Tops" and "tops" are treated as the same category.

module.exports = function registerCategories(app, { supabase, auth, adminOnly }) {
  const NAME_RE = /^[\p{L}\p{N} &/-]{2,30}$/u;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const NAME_HELP = "Category name must be 2-30 characters: letters, numbers, spaces, & / or -";

  const clean = (v) => (typeof v === "string" ? v.normalize("NFC").trim().replace(/\s+/g, " ") : "");

  async function productCategoryCounts() {
    const counts = new Map();
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await supabase.from("products").select("category").order("id", { ascending: true }).range(from, from + 999);
      if (error) throw error;
      for (const row of data) {
        const key = String(row.category || "").trim().toLowerCase();
        if (key) counts.set(key, (counts.get(key) || 0) + 1);
      }
      if (data.length < 1000) break;
    }
    return counts;
  }

  async function countProductsIn(name) {
    // names cannot contain % or _, so ilike here is a plain case-insensitive match
    const { count, error } = await supabase.from("products").select("id", { count: "exact", head: true }).ilike("category", name);
    if (error) throw error;
    return count || 0;
  }

  // ── public list ────────────────────────────────────────────
  app.get("/api/categories", async (req, res) => {
    try {
      const { data, error } = await supabase.from("categories").select("id,name").order("name", { ascending: true });
      if (error) throw error;
      const counts = await productCategoryCounts();
      res.json(data.map((c) => ({ ...c, product_count: counts.get(c.name.toLowerCase()) || 0 })));
    } catch (err) {
      console.error(`[CATEGORIES LIST ERROR] ${err.message}`);
      res.status(500).json({ error: "Failed to load categories" });
    }
  });

  // ── add ────────────────────────────────────────────────────
  app.post("/api/admin/categories", auth, adminOnly, async (req, res) => {
    const name = clean(req.body?.name);
    if (!NAME_RE.test(name)) return res.status(400).json({ error: NAME_HELP });
    try {
      const { data, error } = await supabase.from("categories").insert([{ name, created_by: req.user.id }]).select("id,name").single();
      if (error) {
        if (error.code === "23505") return res.status(409).json({ error: `“${name}” already exists` });
        throw error;
      }
      res.status(201).json({ message: "Category added!", category: data });
    } catch (err) {
      console.error(`[CATEGORY ADD ERROR] ${err.message}`);
      res.status(500).json({ error: "Failed to add category" });
    }
  });

  // ── rename (atomic: also moves the products) ───────────────
  app.put("/api/admin/categories/:id", auth, adminOnly, async (req, res) => {
    const name = clean(req.body?.name);
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Category not found" });
    if (!NAME_RE.test(name)) return res.status(400).json({ error: NAME_HELP });
    try {
      const { data, error } = await supabase.rpc("rename_category", { p_id: req.params.id, p_name: name });
      if (error) {
        if (error.code === "P0002") return res.status(404).json({ error: "Category not found" });
        if (error.code === "23505") return res.status(409).json({ error: `“${name}” already exists` });
        throw error;
      }
      res.json({
        message: "Category renamed!",
        category: { id: data.id, name: data.name },
        previousName: data.old_name,
        productsUpdated: data.products_updated,
      });
    } catch (err) {
      console.error(`[CATEGORY RENAME ERROR] ${err.message}`);
      res.status(500).json({ error: "Failed to rename category" });
    }
  });

  // ── delete (blocked while products use it) ─────────────────
  app.delete("/api/admin/categories/:id", auth, adminOnly, async (req, res) => {
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Category not found" });
    try {
      const { data: cat, error: findErr } = await supabase.from("categories").select("id,name").eq("id", req.params.id).maybeSingle();
      if (findErr) throw findErr;
      if (!cat) return res.status(404).json({ error: "Category not found" });

      const used = await countProductsIn(cat.name);
      if (used > 0) {
        return res.status(409).json({
          error: `“${cat.name}” is used by ${used} product${used === 1 ? "" : "s"}. Move or delete those products first.`,
        });
      }
      const { error } = await supabase.from("categories").delete().eq("id", cat.id);
      if (error) throw error;
      res.json({ message: "Category deleted!", name: cat.name });
    } catch (err) {
      console.error(`[CATEGORY DELETE ERROR] ${err.message}`);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });
};
