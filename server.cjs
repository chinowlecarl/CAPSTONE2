// ============================================================
// FITCHEQUE - Node.js + Express Backend
// Database: Supabase (PostgreSQL)
// ============================================================
// SETUP STEPS:
//   1. Go to supabase.com → create free account → new project
//   2. Settings → API → copy "Project URL" and "anon/public" key
//   3. Paste them below in SUPABASE_URL and SUPABASE_KEY
//   4. Supabase → SQL Editor → paste and run the SQL at the bottom
//   5. In terminal: npm install
//   6. node server.js
// ============================================================

const express = require("express");
const cors    = require("cors");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());
app.use(cors());

// Root health check
app.get("/", (req, res) => {
  res.json({ message: "FITCHEQUE API is running! 🚀", status: "ok", version: "1.0.0" });
});

// ── PASTE YOUR SUPABASE CREDENTIALS HERE ─────────────────────

const SUPABASE_URL = "https://ibivuhadbvxwciiwgfgy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliaXZ1aGFkYnZ4d2NpaXdnZmd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDU3NTYsImV4cCI6MjA4OTQyMTc1Nn0.RxlNlmIgHDU8-QIhTU2kEWn7LAczMYrOVxU8ukfVlXk";
const JWT_SECRET   = "fitcheque_secret_2025";
// ─────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── JWT Middleware ────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Invalid token" }); }
}
function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

// ============================================================
// AUTH
// ============================================================

