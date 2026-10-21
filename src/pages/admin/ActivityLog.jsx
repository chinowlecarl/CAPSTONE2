import { useEffect, useState } from "react";
import { apiFetch } from "../../utils/api";

const timeText = (value) => new Date(value).toLocaleString("en-PH", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Asia/Manila",
});

export default function ActivityLog() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    apiFetch(`/admin/activity?page=${page}&pageSize=${pageSize}`)
      .then((data) => {
        if (!active) return;
        setRows(data.rows || []);
        setTotal(data.total || 0);
      })
      .catch((err) => {
        if (active) setError(err.message || "Failed to load activity.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [page, pageSize]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section style={{ maxWidth: 1200, padding: "28px 24px", margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 5px", fontFamily: "'Playfair Display',serif", fontSize: 24 }}>Activity Log</h1>
        <p style={{ color: "#888", fontSize: 13 }}>Account, order, product and admin actions with actor and timestamp.</p>
      </header>
      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #fce7f3", borderRadius: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#fce7f3", color: "#9d174d" }}>
              {["Date and time", "Who", "Action", "Activity", "Target"].map((heading) => (
                <th key={heading} style={{ padding: "12px 14px" }}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ padding: 28, textAlign: "center" }}>Loading activity...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: 28, textAlign: "center", color: "#888" }}>No activity has been recorded yet.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.id} style={{ borderTop: "1px solid #fce7f3" }}>
                <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>{timeText(row.created_at)}</td>
                <td style={{ padding: "12px 14px" }}>
                  <strong>{row.actor_name || "Unknown"}</strong>
                  {row.actor_role && <div style={{ color: "#888", fontSize: 11 }}>{row.actor_role}</div>}
                </td>
                <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>{row.action.replaceAll("_", " ")}</td>
                <td style={{ padding: "12px 14px" }}>{row.summary}</td>
                <td style={{ padding: "12px 14px" }}>
                  {row.details?.target?.username || row.details?.target?.name || row.entity_id || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 14 }}>
        <span style={{ color: "#888", fontSize: 12 }}>{total} entries</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((n) => n - 1)}>Previous</button>
          <span style={{ fontSize: 12 }}>Page {page} of {pageCount}</span>
          <button type="button" disabled={page >= pageCount || loading} onClick={() => setPage((n) => n + 1)}>Next</button>
        </div>
      </div>
    </section>
  );
}
