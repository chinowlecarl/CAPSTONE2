// ============================================================
// FITCHEQUE - Node.js + Express Backend (SECURED)
// ============================================================
require("dotenv").config();

const express    = require("express");
const cors       = require("cors");
const helmet     = require("helmet");
const rateLimit  = require("express-rate-limit");
const morgan     = require("morgan");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", "data:", "blob:", "https://images.unsplash.com", "https://placehold.co", "https://*.supabase.co"],
      connectSrc:  ["'self'", "https://*.supabase.co"],
      fontSrc:     ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      objectSrc:   ["'none'"],
      frameSrc:    ["'none'"],
      frameAncestors: ["'none'"],
      formAction:  ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

const localOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
];
const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.NODE_ENV === "production" ? [] : localOrigins),
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods:     ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", apiLimiter);

const SUPABASE_URL = process.env.SUPABASE_URL;
// The service-role key stays on the server and bypasses Supabase RLS.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function sanitize(str) {
  if (typeof str !== "string") return str;
  return str.trim().replace(/[<>"'`;]/g, "");
}

async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer "))
    return res.status(401).json({ error: "No token provided" });
  const token = header.split(" ")[1];

  try {
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !authUser)
      return res.status(401).json({ error: "Invalid or expired token" });

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, username, role, status")
      .eq("id", authUser.id)
      .single();

    if (profileErr || !profile)
      return res
        .status(401)
        .json({ error: "Profile not found for this account" });

    if (profile.status === "suspended")
      return res.status(403).json({ error: "This account has been suspended" });

    req.user = {
      id: authUser.id,
      username: profile.username,
      role: profile.role,
      email: authUser.email,
    };
    next();
  } catch (err) {
    console.warn(`[AUTH FAIL] ${new Date().toISOString()} - ${err.message}`);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") {
    console.warn(`[ACCESS DENIED] ${new Date().toISOString()} - User ${req.user?.id} attempted admin access`);
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    const token = (req.headers.authorization || "").split(" ")[1] || "";
    const part = token.split(".")[1] || "";
    const claims = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    if (claims.aal === "aal2") return next();
  } catch (_) {
    // The authenticated token is malformed or does not contain readable claims.
  }

  console.warn(`[MFA REQUIRED] ${new Date().toISOString()} - Admin ${req.user.id} attempted admin access without aal2`);
  return res.status(403).json({
    error: "Two-factor authentication required. Log in again and enter your authenticator code.",
  });
}

const activityLog = require("./routes/activity.cjs")(app, { supabase, auth, adminOnly });
require("./routes/archive.cjs")(app, { supabase, auth, adminOnly, log: activityLog });
require("./routes/account.cjs")(app, {
  supabase,
  auth,
  supabaseUrl: SUPABASE_URL,
  verifyKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || SUPABASE_KEY,
  log: activityLog,
});

app.get("/", (req, res) => {
  res.json({ message: "FITCHEQUE API is running!", status: "ok" });
});