// POST /api/register
app.post("/api/register", async (req, res) => {
  const { fullname, username, email, password, phone, address } = req.body;
  if (!fullname || !username || !email || !password)
    return res.status(400).json({ error: "All fields required" });
  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  try {
    const { data: existing } = await supabase
      .from("users").select("id")
      .or(`username.eq.${username},email.eq.${email}`);
    if (existing?.length > 0)
      return res.status(400).json({ error: "Username or email already exists" });

    const hashed = await bcrypt.hash(password, 12);
    const { data, error } = await supabase.from("users")
      .insert([{ fullname, username, email, password: hashed, phone: phone || null, address: address || null, role: "customer", status: "active" }])
      .select().single();
    if (error) throw error;

    const token = jwt.sign({ id: data.id, username: data.username, role: data.role }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ message: "Registered!", token, user: { id: data.id, fullname: data.fullname, username: data.username, email: data.email, phone: data.phone, address: data.address, role: data.role } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username and password required" });
  try {
    const { data: user } = await supabase.from("users").select("*")
      .or(`username.eq.${username},email.eq.${username}`)
      .eq("status", "active").single();
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ message: "Login successful!", token, user: { id: user.id, fullname: user.fullname, username: user.username, email: user.email, phone: user.phone, address: user.address, role: user.role } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/me
app.get("/api/me", auth, async (req, res) => {
  try {
    const { data, error } = await supabase.from("users")
      .select("id,fullname,username,email,phone,address,role,status,created_at")
      .eq("id", req.user.id).single();
    if (error || !data) return res.status(404).json({ error: "User not found" });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/me
app.put("/api/me", auth, async (req, res) => {
  const { fullname, phone, address } = req.body;
  try {
    const { data, error } = await supabase.from("users")
      .update({ fullname, phone, address }).eq("id", req.user.id)
      .select("id,fullname,username,email,phone,address,role,status").single();
    if (error) throw error;
    res.json({ message: "Profile updated!", user: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// PRODUCTS
// ============================================================

// GET /api/products?category=Tops&search=dress
app.get("/api/products", async (req, res) => {
  const { category, search } = req.query;
  try {
    let q = supabase.from("products").select("*").eq("status", "active").order("created_at", { ascending: false });
    if (category && category !== "All") q = q.eq("category", category);
    if (search) q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/products/featured
app.get("/api/products/featured", async (req, res) => {
  try {
    const { data, error } = await supabase.from("products").select("*")
      .eq("status", "active").eq("featured", true)
      .order("created_at", { ascending: false }).limit(8);
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/products/:id
app.get("/api/products/:id", async (req, res) => {
  try {
    const { data, error } = await supabase.from("products").select("*").eq("id", req.params.id).single();
    if (error || !data) return res.status(404).json({ error: "Product not found" });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/products  (admin)
app.post("/api/products", auth, adminOnly, async (req, res) => {
  const { title, description, price, discount, category, image_url, stock, featured } = req.body;
  if (!title || !price || !category) return res.status(400).json({ error: "Title, price, category required" });
  try {
    const { data, error } = await supabase.from("products")
      .insert([{ title, description, price, discount: discount || 0, category, image_url, stock: stock || 0, featured: featured || false, status: "active" }])
      .select().single();
    if (error) throw error;
    res.status(201).json({ message: "Product added!", product: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/products/:id  (admin)
app.put("/api/products/:id", auth, adminOnly, async (req, res) => {
  const { title, description, price, discount, category, image_url, stock, featured } = req.body;
  try {
    const { data, error } = await supabase.from("products")
      .update({ title, description, price, discount, category, image_url, stock, featured })
      .eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ message: "Product updated!", product: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/products/:id  (admin)
app.delete("/api/products/:id", auth, adminOnly, async (req, res) => {
  try {
    const { error } = await supabase.from("products").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ message: "Product deleted!" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// CART
// ============================================================

// GET /api/cart
app.get("/api/cart", auth, async (req, res) => {
  try {
    const { data, error } = await supabase.from("cart_items")
      .select("*, products(*)").eq("user_id", req.user.id);
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/cart
app.post("/api/cart", auth, async (req, res) => {
  const { product_id, quantity } = req.body;
  try {
    const { data: existing } = await supabase.from("cart_items").select("*")
      .eq("user_id", req.user.id).eq("product_id", product_id).single();
    if (existing) {
      const { data, error } = await supabase.from("cart_items")
        .update({ quantity: existing.quantity + (quantity || 1) })
        .eq("id", existing.id).select().single();
      if (error) throw error;
      return res.json({ message: "Cart updated!", item: data });
    }
    const { data, error } = await supabase.from("cart_items")
      .insert([{ user_id: req.user.id, product_id, quantity: quantity || 1 }])
      .select().single();
    if (error) throw error;
    res.status(201).json({ message: "Added to cart!", item: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/cart/:id
app.put("/api/cart/:id", auth, async (req, res) => {
  const { quantity } = req.body;
  try {
    if (quantity < 1) {
      await supabase.from("cart_items").delete().eq("id", req.params.id);
      return res.json({ message: "Item removed" });
    }
    const { data, error } = await supabase.from("cart_items")
      .update({ quantity }).eq("id", req.params.id).eq("user_id", req.user.id)
      .select().single();
    if (error) throw error;
    res.json({ message: "Updated!", item: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/cart/:id
app.delete("/api/cart/:id", auth, async (req, res) => {
  try {
    const { error } = await supabase.from("cart_items").delete()
      .eq("id", req.params.id).eq("user_id", req.user.id);
    if (error) throw error;
    res.json({ message: "Removed!" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/cart  (clear all)
app.delete("/api/cart", auth, async (req, res) => {
  try {
    await supabase.from("cart_items").delete().eq("user_id", req.user.id);
    res.json({ message: "Cart cleared!" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// ORDERS
// ============================================================

// GET /api/orders
app.get("/api/orders", auth, async (req, res) => {
  try {
    const { data, error } = await supabase.from("orders")
      .select("*, order_items(*, products(*))")
      .eq("user_id", req.user.id).order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/orders  (checkout)
app.post("/api/orders", auth, async (req, res) => {
  const { shipping_address } = req.body;
  try {
    const { data: cart } = await supabase.from("cart_items")
      .select("*, products(*)").eq("user_id", req.user.id);
    if (!cart?.length) return res.status(400).json({ error: "Cart is empty" });

    const total = cart.reduce((s, i) => {
      const p = i.products;
      const price = p.discount > 0 ? p.price * (1 - p.discount / 100) : p.price;
      return s + price * i.quantity;
    }, 0);

    const { data: order, error: oErr } = await supabase.from("orders")
      .insert([{ user_id: req.user.id, total_amount: total, shipping_address: shipping_address || "", status: "pending" }])
      .select().single();
    if (oErr) throw oErr;

    await supabase.from("order_items").insert(
      cart.map(i => ({
        order_id: order.id, product_id: i.product_id, quantity: i.quantity,
        unit_price: i.products.discount > 0 ? i.products.price * (1 - i.products.discount / 100) : i.products.price
      }))
    );

    await supabase.from("cart_items").delete().eq("user_id", req.user.id);
    res.status(201).json({ message: "Order placed!", order });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// ADMIN
// ============================================================

// GET /api/admin/users
app.get("/api/admin/users", auth, adminOnly, async (req, res) => {
  try {
    const { data, error } = await supabase.from("users")
      .select("id,fullname,username,email,phone,address,role,status,created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/stats
app.get("/api/admin/stats", auth, adminOnly, async (req, res) => {
  try {
    const [p, u, o, ls] = await Promise.all([
      supabase.from("products").select("id", { count: "exact" }),
      supabase.from("users").select("id", { count: "exact" }).eq("role", "customer"),
      supabase.from("orders").select("id,total_amount", { count: "exact" }),
      supabase.from("products").select("id", { count: "exact" }).lt("stock", 5)
    ]);
    res.json({
      total_products: p.count || 0,
      total_customers: u.count || 0,
      total_orders: o.count || 0,
      total_revenue: o.data?.reduce((s, x) => s + Number(x.total_amount), 0) || 0,
      low_stock: ls.count || 0
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// ADMIN — EXTENDED ROUTES
// ============================================================

// GET /api/admin/orders  — all orders with user + items
app.get("/api/admin/orders", auth, adminOnly, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*, users(id,fullname,email,username), order_items(*, products(title))")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/admin/orders/:id  — update order status
app.put("/api/admin/orders/:id", auth, adminOnly, async (req, res) => {
  const { status } = req.body;
  const allowed = ["pending","confirmed","shipped","delivered","cancelled"];
  if (!allowed.includes(status))
    return res.status(400).json({ error: "Invalid status" });
  try {
    const { data, error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", req.params.id)
      .select().single();
    if (error) throw error;
    res.json({ message: "Status updated!", order: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/users/:id/orders  — orders for a specific customer
app.get("/api/admin/users/:id/orders", auth, adminOnly, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*, products(title))")
      .eq("user_id", req.params.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/admin/users/:id/status  — suspend or activate a user
app.put("/api/admin/users/:id/status", auth, adminOnly, async (req, res) => {
  const { status } = req.body;
  if (!["active","suspended"].includes(status))
    return res.status(400).json({ error: "Invalid status" });
  try {
    const { data, error } = await supabase
      .from("users")
      .update({ status })
      .eq("id", req.params.id)
      .select("id,fullname,username,email,role,status").single();
    if (error) throw error;
    res.json({ message: "User status updated!", user: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// START
// ============================================================
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`\n✅  FITCHEQUE backend running → http://localhost:${PORT}\n`);
  console.log("  POST  /api/register");
  console.log("  POST  /api/login");
  console.log("  GET   /api/me           (auth)");
  console.log("  PUT   /api/me           (auth)");
  console.log("  GET   /api/products");
  console.log("  POST  /api/products     (admin)");
  console.log("  PUT   /api/products/:id (admin)");
  console.log("  DEL   /api/products/:id (admin)");
  console.log("  GET   /api/cart         (auth)");
  console.log("  POST  /api/cart         (auth)");
  console.log("  PUT   /api/cart/:id     (auth)");
  console.log("  DEL   /api/cart/:id     (auth)");
  console.log("  GET   /api/orders       (auth)");
  console.log("  POST  /api/orders       (auth)");
  console.log("  GET   /api/admin/users           (admin)");
  console.log("  GET   /api/admin/stats           (admin)");  console.log("  GET   /api/admin/orders          (admin)");  console.log("  PUT   /api/admin/orders/:id      (admin)");  console.log("  GET   /api/admin/users/:id/orders(admin)");  console.log("  PUT   /api/admin/users/:id/status(admin)\n");
});
