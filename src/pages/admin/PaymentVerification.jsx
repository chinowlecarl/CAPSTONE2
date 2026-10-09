import { useState, useEffect, useCallback } from "react";
import { apiFetch, fmt } from "../../utils/api";
import { supabase } from "../../utils/supabase";
import { useApp } from "../../context/AppContext";

const FILTERS = [
  { id: "verify",   label: "To verify",     test: (o) => o.payment_status === "PENDING_VERIFICATION" },
  { id: "book",     label: "Ready to book", test: (o) => o.payment_status === "PAID" && ["NOT_BOOKED", "FAILED"].includes(o.delivery_status) },
  { id: "delivery", label: "Delivery",      test: (o) => o.payment_status === "PAID" && !["NOT_BOOKED", "FAILED"].includes(o.delivery_status) },
  { id: "rejected", label: "Rejected",      test: (o) => o.payment_status === "REJECTED" },
];

const PAY_COLORS = {
  PENDING_VERIFICATION: { bg: "#fffbeb", color: "#b45309", border: "#fde68a", label: "Needs verification" },
  PAID:                 { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0", label: "Paid" },
  REJECTED:             { bg: "#fff5f7", color: "#be185d", border: "#fce7f3", label: "Rejected" },
};
const DELIVERY_COLORS = {
  NOT_BOOKED: { bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" },
  BOOKING:    { bg: "#eff6ff", color: "#3b82f6", border: "#bfdbfe" },
  BOOKED:     { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
  PICKED_UP:  { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
  DELIVERED:  { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  CANCELLED:  { bg: "#fff5f7", color: "#be185d", border: "#fce7f3" },
  FAILED:     { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
};

const badge = (c, text) => (
  <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", background: c.bg, color: c.color, border: `1px solid ${c.border}`, whiteSpace: "nowrap" }}>
    {text}
  </span>
);

const primaryBtn = (disabled) => ({ background: "linear-gradient(135deg,#f9a8d4,#be185d)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 12, padding: "9px 16px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 });
const ghostBtn = (disabled) => ({ background: "#fff", border: "1.5px solid #fce7f3", borderRadius: 10, color: "#be185d", fontWeight: 700, fontSize: 12, padding: "9px 16px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 });
const dangerBtn = (disabled) => ({ background: "#fff", border: "1.5px solid #fecaca", borderRadius: 10, color: "#ef4444", fontWeight: 700, fontSize: 12, padding: "9px 16px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 });

// Calls the Lalamove Edge Function with the admin's own session.
async function bookDelivery(orderId) {
  const { data, error } = await supabase.functions.invoke("create-lalamove-order", { body: { order_id: orderId } });
  if (error) {
    let message = error.message;
    try {
      const j = await error.context.json();
      if (j?.error) message = j.error;
    } catch (_) { /* keep default message */ }
    throw new Error(message);
  }
  return data;
}

export default function PaymentVerification() {
  const { user } = useApp();
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [filter, setFilter]   = useState("verify");
  const [busyId, setBusyId]   = useState(null);
  const [msg, setMsg]         = useState(null);
  const [proof, setProof]     = useState(null); // { orderId, url }

  const showMsg = (text, type = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 8000);
  };

  const load = useCallback(async () => {
    try {
      setError(null);
      setOrders(await apiFetch("/admin/payments"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user?.role === "admin") load(); }, [user?.role, load]);

  const viewProof = async (order) => {
    setBusyId(order.id);
    try {
      const { url } = await apiFetch(`/admin/orders/${order.id}/payment-proof`);
      setProof({ orderId: order.id, url });
    } catch (err) {
      showMsg(err.message, "error");
    }
    setBusyId(null);
  };

  const verify = async (order, decision) => {
    const approve = decision === "approve";
    const text = approve
      ? `Approve the ${order.payment_method} payment of ${fmt(order.total_amount)}?\n\nOnly approve after you checked the real transaction in the ${order.payment_method} app.\nReference given by customer: ${order.payment_reference}\n\nApproving will also book the Lalamove delivery.`
      : `Reject this payment? The customer will be able to upload a new proof.`;
    if (!window.confirm(text)) return;

    setBusyId(order.id);
    try {
      await apiFetch(`/admin/orders/${order.id}/verify-payment`, { method: "PUT", body: JSON.stringify({ decision }) });
      if (approve) {
        try {
          const r = await bookDelivery(order.id);
          showMsg(`Payment approved and delivery booked. Lalamove order: ${r.lalamove_order_id}`);
        } catch (err) {
          showMsg(`Payment approved, but delivery booking failed: ${err.message}. Use "Book delivery" to retry.`, "error");
        }
      } else {
        showMsg("Payment rejected. The customer can upload a new proof.");
      }
    } catch (err) {
      showMsg(err.message, "error");
    }
    await load();
    setBusyId(null);
  };

  const book = async (order) => {
    setBusyId(order.id);
    try {
      const r = await bookDelivery(order.id);
      showMsg(`Delivery booked. Lalamove order: ${r.lalamove_order_id}`);
    } catch (err) {
      showMsg(`Booking failed: ${err.message}`, "error");
    }
    await load();
    setBusyId(null);
  };

  if (!user || user.role !== "admin") return null;

  const active = FILTERS.find((f) => f.id === filter);
  const shown = orders.filter(active.test);

  return (
    <div style={{ padding: "28px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#1a1a1a", margin: "0 0 4px" }}>Payments</h1>
          <p style={{ color: "#aaa", fontSize: 13, margin: 0 }}>Check GCash/Maya payments, then book the Lalamove delivery</p>
        </div>
        <button onClick={load} style={ghostBtn(false)}>↻ Refresh</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {FILTERS.map((f) => {
          const count = orders.filter(f.test).length;
          const on = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{ background: on ? "#fff5f7" : "#fff", border: `1.5px solid ${on ? "#be185d" : "#fce7f3"}`, borderRadius: 12, padding: "14px 10px", cursor: "pointer", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#be185d" }}>{count}</div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#888", letterSpacing: 1, textTransform: "uppercase", marginTop: 2 }}>{f.label}</div>
            </button>
          );
        })}
      </div>

      {msg && (
        <div style={{ borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, fontWeight: 600, background: msg.type === "success" ? "#f0fdf4" : "#fff5f7", borderLeft: `4px solid ${msg.type === "success" ? "#22c55e" : "#be185d"}`, color: msg.type === "success" ? "#16a34a" : "#be185d" }}>
          {msg.type === "success" ? "✓" : "✗"} {msg.text}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#be185d", fontWeight: 600 }}>Loading payments...</div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "50px 24px", background: "#fff", borderRadius: 16, border: "1px solid #fce7f3" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
          <p style={{ color: "#be185d", fontWeight: 700, margin: "0 0 14px" }}>{error}</p>
          <button onClick={load} style={primaryBtn(false)}>TRY AGAIN</button>
        </div>
      ) : shown.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", background: "#fff", borderRadius: 16, border: "1px solid #fce7f3", color: "#ccc" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
          <p style={{ fontWeight: 600, margin: 0 }}>Nothing here right now</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {shown.map((o) => {
            const busy = busyId === o.id;
            const pay = PAY_COLORS[o.payment_status] || PAY_COLORS.REJECTED;
            const del = DELIVERY_COLORS[o.delivery_status] || DELIVERY_COLORS.NOT_BOOKED;
            return (
              <div key={o.id} data-testid={`order-${o.id}`} style={{ background: "#fff", border: "1px solid #fce7f3", borderRadius: 14, padding: "16px 20px", boxShadow: "0 2px 12px rgba(190,24,93,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 220, flex: 1 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#be185d", fontSize: 13 }}>#{o.id.slice(0, 8).toUpperCase()}</span>
                      {badge(pay, pay.label)}
                      {o.payment_status === "PAID" && badge(del, o.delivery_status.replace("_", " "))}
                    </div>
                    <div style={{ fontWeight: 700, color: "#1a1a1a", fontSize: 14 }}>{o.users?.fullname || "Customer"}</div>
                    <div style={{ fontSize: 12, color: "#999", marginBottom: 6 }}>{o.users?.email || ""}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>📍 {o.shipping_address || "No address"}</div>
                  </div>

                  <div style={{ minWidth: 180 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#be185d" }}>{fmt(o.total_amount)}</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                      {o.payment_method === "MAYA" ? "💳 Maya" : "📱 GCash"}
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>Ref: <strong style={{ fontFamily: "monospace" }}>{o.payment_reference || "—"}</strong></div>
                    <div style={{ fontSize: 11, color: "#bbb", marginTop: 4 }}>
                      {new Date(o.updated_at || o.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 14, paddingTop: 14, borderTop: "1px dashed #fce7f3" }}>
                  {o.has_proof && (
                    <button onClick={() => viewProof(o)} disabled={busy} style={ghostBtn(busy)}>🖼 View proof</button>
                  )}

                  {o.payment_status === "PENDING_VERIFICATION" && (
                    <>
                      <button onClick={() => verify(o, "approve")} disabled={busy} style={primaryBtn(busy)}>
                        {busy ? "WORKING..." : "✓ APPROVE & BOOK DELIVERY"}
                      </button>
                      <button onClick={() => verify(o, "reject")} disabled={busy} style={dangerBtn(busy)}>✕ Reject</button>
                    </>
                  )}

                  {o.payment_status === "PAID" && ["NOT_BOOKED", "FAILED"].includes(o.delivery_status) && (
                    <>
                      <button onClick={() => book(o)} disabled={busy} style={primaryBtn(busy)}>
                        {busy ? "BOOKING..." : o.delivery_status === "FAILED" ? "↻ RETRY BOOKING" : "🚚 BOOK LALAMOVE DELIVERY"}
                      </button>
                      {o.delivery_status === "FAILED" && (
                        <span style={{ fontSize: 12, color: "#dc2626" }}>The last attempt failed. Check the address and phone, then retry.</span>
                      )}
                    </>
                  )}

                  {o.payment_status === "PAID" && o.delivery_status === "BOOKING" && (
                    <span style={{ fontSize: 12, color: "#3b82f6" }}>Booking in progress. If this stays here for over a minute, check Lalamove's Records before doing anything else.</span>
                  )}

                  {o.payment_status === "PAID" && o.lalamove_order_id && (
                    <span style={{ fontSize: 12, color: "#666" }}>Lalamove order: <strong style={{ fontFamily: "monospace" }}>{o.lalamove_order_id}</strong></span>
                  )}

                  {o.payment_status === "REJECTED" && (
                    <span style={{ fontSize: 12, color: "#999" }}>Waiting for the customer to upload a new proof.</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {proof && (
        <div onClick={() => setProof(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 16, maxWidth: 520, width: "100%", maxHeight: "92vh", overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <strong style={{ color: "#be185d" }}>Payment proof</strong>
              <button onClick={() => setProof(null)} style={ghostBtn(false)}>Close</button>
            </div>
            <img src={proof.url} alt="Payment proof" style={{ width: "100%", borderRadius: 10, border: "1px solid #fce7f3" }} />
            <p style={{ fontSize: 11, color: "#aaa", margin: "10px 0 0" }}>This link expires in 5 minutes. Check the amount and reference match the real transaction.</p>
          </div>
        </div>
      )}
    </div>
  );
}