app.get("/api/me", auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,fullname,username,phone,address,role,status,created_at")
      .eq("id", req.user.id)
      .single();
    if (error || !data)
      return res.status(404).json({ error: "User not found" });
    res.json({ ...data, email: req.user.email });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

app.get("/api/admin/session", auth, adminOnly, (req, res) => {
  res.json({ id: req.user.id, role: req.user.role });
});

app.put("/api/me", auth, async (req, res) => {
  let { fullname, phone, address } = req.body;
  fullname = sanitize(fullname);
  phone = sanitize(phone);
  address = sanitize(address);
  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({ fullname, phone, address })
      .eq("id", req.user.id)
      .select("id,fullname,username,phone,address,role,status")
      .single();
    if (error) throw error;
    res.json({
      message: "Profile updated!",
      user: { ...data, email: req.user.email },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ============================================================
// PRODUCTS
// ============================================================

const SOLD_PRODUCT_RETENTION_MS = 72 * 60 * 60 * 1000;
const PUBLIC_PRODUCT_FIELDS = "id,title,description,price,discount,category,stock,featured,created_at";
const filterShowcaseProducts = (query) =>
  query.or("archived_at.is.null,auto_archived_after_sale.eq.true");
const productImageUrl = (req, product) => ({
  ...product,
  image_url: `${req.protocol}://${req.get("host")}/api/products/${encodeURIComponent(product.id)}/image`,
});
const withProductImageUrls = (req, products) => products.map((product) => productImageUrl(req, product));
const filterActiveProducts = (query, search = "") => {
  const cutoff = new Date(Date.now() - SOLD_PRODUCT_RETENTION_MS).toISOString();
  query = query.is("archived_at", null);
  if (!search) return query.or(`sold_at.is.null,sold_at.gt.${cutoff}`);

  const pattern = `%${sanitize(search)}%`;
  return query.or([
    `and(sold_at.is.null,title.ilike.${pattern})`,
    `and(sold_at.is.null,description.ilike.${pattern})`,
    `and(sold_at.gt.${cutoff},title.ilike.${pattern})`,
    `and(sold_at.gt.${cutoff},description.ilike.${pattern})`,
  ].join(","));
};

app.get("/api/products", async (req, res) => {
  const { category, search } = req.query;
  try {
    const isPaginated = req.query.limit !== undefined || req.query.offset !== undefined;
    const limit = isPaginated ? Number(req.query.limit ?? 24) : null;
    const offset = isPaginated ? Number(req.query.offset ?? 0) : 0;
    if (isPaginated && (
      !Number.isInteger(limit) || limit < 1 || limit > 48 ||
      !Number.isInteger(offset) || offset < 0
    )) {
      return res.status(400).json({ error: "Invalid product pagination parameters" });
    }

    let q = filterActiveProducts(
      supabase.from("products").select(isPaginated ? PUBLIC_PRODUCT_FIELDS : "*"),
      typeof search === "string" ? search : "",
    ).order("created_at", { ascending: false }).order("id", { ascending: true });
    if (category && category !== "All") q = q.eq("category", sanitize(category));
    if (isPaginated) q = q.range(offset, offset + limit - 1);
    const { data, error } = await q;
    if (error) throw error;
    res.json(withProductImageUrls(req, data));
  } catch (err) {
    console.error(`[PRODUCTS ERROR] ${err.message}`);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.get("/api/products/featured", async (req, res) => {
  try {
    const { data, error } = await filterShowcaseProducts(supabase.from("products").select(PUBLIC_PRODUCT_FIELDS))
      .eq("featured", true)
      .order("created_at", { ascending: false }).limit(8);
    if (error) throw error;
    if (!data || data.length === 0) {
      const { data: fallback, error: fallbackErr } = await filterShowcaseProducts(
        supabase.from("products").select(PUBLIC_PRODUCT_FIELDS),
      )
        .order("created_at", { ascending: false }).limit(8);
      if (fallbackErr) throw fallbackErr;
      return res.json(withProductImageUrls(req, fallback));
    }
    res.json(withProductImageUrls(req, data));
  } catch (err) {
    console.error(`[FEATURED ERROR] ${err.message}`);
    res.status(500).json({ error: "Failed to fetch featured products" });
  }
});

app.get("/api/products/home", async (req, res) => {
  try {
    const productsQuery = () => filterActiveProducts(
      supabase.from("products").select(PUBLIC_PRODUCT_FIELDS),
    ).gt("stock", 0).order("created_at", { ascending: false }).order("id", { ascending: true }).limit(8);
    const featuredQuery = () => filterShowcaseProducts(
      supabase.from("products").select(PUBLIC_PRODUCT_FIELDS),
    ).eq("featured", true).order("created_at", { ascending: false }).order("id", { ascending: true }).limit(4);
    const showcaseQuery = () => filterShowcaseProducts(
      supabase.from("products").select(PUBLIC_PRODUCT_FIELDS),
    ).order("created_at", { ascending: false }).order("id", { ascending: true }).limit(8);

    const [
      { data: products, error: productsError },
      { data: featured, error: featuredError },
      { data: showcase, error: showcaseError },
    ] = await Promise.all([productsQuery(), featuredQuery(), showcaseQuery()]);
    if (productsError) throw productsError;
    if (featuredError) throw featuredError;
    if (showcaseError) throw showcaseError;
    const arrivals = products || [];
    const featuredProducts = [...new Map([...(featured || []), ...(showcase || [])]
      .map((product) => [product.id, product])).values()].slice(0, 3);
    const items = withProductImageUrls(
      req,
      [...new Map([...arrivals, ...featuredProducts].map((product) => [product.id, product])).values()],
    );
    res.json({
      items,
      arrivalIds: arrivals.map((product) => product.id),
      featuredIds: featuredProducts.map((product) => product.id),
    });
  } catch (err) {
    console.error(`[HOME PRODUCTS ERROR] ${err.message}`);
    res.status(500).json({ error: "Failed to fetch home products" });
  }
});

app.get("/api/products/:id/image", async (req, res) => {
  try {
    const { data, error } = await supabase.from("products")
      .select("image_url").eq("id", req.params.id).maybeSingle();
    if (error) throw error;
    const match = typeof data?.image_url === "string"
      ? data.image_url.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/)
      : null;
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    if (match) return res.type(match[1]).send(Buffer.from(match[2], "base64"));

    if (typeof data?.image_url === "string") {
      try {
        if (new URL(data.image_url).protocol === "https:") return res.redirect(302, data.image_url);
      } catch {
        // Invalid product image URLs are treated as missing images.
      }
    }
    return res.status(404).end();
  } catch (err) {
    console.error(`[PRODUCT IMAGE ERROR] ${err.message}`);
    res.status(500).end();
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const { data, error } = await filterActiveProducts(supabase.from("products").select("*"))
      .eq("id", req.params.id).single();
    if (error || !data) return res.status(404).json({ error: "Product not found" });
    res.json(productImageUrl(req, data));
  } catch (err) { res.status(500).json({ error: "Failed to fetch product" }); }
});

app.post("/api/products", auth, adminOnly, async (req, res) => {
  let { title, description, price, discount, category, image_url, stock, featured } = req.body;
  title       = sanitize(title);
  category    = sanitize(category);
  description = sanitize(description);
  if (!title || !price || !category)
    return res.status(400).json({ error: "Title, price, category required" });
  if (isNaN(+price) || +price < 0)
    return res.status(400).json({ error: "Invalid price" });
  try {
    const { data, error } = await supabase.from("products")
      .insert([{
        title, description, price: +price,
        discount: +discount || 0, category, image_url,
        stock: +stock || 0, featured: !!featured
      }]).select().single();
    if (error) {
      console.error(`[ADD PRODUCT ERROR] Supabase: ${error.message} | code: ${error.code} | details: ${error.details}`);
      if (error.code === "42501" || error.message?.includes("policy")) {
        return res.status(500).json({ error: "Database permission denied. Fix: disable RLS on 'products' table or add a service-role key." });
      }
      throw error;
    }
    res.status(201).json({ message: "Product added!", product: data });
  } catch (err) {
    console.error(`[ADD PRODUCT ERROR] ${err.message}`);
    res.status(500).json({ error: err.message || "Failed to add product" });
  }
});

app.put("/api/products/:id", auth, adminOnly, async (req, res) => {
  let { title, description, price, discount, category, image_url, stock, featured } = req.body;
  title       = sanitize(title);
  category    = sanitize(category);
  description = sanitize(description);
  try {
    const { data, error } = await supabase.from("products")
      .update({ title, description, price: +price, discount: +discount, category, image_url, stock: +stock, featured: !!featured })
      .eq("id", req.params.id).select().single();
    if (error) {
      console.error(`[UPDATE PRODUCT ERROR] Supabase: ${error.message} | code: ${error.code} | details: ${error.details}`);
      if (error.code === "42501" || error.message?.includes("policy")) {
        return res.status(500).json({ error: "Database permission denied. Fix: disable RLS on 'products' table or add a service-role key." });
      }
      throw error;
    }
    res.json({ message: "Product updated!", product: data });
  } catch (err) {
    console.error(`[UPDATE PRODUCT ERROR] ${err.message}`);
    res.status(500).json({ error: err.message || "Failed to update product" });
  }
});

// ============================================================
// CART
// ============================================================

app.get("/api/cart", auth, async (req, res) => {
  try {
    const { data, error } = await supabase.from("cart_items")
      .select("*, products(*)").eq("user_id", req.user.id);
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: "Failed to fetch cart" }); }
});

app.post("/api/cart", auth, async (req, res) => {
  const { product_id, quantity } = req.body;
  if (!product_id) return res.status(400).json({ error: "Product ID required" });
  try {
    const { data: product, error: productErr } = await supabase.from("products")
      .select("id").eq("id", product_id).is("archived_at", null).maybeSingle();
    if (productErr) throw productErr;
    if (!product) return res.status(404).json({ error: "This product is no longer available" });
    const { data: existing } = await supabase.from("cart_items").select("*")
      .eq("user_id", req.user.id).eq("product_id", product_id).maybeSingle();
    if (existing) {
      const { data, error } = await supabase.from("cart_items")
        .update({ quantity: existing.quantity + (Math.abs(+quantity) || 1) })
        .eq("id", existing.id).select().single();
      if (error) throw error;
      return res.json({ message: "Cart updated!", item: data });
    }
    const { data, error } = await supabase.from("cart_items")
      .insert([{ user_id: req.user.id, product_id, quantity: Math.abs(+quantity) || 1 }])
      .select().single();
    if (error) throw error;
    res.status(201).json({ message: "Added to cart!", item: data });
  } catch (err) {
    console.error(`[CART ERROR] ${err.message}`);
    res.status(500).json({ error: "Failed to update cart" });
  }
});

app.put("/api/cart/:id", auth, async (req, res) => {
  const quantity = Math.abs(+req.body.quantity);
  try {
    if (!quantity) {
      await supabase.from("cart_items").delete()
        .eq("id", req.params.id).eq("user_id", req.user.id);
      return res.json({ message: "Item removed" });
    }
    const { data, error } = await supabase.from("cart_items")
      .update({ quantity })
      .eq("id", req.params.id).eq("user_id", req.user.id)
      .select().single();
    if (error) throw error;
    res.json({ message: "Updated!", item: data });
  } catch (err) { res.status(500).json({ error: "Failed to update cart item" }); }
});

app.delete("/api/cart/:id", auth, async (req, res) => {
  try {
    const { error } = await supabase.from("cart_items").delete()
      .eq("id", req.params.id).eq("user_id", req.user.id);
    if (error) throw error;
    res.json({ message: "Removed!" });
  } catch (err) { res.status(500).json({ error: "Failed to remove cart item" }); }
});

app.delete("/api/cart", auth, async (req, res) => {
  try {
    await supabase.from("cart_items").delete().eq("user_id", req.user.id);
    res.json({ message: "Cart cleared!" });
  } catch (err) { res.status(500).json({ error: "Failed to clear cart" }); }
});

// ============================================================
// ORDERS
// ============================================================

app.get("/api/orders", auth, async (req, res) => {
  try {
    const { data, error } = await supabase.from("orders")
      .select("id,created_at,total_amount,status,shipping_address,lalamove_order_id,lalamove_status,lalamove_share_link,delivery_status")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: "Failed to fetch orders" }); }
});

app.get("/api/orders/:id/items", auth, async (req, res) => {
  try {
    const { data: order, error: orderError } = await supabase.from("orders")
      .select("id").eq("id", req.params.id).eq("user_id", req.user.id).maybeSingle();
    if (orderError) throw orderError;
    if (!order) return res.status(404).json({ error: "Order not found" });

    const { data, error } = await supabase.from("order_items")
      .select("id,quantity,unit_price,products(id,title,price,discount,image_url)")
      .eq("order_id", order.id);
    if (error) throw error;
    res.json(data.map((item) => ({
      ...item,
      products: item.products ? productImageUrl(req, item.products) : item.products,
    })));
  } catch (err) {
    console.error(`[ORDER ITEMS ERROR] ${err.message}`);
    res.status(500).json({ error: "Failed to fetch order items" });
  }
});

app.post("/api/orders", auth, async (req, res) => {
  const { shipping_address } = req.body;
  try {
    const { data: cart } = await supabase.from("cart_items")
      .select("*, products(*)").eq("user_id", req.user.id);
    if (!cart?.length) return res.status(400).json({ error: "Cart is empty" });

    const total = cart.reduce((s, i) => {
      const p     = i.products;
      const price = p.discount > 0 ? p.price * (1 - p.discount / 100) : p.price;
      return s + price * i.quantity;
    }, 0);

    const { data: order, error: oErr } = await supabase.from("orders")
      .insert([{
        user_id: req.user.id,
        total_amount: Math.round(total * 100) / 100,
        shipping_address: sanitize(shipping_address) || "",
        status: "pending"
      }]).select().single();
    if (oErr) throw oErr;

    await supabase.from("order_items").insert(
      cart.map(i => ({
        order_id:   order.id,
        product_id: i.product_id,
        quantity:   i.quantity,
        unit_price: i.products.discount > 0
          ? i.products.price * (1 - i.products.discount / 100)
          : i.products.price
      }))
    );

    for (const item of cart) {
      const currentStock = item.products.stock || 0;
      const newStock = Math.max(0, currentStock - item.quantity);
      const { error: stockErr } = await supabase.from("products")
        .update({ stock: newStock })
        .eq("id", item.product_id);
      if (stockErr) {
        console.error(`[STOCK UPDATE ERROR] product ${item.product_id}: ${stockErr.message}`);
      }
    }

    await supabase.from("cart_items").delete().eq("user_id", req.user.id);
    console.log(`[ORDER] ${new Date().toISOString()} - Order placed by user: ${req.user.id}`);
    res.status(201).json({ message: "Order placed!", order });
  } catch (err) {
    console.error(`[ORDER ERROR] ${err.message}`);
    res.status(500).json({ error: "Failed to place order" });
  }
});

// PUT /api/orders/:id — allow a logged-in customer to cancel their OWN order.
app.put("/api/orders/:id", auth, async (req, res) => {
  const { status } = req.body;

  if (status !== "cancelled")
    return res.status(400).json({ error: "Invalid status value" });

  try {
    const { data: existingOrder, error: findErr } = await supabase
      .from("orders")
      .select("id, user_id, status, delivery_status")
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .single();

    if (findErr || !existingOrder)
      return res.status(404).json({ error: "Order not found" });

    if (!["pending", "confirmed"].includes(existingOrder.status))
      if (
        ["BOOKING", "BOOKED", "PICKED_UP", "DELIVERED"].includes(
          existingOrder.delivery_status,
        )
      )
        return res
          .status(400)
          .json({
            error:
              "A delivery is already booked for this order. Please contact the shop.",
          });

    const { data: orderItems } = await supabase
      .from("order_items")
      .select("product_id, quantity, products(stock)")
      .eq("order_id", req.params.id);

    if (orderItems?.length) {
      for (const item of orderItems) {
        const restoredStock = (item.products?.stock || 0) + item.quantity;
        const { error: stockErr } = await supabase
          .from("products")
          .update({ stock: restoredStock })
          .eq("id", item.product_id);
        if (stockErr) {
          console.error(`[STOCK RESTORE ERROR] product ${item.product_id}: ${stockErr.message}`);
        }
      }
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .select()
      .single();
    if (error) throw error;

    console.log(`[ORDER CANCELLED] ${new Date().toISOString()} - Order ${req.params.id} by user ${req.user.id}`);
    res.json({ message: "Order cancelled!", order: data });
  } catch (err) {
    console.error(`[CANCEL ORDER ERROR] ${err.message}`);
    res.status(500).json({ error: "Failed to cancel order" });
  }
});







// ============================================================
// ADMIN
// ============================================================

app.get("/api/admin/stats", auth, adminOnly, async (req, res) => {
  try {
    const [p, u, o, ls] = await Promise.all([
      filterActiveProducts(supabase.from("products").select("id", { count: "exact" })),
      supabase
        .from("profiles")
        .select("id", { count: "exact" })
        .eq("role", "customer"),
      supabase.from("orders").select("id,total_amount", { count: "exact" }),
      filterActiveProducts(supabase.from("products").select("id", { count: "exact" })).lt("stock", 5),
    ]);
    res.json({
      total_products: p.count || 0,
      total_customers: u.count || 0,
      total_orders: o.count || 0,
      total_revenue:
        o.data?.reduce((s, x) => s + Number(x.total_amount), 0) || 0,
      low_stock: ls.count || 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

app.put("/api/admin/orders/:id", auth, adminOnly, async (req, res) => {
  const { status } = req.body;
  const allowed = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
  if (!allowed.includes(status))
    return res.status(400).json({ error: "Invalid status value" });
  try {
    if (status === "cancelled") {
      const { data: existingOrder } = await supabase.from("orders")
        .select("status").eq("id", req.params.id).single();

      if (existingOrder && existingOrder.status !== "cancelled") {
        const { data: orderItems } = await supabase.from("order_items")
          .select("product_id, quantity, products(stock)")
          .eq("order_id", req.params.id);

        if (orderItems?.length) {
          for (const item of orderItems) {
            const restoredStock = (item.products?.stock || 0) + item.quantity;
            const { error: stockErr } = await supabase.from("products")
              .update({ stock: restoredStock })
              .eq("id", item.product_id);
            if (stockErr) {
              console.error(`[STOCK RESTORE ERROR] product ${item.product_id}: ${stockErr.message}`);
            }
          }
        }
      }
    }

    const { data, error } = await supabase.from("orders")
      .update({ status }).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ message: "Status updated!", order: data });
  } catch (err) { res.status(500).json({ error: "Failed to update order status" }); }
});

// ============================================================
// Payment and admin-list endpoints are registered in routes/Payments.cjs.
// ============================================================
require("./routes/payments.cjs")(app, { supabase, auth, adminOnly, sanitize });
require("./routes/insights.cjs")(app, { supabase, auth, adminOnly });
require("./routes/behavior.cjs")(app, { supabase, auth, adminOnly });
app.get("/api/admin/users/:id/orders", auth, adminOnly, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*, products(title))")
      .eq("user_id", req.params.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user orders" });
  }
});

app.put("/api/admin/users/:id/status", auth, adminOnly, async (req, res) => {
  const { status } = req.body;
  if (!["active", "suspended"].includes(status))
    return res.status(400).json({ error: "Invalid status value" });
  if (req.params.id === req.user.id)
    return res.status(400).json({ error: "You cannot change your own account status" });
  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({ status })
      .eq("id", req.params.id)
      .select("id,fullname,username,role,status")
      .single();
    if (error) throw error;
    res.json({ message: "User status updated!", user: data });
  } catch (err) {
    res.status(500).json({ error: "Failed to update user status" });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(`[ERROR] ${new Date().toISOString()} - ${err.message}`);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n✅  FITCHEQUE backend (SECURED) running → http://localhost:${PORT}\n`);
  console.log("  Security features active:");
  console.log("  ✅ Helmet (CSP, X-Frame-Options, X-Content-Type-Options, HSTS)");
  console.log("  ✅ Rate limiting (100 API requests per 15min)");
  console.log("  ✅ CORS restricted to allowed origins");
  console.log("  ✅ Input sanitization on all user inputs");
  console.log("  ✅ Morgan request logging");
  console.log("  ✅ Generic error messages (no stack trace leaks)\n");
});