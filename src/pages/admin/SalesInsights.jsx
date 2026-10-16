import { useState, useEffect, useCallback } from "react";
import { apiFetch, fmt } from "../../utils/api";
import { useApp } from "../../context/AppContext";

// Rule-based insights: every number and sentence comes from /api/admin/sales-insights
// (routes/insights.cjs). No AI is involved.

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const PINK = "#be185d";
const LINE = "#fce7f3";

const card = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, boxShadow: "0 2px 12px rgba(190,24,93,0.05)" };
const ghostBtn = { background: "#fff", border: `1.5px solid ${LINE}`, borderRadius: 10, color: PINK, fontWeight: 700, fontSize: 12, padding: "9px 16px", cursor: "pointer" };
const primaryBtn = { background: "linear-gradient(135deg,#f9a8d4,#be185d)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 12, padding: "9px 16px", cursor: "pointer" };

const INSIGHT_STYLE = {
  warning: { bar: "#d97706", bg: "#fffbeb", tag: "Needs attention", tagColor: "#b45309" },
  good: { bar: "#16a34a", bg: "#f0fdf4", tag: "Going well", tagColor: "#15803d" },
  info: { bar: "#9ca3af", bg: "#fafafa", tag: "Worth knowing", tagColor: "#6b7280" },
};

const shortDate = (key) => new Date(`${key}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
const longDate = (key) => new Date(`${key}T00:00:00`).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
const axisMoney = (v) => (v >= 1000 ? `₱${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `₱${Math.round(v)}`);

function niceCeil(max) {
  const mag = Math.pow(10, Math.floor(Math.log10(max)));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * mag >= max);
  return step * mag;
}

// ── Revenue chart: solid bars = actual, outlined bars = forecast ──
function RevenueChart({ daily, forecast }) {
  const W = 760, H = 270, padL = 50, padR = 10, padT = 14, padB = 30;
  const fc = forecast?.available ? forecast.days : [];
  const all = [...daily.map((d) => ({ ...d, f: false })), ...fc.map((d) => ({ ...d, f: true }))];
  const top = niceCeil(Math.max(1, ...all.map((d) => d.revenue)));
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const slot = innerW / all.length;
  const bw = Math.max(1.5, slot * 0.7);
  const y = (v) => padT + innerH - (v / top) * innerH;
  const tickEvery = Math.ceil(all.length / 7);
  const ticks = [0, top / 2, top];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img"
      aria-label={`Daily revenue for the last ${daily.length} days${fc.length ? ", with a 7-day forecast" : ""}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={LINE} strokeWidth="1" />
          <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#999">{axisMoney(t)}</text>
        </g>
      ))}

      {all.map((d, i) => {
        const x = padL + i * slot + (slot - bw) / 2;
        const h = Math.max(d.revenue > 0 ? 2 : 0, (d.revenue / top) * innerH);
        return (
          <rect key={d.date} x={x} y={padT + innerH - h} width={bw} height={h} rx={Math.min(3, bw / 3)}
            fill={d.f ? "rgba(190,24,93,0.08)" : PINK}
            stroke={d.f ? PINK : "none"} strokeWidth={d.f ? 1 : 0} strokeDasharray={d.f ? "3 2" : undefined}>
            <title>{`${longDate(d.date)}: ${fmt(d.revenue)}${d.f ? " (forecast)" : ` from ${d.orders} order${d.orders === 1 ? "" : "s"}`}`}</title>
          </rect>
        );
      })}

      {fc.length > 0 && (
        <g>
          <line x1={padL + daily.length * slot} x2={padL + daily.length * slot} y1={padT} y2={padT + innerH} stroke="#d1d5db" strokeDasharray="2 3" />
          <text x={padL + daily.length * slot + 6} y={padT + 10} fontSize="11" fill="#9ca3af">forecast</text>
        </g>
      )}

      {all.map((d, i) =>
        i % tickEvery === 0 ? (
          <text key={`t-${d.date}`} x={padL + i * slot + slot / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#999">{shortDate(d.date)}</text>
        ) : null,
      )}
    </svg>
  );
}

function Change({ value, hasPrev }) {
  if (!hasPrev || value === null || value === undefined) return <span style={{ color: "#aaa", fontSize: 12 }}>nothing to compare yet</span>;
  const up = value > 0;
  const flat = Math.abs(value) < 1;
  const color = flat ? "#9ca3af" : up ? "#16a34a" : "#dc2626";
  return <span style={{ color, fontSize: 12, fontWeight: 700 }}>{flat ? "no change" : `${up ? "▲" : "▼"} ${Math.abs(Math.round(value))}%`}<span style={{ color: "#aaa", fontWeight: 500 }}> vs previous period</span></span>;
}

function Kpi({ label, value, change, hasPrev }) {
  return (
    <div style={{ ...card, padding: "16px 18px" }}>
      <div style={{ fontSize: 12, color: "#888", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#1a1a1a", marginBottom: 6 }}>{value}</div>
      <Change value={change} hasPrev={hasPrev} />
    </div>
  );
}

function ShareBar({ pct }) {
  return (
    <div style={{ height: 6, background: "#fdf2f8", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: "linear-gradient(90deg,#f9a8d4,#be185d)" }} />
    </div>
  );
}

export default function SalesInsights() {
  const { user } = useApp();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch(`/admin/sales-insights?days=${days}${fresh ? "&fresh=1" : ""}`));
    } catch (e) {
      setError(e.message || "Could not load insights");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  if (!user || user.role !== "admin") return null;

  const k = data?.kpis;
  const hasPrev = !!k && k.previous.orders > 0;

  return (
    <div style={{ padding: "28px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#1a1a1a", margin: "0 0 4px" }}>Sales insights</h1>
          <p style={{ color: "#aaa", fontSize: 13, margin: 0 }}>Paid orders only, counted by the day they were placed (Philippine time)</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div role="group" aria-label="Time range" style={{ display: "flex", background: "#fff", border: `1.5px solid ${LINE}`, borderRadius: 10, overflow: "hidden" }}>
            {RANGES.map((r) => (
              <button key={r.days} onClick={() => setDays(r.days)} aria-pressed={days === r.days}
                style={{ border: "none", cursor: "pointer", padding: "9px 14px", fontSize: 12, fontWeight: 700, background: days === r.days ? PINK : "transparent", color: days === r.days ? "#fff" : "#888" }}>
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={() => load(true)} disabled={loading} style={{ ...ghostBtn, opacity: loading ? 0.6 : 1 }}>↻ Refresh</button>
        </div>
      </div>

      {error ? (
        <div style={{ ...card, textAlign: "center", padding: "50px 24px" }}>
          <p style={{ color: PINK, fontWeight: 700, margin: "0 0 14px" }}>{error}</p>
          <button onClick={() => load(true)} style={primaryBtn}>TRY AGAIN</button>
        </div>
      ) : !data ? (
        <div style={{ textAlign: "center", padding: 60, color: PINK, fontWeight: 600 }}>Crunching your orders...</div>
      ) : (
        <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 18 }}>
            <Kpi label="Revenue" value={fmt(k.revenue)} change={k.change.revenue} hasPrev={hasPrev} />
            <Kpi label="Paid orders" value={k.orders} change={k.change.orders} hasPrev={hasPrev} />
            <Kpi label="Average order" value={fmt(k.aov)} change={k.change.aov} hasPrev={hasPrev} />
            <Kpi label="Items sold" value={k.units} change={k.change.units} hasPrev={hasPrev} />
          </div>

          {/* Chart */}
          <div style={{ ...card, padding: "18px 18px 12px", marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 800, margin: 0, color: "#1a1a1a" }}>Daily revenue</h2>
              <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#888" }}>
                <span><span style={{ display: "inline-block", width: 10, height: 10, background: PINK, borderRadius: 2, marginRight: 6 }} />Actual</span>
                {data.forecast.available && (
                  <span><span style={{ display: "inline-block", width: 10, height: 10, border: `1px dashed ${PINK}`, background: "rgba(190,24,93,0.08)", borderRadius: 2, marginRight: 6 }} />Forecast</span>
                )}
              </div>
            </div>
            <RevenueChart daily={data.daily} forecast={data.forecast} />
            {!data.forecast.available && (
              <p style={{ margin: "6px 2px 4px", fontSize: 12, color: "#999" }}>{data.forecast.reason}</p>
            )}
          </div>

          {/* Insights */}
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 800, margin: "0 0 10px", color: "#1a1a1a" }}>What stands out</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.insights.map((i, idx) => {
                const s = INSIGHT_STYLE[i.type] || INSIGHT_STYLE.info;
                return (
                  <div key={idx} style={{ ...card, background: s.bg, borderLeft: `4px solid ${s.bar}`, padding: "13px 16px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: s.tagColor, marginBottom: 3 }}>{s.tag}</div>
                    <div style={{ fontWeight: 800, color: "#1a1a1a", fontSize: 14, marginBottom: 3 }}>{i.title}</div>
                    <div style={{ fontSize: 13, color: "#555", lineHeight: 1.5 }}>{i.detail}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Products */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, marginBottom: 18 }}>
            <div style={{ ...card, padding: "18px" }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 800, margin: "0 0 12px", color: "#1a1a1a" }}>Top sellers</h2>
              {data.topProducts.length === 0 ? (
                <p style={{ color: "#aaa", fontSize: 13, margin: 0 }}>No items sold in this period.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {data.topProducts.map((p) => (
                    <div key={p.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, marginBottom: 5 }}>
                        <span style={{ fontWeight: 700, color: "#1a1a1a" }}>{p.title} <span style={{ color: "#aaa", fontWeight: 500 }}>· {p.units} sold</span></span>
                        <span style={{ fontWeight: 800, color: PINK, whiteSpace: "nowrap" }}>{fmt(p.revenue)}</span>
                      </div>
                      <ShareBar pct={p.share} />
                    </div>
                  ))}
                </div>
              )}
              {data.categories.length > 1 && (
                <p style={{ margin: "14px 0 0", paddingTop: 12, borderTop: `1px solid ${LINE}`, fontSize: 12, color: "#888", lineHeight: 1.6 }}>
                  By category: {data.categories.map((c) => `${c.category} ${Math.round(c.share)}%`).join(", ")}
                </p>
              )}
            </div>

            <div style={{ ...card, padding: "18px" }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 800, margin: "0 0 12px", color: "#1a1a1a" }}>Stock to act on</h2>
              {data.restock.length === 0 && data.slowMovers.count === 0 ? (
                <p style={{ color: "#aaa", fontSize: 13, margin: 0 }}>Nothing needs attention right now.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.restock.map((r) => (
                    <div key={r.title} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                      <span style={{ fontWeight: 700, color: "#1a1a1a" }}>{r.title}</span>
                      <span style={{ color: r.soldOut ? "#dc2626" : "#b45309", fontWeight: 700, textAlign: "right" }}>
                        {r.soldOut ? "Out of stock" : `${r.stock} left, about ${r.daysLeft} day${r.daysLeft === 1 ? "" : "s"}`}
                      </span>
                    </div>
                  ))}
                  {data.slowMovers.count > 0 && (
                    <div style={{ marginTop: data.restock.length ? 6 : 0, paddingTop: data.restock.length ? 12 : 0, borderTop: data.restock.length ? `1px solid ${LINE}` : "none" }}>
                      <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Not selling this period (about {fmt(data.slowMovers.valueTied)} of stock)</div>
                      {data.slowMovers.items.slice(0, 5).map((s) => (
                        <div key={s.title} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, marginBottom: 6 }}>
                          <span style={{ color: "#444" }}>{s.title}</span>
                          <span style={{ color: "#888" }}>{s.stock} in stock</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <p style={{ fontSize: 12, color: "#aaa", lineHeight: 1.6, margin: "0 2px" }}>
            How this works: every figure is calculated directly from your orders and every sentence follows a fixed rule, with no AI involved.
            The forecast is a straight-line trend over the last {data.forecast.basedOnDays || 28} days, so treat it as a rough guide.
            Compared period: {shortDate(data.range.from)} to {shortDate(data.range.to)} against {shortDate(data.range.previousFrom)} to {shortDate(data.range.previousTo)}.
          </p>
        </div>
      )}
    </div>
  );
}
