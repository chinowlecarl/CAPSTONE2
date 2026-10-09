import { createClient } from "@supabase/supabase-js";
import {
  addressVariants,
  decodeJwtPayload,
  normalizePhPhone,
  parseShippingAddress,
  signRequest,
} from "./lalamove.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadConfig() {
  const names = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "LALAMOVE_API_KEY",
    "LALAMOVE_API_SECRET",
    "PICKUP_NAME",
    "PICKUP_PHONE",
    "PICKUP_ADDRESS",
    "PICKUP_LAT",
    "PICKUP_LNG",
  ];
  const missing = names.filter((n) => !Deno.env.get(n));
  const get = (n: string) => Deno.env.get(n) ?? "";
  return {
    missing,
    supabaseUrl: get("SUPABASE_URL"),
    serviceKey: get("SUPABASE_SERVICE_ROLE_KEY"),
    apiKey: get("LALAMOVE_API_KEY"),
    apiSecret: get("LALAMOVE_API_SECRET"),
    baseUrl:
      Deno.env.get("LALAMOVE_BASE_URL") ?? "https://rest.sandbox.lalamove.com",
    serviceType: Deno.env.get("LALAMOVE_SERVICE_TYPE") ?? "MOTORCYCLE",
    pickup: {
      name: get("PICKUP_NAME"),
      phone: get("PICKUP_PHONE"),
      address: get("PICKUP_ADDRESS"),
      lat: get("PICKUP_LAT"),
      lng: get("PICKUP_LNG"),
    },
  };
}

class LalamoveError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(`Lalamove ${status}: ${detail}`);
  }
}

