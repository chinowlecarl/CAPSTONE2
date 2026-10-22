import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "../../utils/api";

const PINK = "#be185d";
const LINE = "#fce7f3";
const PAGE_SIZE = 50;

// Every entry shows its exact date AND time, in Philippine time.
const phDate = (iso) => new Date(iso).toLocaleDateString("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric" });
const phTime = (iso) => new Date(iso).toLocaleTimeString("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });

const TONES = {
  good: { bg: "#f0fdf4", fg: "#15803d", bd: "#bbf7d0" },
  warn: { bg: "#fffbeb", fg: "#b45309", bd: "#fde68a" },
  bad: { bg: "#fef2f2", fg: "#dc2626", bd: "#fecaca" },
  info: { bg: "#eff6ff", fg: "#1d4ed8", bd: "#bfdbfe" },
  neutral: { bg: "#f3f4f6", fg: "#6b7280", bd: "#e5e7eb" },
};

const ACTIONS = {
  ACCOUNT_CREATED: ["Account created", "good"],
  LOGIN: ["Signed in", "neutral"],
  LOGOUT: ["Signed out", "neutral"],
  PROFILE_UPDATED: ["Profile updated", "info"],
  PASSWORD_CHANGED: ["Password changed", "info"],
  PASSWORD_CHANGE_FAILED: ["Password change failed", "warn"],
  ORDER_PLACED: ["Order placed", "info"],
  ORDER_CANCELLED: ["Order cancelled", "warn"],
  PAYMENT_SUBMITTED: ["Payment submitted", "info"],
  ORDER_STATUS_CHANGED: ["Order status changed", "info"],
  PAYMENT_APPROVED: ["Payment approved", "good"],
  PAYMENT_REJECTED: ["Payment rejected", "bad"],
  PAYMENT_PROOF_VIEWED: ["Payment proof viewed", "neutral"],
  PRODUCT_CREATED: ["Product added", "good"],
  PRODUCT_UPDATED: ["Product edited", "info"],
  PRODUCT_ARCHIVED: ["Product archived", "warn"],
  PRODUCT_RESTORED: ["Product restored", "good"],
  PRODUCT_PURGED: ["Permanently deleted", "bad"],
  PRODUCT_DELETED: ["Product deleted", "bad"],
  CATEGORY_CREATED: ["Category added", "good"],
  CATEGORY_RENAMED: ["Category renamed", "info"],
  CATEGORY_DELETED: ["Category deleted", "bad"],
  USER_SUSPENDED: ["User suspended", "bad"],
  USER_ACTIVATED: ["User activated", "good"],
  USER_STATUS_CHANGED: ["User status changed", "info"],
};
const actionInfo = (a) => ACTIONS[a] || [a.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()), "neutral"];

const ROLE_STYLE = {
  admin: { bg: "#fdf2f8", fg: PINK, bd: "#fbcfe8", label: "Admin" },
  customer: { bg: "#f3f4f6", fg: "#6b7280", bd: "#e5e7eb", label: "Customer" },
  system: { bg: "#eff6ff", fg: "#1d4ed8", bd: "#bfdbfe", label: "System" },
};

const th = { padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 800, letterSpacing: 1, color: PINK, whiteSpace: "nowrap" };
const td = { padding: "11px 14px", fontSize: 13, color: "#444", verticalAlign: "top" };
const field = { background: "#fff", border: `1.5px solid ${LINE}`, borderRadius: 10, padding: "9px 12px", fontSize: 12, color: "#444", outline: "none" };

