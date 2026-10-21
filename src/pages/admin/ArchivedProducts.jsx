import { useCallback, useEffect, useState } from "react";
import { apiFetch, fmt } from "../../utils/api";
import ConfirmDialog from "../../components/ConfirmDialog";

export default function ArchivedProducts() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    return apiFetch("/admin/products/archived")
      .then((data) => setItems(data.items || []))
      .catch((err) => setError(err.message || "Failed to load archived items."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const restore = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await apiFetch(`/admin/products/${pending.id}/restore`, { method: "POST" });
      setNotice(`${pending.title} was restored.`);
      setPending(null);
      await load();
    } catch (err) {
      setError(err.message || "Failed to restore item.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ maxWidth: 1200, padding: "28px 24px", margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 5px", fontFamily: "'Playfair Display',serif", fontSize: 24 }}>Archived Items</h1>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 18 }}>Items are permanently deleted after 10 days. Items linked to past orders are retained to preserve order history.</p>
      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      {notice && <p role="status" style={{ color: "#15803d" }}>{notice}</p>}
      {loading ? <p>Loading archived items...</p> : items.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #fce7f3", borderRadius: 14, padding: 32, textAlign: "center", color: "#888" }}>There are no archived items.</div>
      ) : (
        <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #fce7f3", borderRadius: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ textAlign: "left", background: "#fce7f3", color: "#9d174d" }}>
              {["Item", "Category", "Price", "Archived by", "Days remaining", "Order history", "Action"].map((h) => <th key={h} style={{ padding: 12 }}>{h}</th>)}
            </tr></thead>
            <tbody>{items.map((item) => (
              <tr key={item.id} style={{ borderTop: "1px solid #fce7f3" }}>
                <td style={{ padding: 12 }}>{item.title}</td>
                <td style={{ padding: 12 }}>{item.category}</td>
                <td style={{ padding: 12 }}>{fmt(item.price)}</td>
                <td style={{ padding: 12 }}>{item.archivedByName || "Unknown"}</td>
                <td style={{ padding: 12 }}>
                  {item.daysLeft} day{item.daysLeft === 1 ? "" : "s"}
                  {item.inOrderHistory && <div style={{ color: "#888", fontSize: 11 }}>Kept for order history</div>}
                </td>
                <td style={{ padding: 12 }}>{item.inOrderHistory ? "Yes" : "No"}</td>
                <td style={{ padding: 12 }}>
                  <button type="button" disabled={item.expired || busy} onClick={() => setPending(item)}>
                    {item.expired ? "Restore window ended" : "Restore"}
                  </button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={!!pending}
        title="Restore archived item?"
        message={pending ? `Restore "${pending.title}" to the active product list?` : ""}
        confirmLabel="Restore"
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={restore}
      />
    </section>
  );
}