async function lalamoveRequest(
  cfg: ReturnType<typeof loadConfig>,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
) {
  const time = Date.now().toString();
  const bodyStr = body ? JSON.stringify(body) : "";
  const signature = await signRequest(
    cfg.apiSecret,
    time,
    method,
    path,
    bodyStr,
  );
  const res = await fetch(cfg.baseUrl + path, {
    method,
    headers: {
      Authorization: `hmac ${cfg.apiKey}:${time}:${signature}`,
      Market: "PH",
      "Request-ID": crypto.randomUUID(),
      "Content-Type": "application/json",
    },
    body: body ? bodyStr : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new LalamoveError(res.status, text.slice(0, 500));
  try {
    return JSON.parse(text);
  } catch {
    throw new LalamoveError(res.status, "Non-JSON response");
  }
}

// Free OpenStreetMap geocoder (max 1 request/second, needs a User-Agent).
async function geocode(
  address: string,
): Promise<{ lat: string; lng: string } | null> {
  for (const variant of addressVariants(address)) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "ph");
    url.searchParams.set("q", `${variant}, Philippines`);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "fitcheque-capstone/1.0",
          "Accept-Language": "en",
        },
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows?.[0])
          return { lat: String(rows[0].lat), lng: String(rows[0].lon) };
      }
    } catch (_) {
      /* try next variant */
    }
    await sleep(1100);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const cfg = loadConfig();
  if (cfg.missing.length) {
    console.error("Missing env:", cfg.missing.join(", "));
    return json(
      { error: `Function not configured. Missing: ${cfg.missing.join(", ")}` },
      500,
    );
  }

  const admin = createClient(cfg.supabaseUrl, cfg.serviceKey, {
    auth: { persistSession: false },
  });

  // ── 1. Who is calling? ─────────────────────────────────────
  const token = (req.headers.get("Authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!token) return json({ error: "Missing session token" }, 401);

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user)
    return json({ error: "Invalid or expired session" }, 401);

  if (decodeJwtPayload(token).aal !== "aal2") {
    return json(
      { error: "Two-factor authentication (AAL2) is required for this action" },
      403,
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role, status, fullname")
    .eq("id", userData.user.id)
    .single();
  if (!profile || profile.role !== "admin" || profile.status !== "active") {
    return json({ error: "Admin access required" }, 403);
  }

  // ── 2. Input ───────────────────────────────────────────────
  let orderId = "";
  try {
    orderId = String((await req.json())?.order_id ?? "");
  } catch (_) {
    /* handled below */
  }
  if (!UUID_RE.test(orderId))
    return json({ error: "A valid order_id is required" }, 400);

  // ── 3. Atomically claim the order (duplicate-booking guard) ─
  // This single UPDATE only succeeds if the order is PAID, has no Lalamove ID,
  // and isn't already BOOKING/BOOKED. Two simultaneous clicks: only one wins.
  const { data: order, error: claimErr } = await admin
    .from("orders")
    .update({ delivery_status: "BOOKING" })
    .eq("id", orderId)
    .eq("payment_status", "PAID")
    .is("lalamove_order_id", null)
    .in("delivery_status", ["NOT_BOOKED", "FAILED"])
    .select("id, user_id, shipping_address")
    .maybeSingle();

  if (claimErr) {
    console.error("Claim error:", claimErr.message);
    return json({ error: "Could not start booking" }, 500);
  }
  if (!order) {
    const { data: current } = await admin
      .from("orders")
      .select("payment_status, delivery_status, lalamove_order_id")
      .eq("id", orderId)
      .maybeSingle();
    if (!current) return json({ error: "Order not found" }, 404);
    if (current.payment_status !== "PAID")
      return json({ error: "Payment is not verified (not PAID)" }, 409);
    return json(
      {
        error: `Delivery already ${current.delivery_status}`,
        lalamove_order_id: current.lalamove_order_id,
      },
      409,
    );
  }

  // ── 4. Book it ─────────────────────────────────────────────
  let lalamoveOrderId: string | null = null;
  try {
    const { address, phone: rawPhone } = parseShippingAddress(
      order.shipping_address ?? "",
    );
    if (!address) throw new Error("Order has no delivery address");
    if (!rawPhone) throw new Error("Order has no customer phone number");
    const recipientPhone = normalizePhPhone(rawPhone);
    const senderPhone = normalizePhPhone(cfg.pickup.phone);

    const { data: customer } = await admin
      .from("profiles")
      .select("fullname")
      .eq("id", order.user_id)
      .maybeSingle();
    const recipientName = customer?.fullname || "Customer";

    const geo = await geocode(address);
    const dropoffStop = geo ? { coordinates: geo, address } : { address }; // let Lalamove try to resolve it; it returns a clear 422 if it can't

    const quotation = await lalamoveRequest(cfg, "POST", "/v3/quotations", {
      data: {
        serviceType: cfg.serviceType,
        language: "en_PH",
        stops: [
          {
            coordinates: { lat: cfg.pickup.lat, lng: cfg.pickup.lng },
            address: cfg.pickup.address,
          },
          dropoffStop,
        ],
      },
    });

    const q = quotation?.data;
    if (!q?.quotationId || q.stops?.length < 2)
      throw new Error("Unexpected quotation response");

    const placed = await lalamoveRequest(cfg, "POST", "/v3/orders", {
      data: {
        quotationId: q.quotationId,
        sender: {
          stopId: q.stops[0].stopId,
          name: cfg.pickup.name,
          phone: senderPhone,
        },
        recipients: [
          {
            stopId: q.stops[1].stopId,
            name: recipientName,
            phone: recipientPhone,
            remarks: `FITCHEQUE order #${orderId.slice(0, 8).toUpperCase()}`,
          },
        ],
        isPODEnabled: true,
      },
    });

    lalamoveOrderId = placed?.data?.orderId ?? null;
    if (!lalamoveOrderId)
      throw new Error("Lalamove did not return an order ID");

    // The booking exists at Lalamove now — never mark FAILED after this point.
    let saveErr: { message: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await admin
        .from("orders")
        .update({
          lalamove_order_id: lalamoveOrderId,
          delivery_status: "BOOKED",
        })
        .eq("id", orderId)
        .eq("delivery_status", "BOOKING");
      saveErr = error;
      if (!error) break;
      await sleep(500);
    }
    if (saveErr) {
      console.error(
        `BOOKED AT LALAMOVE BUT NOT SAVED. order=${orderId} lalamove=${lalamoveOrderId} err=${saveErr.message}`,
      );
      return json(
        {
          error: `Lalamove order ${lalamoveOrderId} was created but could not be saved. Record it manually and do NOT retry.`,
          lalamove_order_id: lalamoveOrderId,
        },
        500,
      );
    }

    console.log(
      `[LALAMOVE BOOKED] order=${orderId} lalamove=${lalamoveOrderId} by admin=${userData.user.id}`,
    );
    return json({
      ok: true,
      lalamove_order_id: lalamoveOrderId,
      share_link: placed?.data?.shareLink ?? null,
      status: placed?.data?.status ?? null,
      price: q.priceBreakdown?.total ?? null,
      currency: q.priceBreakdown?.currency ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Booking failed";
    console.error(`[LALAMOVE FAILED] order=${orderId}: ${message}`);
    if (!lalamoveOrderId) {
      // Nothing was booked, so it's safe to allow a retry.
      await admin
        .from("orders")
        .update({ delivery_status: "FAILED" })
        .eq("id", orderId)
        .eq("delivery_status", "BOOKING");
    }
    return json({ error: message }, 502);
  }
});