export default function ActivityLog() {
  const [role, setRole] = useState("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");      // debounced search
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  // wait for the person to stop typing before searching
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (role) p.set("role", role);
    if (action) p.set("action", action);
    if (query) p.set("q", query);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    try {
      const res = await apiFetch(`/admin/activity?${p.toString()}`);
      if (id === requestId.current) setData(res);   // ignore answers that arrive late
    } catch (e) {
      if (id === requestId.current) setError(e.message || "Could not load the activity log");
    }
    if (id === requestId.current) setLoading(false);
  }, [page, role, action, query, from, to]);

  useEffect(() => { load(); }, [load]);

  const changeFilter = (setter) => (e) => { setter(e.target.value); setPage(1); };
  const clearFilters = () => { setRole(""); setAction(""); setSearch(""); setQuery(""); setFrom(""); setTo(""); setPage(1); };
  const hasFilters = role || action || query || from || to;

  const rows = data?.rows || [];
  const total = data?.total || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstShown = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(total, page * PAGE_SIZE);

  return (
    <div style={{ padding: "28px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#1a1a1a", margin: "0 0 4px" }}>Activity log</h1>
          <p style={{ color: "#aaa", fontSize: 13, margin: 0 }}>What customers and admins did, and exactly when (Philippine time)</p>
        </div>
        <button onClick={load} disabled={loading} style={{ background: "#fff", border: `1.5px solid ${LINE}`, borderRadius: 10, color: PINK, fontWeight: 700, fontSize: 12, padding: "9px 16px", cursor: "pointer", opacity: loading ? 0.6 : 1 }}>↻ Refresh</button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a person or action..." aria-label="Search the activity log" style={{ ...field, flex: "1 1 220px", minWidth: 180 }} />
        <select value={role} onChange={changeFilter(setRole)} aria-label="Filter by role" style={field}>
          <option value="">Everyone</option>
          <option value="admin">Admins</option>
          <option value="customer">Customers</option>
          <option value="system">System</option>
        </select>
        <select value={action} onChange={changeFilter(setAction)} aria-label="Filter by action" style={field}>
          <option value="">All actions</option>
          {(data?.actions || Object.keys(ACTIONS)).map((a) => <option key={a} value={a}>{actionInfo(a)[0]}</option>)}
        </select>
        <label style={{ fontSize: 12, color: "#888", display: "flex", alignItems: "center", gap: 6 }}>From
          <input type="date" value={from} max={to || undefined} onChange={changeFilter(setFrom)} style={field} />
        </label>
        <label style={{ fontSize: 12, color: "#888", display: "flex", alignItems: "center", gap: 6 }}>To
          <input type="date" value={to} min={from || undefined} onChange={changeFilter(setTo)} style={field} />
        </label>
        {hasFilters && (
          <button onClick={clearFilters} style={{ background: "none", border: "none", color: PINK, fontWeight: 700, fontSize: 12, cursor: "pointer", padding: "6px 4px" }}>Clear filters</button>
        )}
      </div>

      {error ? (
        <div style={{ textAlign: "center", padding: "50px 24px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14 }}>
          <p style={{ color: PINK, fontWeight: 700, margin: "0 0 14px" }}>{error}</p>
          <button onClick={load} style={{ background: "linear-gradient(135deg,#f9a8d4,#be185d)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 12, padding: "10px 18px", cursor: "pointer" }}>TRY AGAIN</button>
        </div>
      ) : !data ? (
        <div style={{ textAlign: "center", padding: 60, color: PINK, fontWeight: 600 }}>Loading activity...</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "56px 24px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, color: "#aaa" }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>📜</div>
          <div style={{ fontWeight: 700, color: "#777" }}>{hasFilters ? "No activity matches these filters" : "No activity recorded yet"}</div>
        </div>
      ) : (
        <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
          <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(190,24,93,0.05)" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
                <thead>
                  <tr style={{ background: "#fbcfe8" }}>
                    {["DATE & TIME", "WHO", "ACTION", "DETAILS"].map((h) => <th key={h} style={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const [label, tone] = actionInfo(r.action);
                    const c = TONES[tone];
                    const rs = ROLE_STYLE[r.actor_role] || ROLE_STYLE.customer;
                    return (
                      <tr key={r.id} style={{ background: i % 2 ? "#fff5f7" : "#fff", borderTop: `1px solid ${LINE}` }}>
                        <td style={{ ...td, whiteSpace: "nowrap" }}>
                          <time dateTime={r.created_at}>
                            <div style={{ fontWeight: 700, color: "#1a1a1a" }}>{phDate(r.created_at)}</div>
                            <div style={{ fontSize: 12, color: "#888" }}>{phTime(r.created_at)}</div>
                          </time>
                        </td>
                        <td style={td}>
                          <div style={{ fontWeight: 700, color: "#1a1a1a" }}>{r.actor_name}</div>
                          <span style={{ display: "inline-block", marginTop: 3, padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 800, background: rs.bg, color: rs.fg, border: `1px solid ${rs.bd}` }}>{rs.label}</span>
                        </td>
                        <td style={td}>
                          <span style={{ display: "inline-block", padding: "4px 11px", borderRadius: 20, fontSize: 11, fontWeight: 800, background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, whiteSpace: "nowrap" }}>{label}</span>
                        </td>
                        <td style={{ ...td, color: "#555", lineHeight: 1.45 }}>{r.summary || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
            <span style={{ fontSize: 12, color: "#999" }}>Showing {firstShown}–{lastShown} of {total}</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading} style={{ background: "#fff", border: `1.5px solid ${LINE}`, borderRadius: 8, color: PINK, fontWeight: 700, fontSize: 12, padding: "7px 14px", cursor: "pointer", opacity: page <= 1 ? 0.5 : 1 }}>← Newer</button>
              <span style={{ fontSize: 12, color: "#777", fontWeight: 600 }}>Page {page} of {pages}</span>
              <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages || loading} style={{ background: "#fff", border: `1.5px solid ${LINE}`, borderRadius: 8, color: PINK, fontWeight: 700, fontSize: 12, padding: "7px 14px", cursor: "pointer", opacity: page >= pages ? 0.5 : 1 }}>Older →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}