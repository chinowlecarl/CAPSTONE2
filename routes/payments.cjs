// routes/Payments.cjs
//
// Manual GCash/Maya payment flow + the admin customer/order lists.
//   customer:  PUT  /api/orders/:id/payment            submit method + reference + screenshot
//   admin:     GET  /api/admin/payments                orders waiting for / past verification
//              GET  /api/admin/orders/:id/payment-proof short-lived link to the screenshot
//              PUT  /api/admin/orders/:id/verify-payment  approve | reject
//              GET  /api/admin/users, /api/admin/orders   (now include customer emails)
//
// Admin payment routes also require a session that completed MFA (aal2).

const FILE_SIGNATURES = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
};
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

module.exports = function registerPaymentRoutes(
  app,
  { supabase, auth, adminOnly, sanitize },
) {
  // `auth` already verified the token with Supabase, so reading its claims here is safe.
  function requireAal2(req, res, next) {
    try {
      const token = (req.headers.authorization || "").split(" ")[1] || "";
      const part = token.split(".")[1] || "";
      const claims = JSON.parse(
        Buffer.from(part, "base64url").toString("utf8"),
      );
      if (claims.aal === "aal2") return next();
    } catch (_) {
      /* fall through */
    }
    return res.status(403).json({
      error:
        "Two-factor authentication required. Log in again and enter your authenticator code.",
    });
  }

  // Emails live in Supabase Auth (not in `profiles`), so look them up for admin lists.
  async function getEmailMap() {
    const map = {};
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error || !data?.users?.length) break;
      data.users.forEach((u) => {
        map[u.id] = u.email;
      });
      if (data.users.length < 1000) break;
    }
    return map;
  }

  // ── CUSTOMER: submit payment proof ─────────────────────────
  app.put("/api/orders/:id/payment", auth, async (req, res) => {
    const { payment_method, payment_reference, proof_base64 } = req.body;

    if (!["GCASH", "MAYA"].includes(payment_method))
      return res
        .status(400)
        .json({ error: "payment_method must be GCASH or MAYA" });

    const reference = sanitize(payment_reference);
    if (!reference)
      return res.status(400).json({ error: "Payment reference is required" });
    if (reference.length > 100)
      return res.status(400).json({ error: "Payment reference is too long" });

    if (
      typeof proof_base64 !== "string" ||
      !proof_base64.startsWith("data:image/")
    )
      return res
        .status(400)
        .json({ error: "A valid payment proof image is required" });

    try {
      const { data: order, error: findErr } = await supabase
        .from("orders")
        .select("id, user_id, status, payment_status")
        .eq("id", req.params.id)
        .eq("user_id", req.user.id)
        .single();
      if (findErr || !order)
        return res.status(404).json({ error: "Order not found" });

      if (order.status === "cancelled")
        return res.status(400).json({ error: "This order was cancelled" });
      if (!["PENDING", "REJECTED"].includes(order.payment_status))
        return res
          .status(400)
          .json({ error: "This order is not awaiting payment" });

      const match = proof_base64.match(
        /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i,
      );
      if (!match) return res.status(400).json({ error: "Invalid image data" });

      const mimeType = match[1].toLowerCase();
      const sig = FILE_SIGNATURES[mimeType];
      if (!sig)
        return res
          .status(400)
          .json({ error: "Only JPG, PNG or WEBP screenshots are allowed" });

      const buffer = Buffer.from(match[2], "base64");
      if (buffer.length > 8 * 1024 * 1024)
        return res.status(400).json({ error: "Image too large (max 8MB)" });
      if (!sig.every((byte, i) => buffer[i] === byte))
        return res
          .status(400)
          .json({ error: "File content does not match a valid image type" });

      const storagePath = `${req.user.id}/${order.id}/${Date.now()}.${EXT[mimeType]}`;
      const { error: uploadErr } = await supabase.storage
        .from("payment-proofs")
        .upload(storagePath, buffer, { contentType: mimeType, upsert: true });
      if (uploadErr) throw uploadErr;

      // Guarded update: if an admin handled the order meanwhile, this matches nothing.
      const { data: updated, error: updateErr } = await supabase
        .from("orders")
        .update({
          payment_method,
          payment_reference: reference,
          payment_proof_url: storagePath,
          payment_status: "PENDING_VERIFICATION",
        })
        .eq("id", order.id)
        .eq("user_id", req.user.id)
        .in("payment_status", ["PENDING", "REJECTED"])
        .select()
        .maybeSingle();
      if (updateErr) throw updateErr;
      if (!updated)
        return res
          .status(409)
          .json({ error: "This order's payment was already processed" });

      console.log(
        `[PAYMENT SUBMITTED] ${new Date().toISOString()} - Order ${order.id} by user ${req.user.id}`,
      );
      res.json({
        message: "Payment proof submitted! Waiting for admin verification.",
        order: updated,
      });
    } catch (err) {
      console.error(`[PAYMENT SUBMIT ERROR] ${err.message}`);
      res.status(500).json({ error: "Failed to submit payment proof" });
    }
  });

  // ── ADMIN: payments list ───────────────────────────────────
  app.get(
    "/api/admin/payments",
    auth,
    adminOnly,
    requireAal2,
    async (req, res) => {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select(
            "id,user_id,total_amount,shipping_address,status,created_at,updated_at," +
              "payment_status,payment_method,payment_reference,payment_proof_url," +
              "delivery_status,lalamove_order_id,users:profiles(id,fullname,username)",
          )
          .in("payment_status", ["PENDING_VERIFICATION", "PAID", "REJECTED"])
          .order("updated_at", { ascending: false })
          .limit(200);
        if (error) throw error;

        const emails = await getEmailMap();
        res.json(
          data.map(({ payment_proof_url, ...o }) => ({
            ...o,
            has_proof: !!payment_proof_url,
            users: o.users
              ? { ...o.users, email: emails[o.user_id] || "" }
              : null,
          })),
        );
      } catch (err) {
        console.error(`[PAYMENTS LIST ERROR] ${err.message}`);
        res.status(500).json({ error: "Failed to fetch payments" });
      }
    },
  );

  // ── ADMIN: temporary link to a payment screenshot ──────────
  app.get(
    "/api/admin/orders/:id/payment-proof",
    auth,
    adminOnly,
    requireAal2,
    async (req, res) => {
      try {
        const { data: order, error: findErr } = await supabase
          .from("orders")
          .select("payment_proof_url")
          .eq("id", req.params.id)
          .single();
        if (findErr || !order?.payment_proof_url)
          return res
            .status(404)
            .json({ error: "No payment proof on this order" });

        const { data, error } = await supabase.storage
          .from("payment-proofs")
          .createSignedUrl(order.payment_proof_url, 300); // 5 minutes
        if (error) throw error;
        res.json({ url: data.signedUrl });
      } catch (err) {
        res.status(500).json({ error: "Failed to load payment proof" });
      }
    },
  );

  // ── ADMIN: approve / reject ────────────────────────────────
  app.put(
    "/api/admin/orders/:id/verify-payment",
    auth,
    adminOnly,
    requireAal2,
    async (req, res) => {
      const { decision } = req.body;
      if (!["approve", "reject"].includes(decision))
        return res
          .status(400)
          .json({ error: "decision must be 'approve' or 'reject'" });

      try {
        const { data: order, error: findErr } = await supabase
          .from("orders")
          .select("id, status, payment_status")
          .eq("id", req.params.id)
          .single();
        if (findErr || !order)
          return res.status(404).json({ error: "Order not found" });
        if (order.status === "cancelled")
          return res.status(400).json({ error: "This order was cancelled" });
        if (order.payment_status !== "PENDING_VERIFICATION")
          return res
            .status(400)
            .json({ error: "This order is not awaiting verification" });

        const approve = decision === "approve";
        const changes = { payment_status: approve ? "PAID" : "REJECTED" };
        if (approve && order.status === "pending") changes.status = "confirmed";

        // Only succeeds if it's still PENDING_VERIFICATION (blocks double-processing).
        const { data: updated, error: updateErr } = await supabase
          .from("orders")
          .update(changes)
          .eq("id", order.id)
          .eq("payment_status", "PENDING_VERIFICATION")
          .select()
          .maybeSingle();
        if (updateErr) throw updateErr;
        if (!updated)
          return res
            .status(409)
            .json({ error: "This payment was already processed" });

        console.log(
          `[PAYMENT ${changes.payment_status}] ${new Date().toISOString()} - Order ${order.id} by admin ${req.user.id}`,
        );
        res.json({
          message: `Payment ${changes.payment_status}!`,
          order: updated,
        });
      } catch (err) {
        console.error(`[PAYMENT VERIFY ERROR] ${err.message}`);
        res.status(500).json({ error: "Failed to update payment status" });
      }
    },
  );

  // ── ADMIN: customer + order lists (with emails) ────────────
  app.get("/api/admin/users", auth, adminOnly, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,fullname,username,phone,address,role,status,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const emails = await getEmailMap();
      res.json(data.map((u) => ({ ...u, email: emails[u.id] || "" })));
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/orders", auth, adminOnly, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "*, users:profiles(id,fullname,username), order_items(*, products(title))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      const emails = await getEmailMap();
      res.json(
        data.map((o) => ({
          ...o,
          users: o.users
            ? { ...o.users, email: emails[o.user_id] || "" }
            : null,
        })),
      );
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });
};
