import { useState, useEffect, useCallback } from "react";
import { apiFetch, fmt } from "../../utils/api";
import { confirmDialog } from "../../components/ConfirmDialog";

const PINK = "#be185d";
const LINE = "#fce7f3";

const phDate = (iso) => new Date(iso).toLocaleDateString("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric" });
const phTime = (iso) => new Date(iso).toLocaleTimeString("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true });

// How to show the time left before permanent deletion
function timeLeft(item) {
  if (item.inOrderHistory && item.expired) return { text: "Kept hidden", tone: "neutral", hint: "This product appears in past orders, so it is never deleted. It just stays hidden." };
  if (item.expired) return { text: "Deleting soon", tone: "bad" };
  if (item.hoursLeft < 24) return { text: `${item.hoursLeft}h left`, tone: "bad" };
  if (item.daysLeft <= 3) return { text: `${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"} left`, tone: "warn" };
  return { text: `${item.daysLeft} days left`, tone: "ok" };
}
const TONES = {
  ok: { bg: "#f0fdf4", fg: "#15803d", bd: "#bbf7d0" },
  warn: { bg: "#fffbeb", fg: "#b45309", bd: "#fde68a" },
  bad: { bg: "#fef2f2", fg: "#dc2626", bd: "#fecaca" },
  neutral: { bg: "#f3f4f6", fg: "#6b7280", bd: "#e5e7eb" },
};
const th = { padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 800, letterSpacing: 1, color: PINK, whiteSpace: "nowrap" };
const td = { padding: "12px 14px", fontSize: 13, color: "#444", verticalAlign: "middle" };

export default function ArchivedProducts() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch("/admin/products/archived"));
    } catch (e) {
      setError(e.message || "Could not load archived products");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const showMsg = (text, type = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  };

  const restore = async (item) => {
    const ok = await confirmDialog({
      title: `Restore “${item.title}”?`,
      message: "It will show up in the shop again, with its old price and stock.",
      confirmLabel: "Restore",
    });
    if (!ok) return;
    setBusyId(item.id);
    try {
      await apiFetch(`/admin/products/${item.id}/restore`, { method: "POST" });
      setData((d) => ({ ...d, items: d.items.filter((i) => i.id !== item.id) }));
      showMsg(`“${item.title}” restored.`);
    } catch (e) {
      showMsg(e.message || "Could not restore the product", "error");
      load();
    }
    setBusyId(null);
  };

  const items = data?.items || [];
  const days = data?.retentionDays || 10;

  return (
    <div style={{ padding: "28px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#1a1a1a", margin: "0 0 4px" }}>Archive</h1>
          <p style={{ color: "#aaa", fontSize: 13, margin: 0 }}>Products you removed. Restore them before the time runs out.</p>
        </div>
        <button onClick={load} disabled={loading} style={{ background: "#fff", border: `1.5px solid ${LINE}`, borderRadius: 10, color: PINK, fontWeight: 700, fontSize: 12, padding: "9px 16px", cursor: "pointer", opacity: loading ? 0.6 : 1 }}>↻ Refresh</button>
      </div>

      <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "11px 16px", fontSize: 13, color: "#92400e", marginBottom: 16, lineHeight: 1.5 }}>
        Archived products are hidden from the shop and <strong>deleted permanently after {days} days</strong>. Products that appear in past orders are never deleted, so order history stays complete.
      </div>

      {msg && (
        <div role={msg.type === "error" ? "alert" : "status"} style={{ marginBottom: 14, padding: "11px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: msg.type === "error" ? "#fef2f2" : "#f0fdf4", border: `1px solid ${msg.type === "error" ? "#fecaca" : "#bbf7d0"}`, color: msg.type === "error" ? "#dc2626" : "#15803d" }}>
          {msg.text}
        </div>
      )}

      {error ? (
        <div style={{ textAlign: "center", padding: "50px 24px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14 }}>
          <p style={{ color: PINK, fontWeight: 700, margin: "0 0 14px" }}>{error}</p>
          <button onClick={load} style={{ background: "linear-gradient(135deg,#f9a8d4,#be185d)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 12, padding: "10px 18px", cursor: "pointer" }}>TRY AGAIN</button>
        </div>
      ) : loading && !data ? (
        <div style={{ textAlign: "center", padding: 60, color: PINK, fontWeight: 600 }}>Loading archive...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "56px 24px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, color: "#aaa" }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🗄</div>
          <div style={{ fontWeight: 700, color: "#777" }}>Nothing in the archive</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Products you remove will wait here for {days} days.</div>
        </div>
      ) : (
        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(190,24,93,0.05)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr style={{ background: "#fbcfe8" }}>
                  {["PRODUCT", "CATEGORY", "PRICE", "STOCK", "ARCHIVED", "TIME LEFT", ""].map((h) => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const t = timeLeft(item);
                  const c = TONES[t.tone];
                  return (
                    <tr key={item.id} style={{ background: i % 2 ? "#fff5f7" : "#fff", borderTop: `1px solid ${LINE}` }}>
                      <td style={{ ...td, fontWeight: 700, color: "#1a1a1a" }}>
                        {item.title}
                        {item.inOrderHistory && <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginTop: 2 }}>In past orders</div>}
                      </td>
                      <td style={td}>{item.category}</td>
                      <td style={{ ...td, fontWeight: 700, color: PINK }}>{fmt(item.price)}</td>
                      <td style={td}>{item.stock}</td>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{phDate(item.archived_at)}</div>
                        <div style={{ fontSize: 12, color: "#999" }}>{phTime(item.archived_at)}{item.archivedByName ? ` · by ${item.archivedByName}` : ""}</div>
                      </td>
                      <td style={td}>
                        <span title={t.hint || `Deleted permanently on ${phDate(item.deletesAt)}`} style={{ display: "inline-block", padding: "4px 11px", borderRadius: 20, fontSize: 11, fontWeight: 800, background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, whiteSpace: "nowrap" }}>
                          {t.text}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>
                        <button
                          onClick={() => restore(item)}
                          disabled={busyId === item.id || item.expired}
                          title={item.expired ? `The ${days}-day restore window has ended` : "Put this product back in the shop"}
                          style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 8, cursor: "pointer", opacity: busyId === item.id || item.expired ? 0.5 : 1 }}
                        >
                          {busyId === item.id ? "Restoring..." : "Restore"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}