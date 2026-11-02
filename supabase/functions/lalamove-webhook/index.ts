import { createClient } from "@supabase/supabase-js";
import { signRequest } from "../create-lalamove-order/lalamove.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function constantTimeEqual(a: string, b: string) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getOrderId(payload: Record<string, unknown>) {
  const data = asRecord(payload.data);
  const order = asRecord(data.order ?? payload.order);
  const value = [
    data.orderId,
    data.orderID,
    data.order_id,
    order.orderId,
    order.orderID,
    order.id,
    payload.orderId,
    payload.orderID,
    payload.order_id,
  ].find((candidate) => typeof candidate === "string");
  return typeof value === "string" ? value : null;
}

function mapDeliveryStatus(status: string) {
  switch (status.toUpperCase()) {
    case "ON_GOING":
      return "PICKED_UP";
    case "COMPLETED":
      return "DELIVERED";
    case "CANCELED":
    case "CANCELLED":
      return "CANCELLED";
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const configuredToken = Deno.env.get("LALAMOVE_WEBHOOK_TOKEN") ?? "";
  const requestToken = url.searchParams.get("token") ?? "";
  if (!configuredToken || !constantTimeEqual(requestToken, configuredToken)) {
    return json({ error: "Unauthorized webhook" }, 401);
  }

  const required = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "LALAMOVE_API_KEY",
    "LALAMOVE_API_SECRET",
  ];
  const missing = required.filter((name) => !Deno.env.get(name));
  if (missing.length) {
    console.error("Missing webhook configuration:", missing.join(", "));
    return json({ error: "Webhook is not configured" }, 500);
  }

  let payload: Record<string, unknown>;
  try {
    payload = asRecord(await req.json());
  } catch {
    return json({ error: "Invalid JSON payload" }, 400);
  }

  const lalamoveOrderId = getOrderId(payload);
  if (!lalamoveOrderId) {
    console.warn("Ignoring Lalamove webhook without an order ID");
    return json({ ok: true, ignored: true });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data: order, error: findError } = await supabase
    .from("orders")
    .select("id, lalamove_order_id")
    .eq("lalamove_order_id", lalamoveOrderId)
    .maybeSingle();

  if (findError) {
    console.error(
      "Could not locate order for Lalamove webhook:",
      findError.message,
    );
    return json({ error: "Could not locate order" }, 500);
  }
  if (!order) return json({ ok: true, ignored: true });

  const baseUrl = Deno.env.get("LALAMOVE_BASE_URL") ??
    "https://rest.sandbox.lalamove.com";
  const path = `/v3/orders/${encodeURIComponent(lalamoveOrderId)}`;
  const timestamp = Date.now().toString();
  const signature = await signRequest(
    Deno.env.get("LALAMOVE_API_SECRET")!,
    timestamp,
    "GET",
    path,
    "",
  );

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      headers: {
        Authorization: `hmac ${
          Deno.env.get("LALAMOVE_API_KEY")
        }:${timestamp}:${signature}`,
        Market: "PH",
        "Request-ID": crypto.randomUUID(),
      },
    });
  } catch (error) {
    console.error("Lalamove status request failed:", error);
    return json({ error: "Could not verify Lalamove order status" }, 502);
  }

  if (!response.ok) {
    console.error("Lalamove status request returned:", response.status);
    return json({ error: "Could not verify Lalamove order status" }, 502);
  }

  let detail: Record<string, unknown>;
  try {
    detail = asRecord(await response.json());
  } catch {
    console.error("Lalamove returned invalid order details");
    return json({ error: "Invalid Lalamove order response" }, 502);
  }

  const orderDetail = asRecord(detail.data);
  const status = orderDetail.status;
  if (typeof status !== "string" || !status) {
    console.error("Lalamove order details did not include a status");
    return json({ error: "Lalamove order status is missing" }, 502);
  }

  const update: Record<string, string | null> = {
    lalamove_status: status,
  };
  const deliveryStatus = mapDeliveryStatus(status);
  if (deliveryStatus) update.delivery_status = deliveryStatus;
  if (typeof orderDetail.shareLink === "string") {
    update.lalamove_share_link = orderDetail.shareLink;
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update(update)
    .eq("id", order.id)
    .eq("lalamove_order_id", lalamoveOrderId);

  if (updateError) {
    console.error("Could not save Lalamove status:", updateError.message);
    return json({ error: "Could not save Lalamove status" }, 500);
  }

  console.log(
    `[LALAMOVE STATUS] order=${order.id} lalamove=${lalamoveOrderId} status=${status}`,
  );
  return json({ ok: true });
});
