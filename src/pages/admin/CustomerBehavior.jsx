import { useCallback, useEffect, useState } from "react";
import { apiFetch, fmt } from "../../utils/api";
import CustomerName from "../../components/CustomerName";

const RANGES = [30, 90, 180];
const PINK = "#be185d";
const LINE = "#fce7f3";
const card = {
  background: "#fff",
  border: `1px solid ${LINE}`,
  borderRadius: 14,
  boxShadow: "0 2px 12px rgba(190,24,93,0.05)",
};
const insightStyle = {
  warning: { bar: "#d97706", bg: "#fffbeb", label: "Needs attention", color: "#b45309" },
  good: { bar: "#16a34a", bg: "#f0fdf4", label: "Going well", color: "#15803d" },
  info: { bar: "#9ca3af", bg: "#fafafa", label: "Worth knowing", color: "#6b7280" },
};
const percent = (value) => (value == null ? "Not enough data" : `${Math.round(value)}%`);

function Metric({ label, value, note }) {
  return (
    <div style={{ ...card, padding: "16px 18px" }}>
      <div style={{ fontSize: 12, color: "#888", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: "#1a1a1a", marginBottom: 5 }}>{value}</div>
      {note && <div style={{ fontSize: 11, color: "#999" }}>{note}</div>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ ...card, padding: 18 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: "#1a1a1a", margin: "0 0 14px" }}>{title}</h2>
      {children}
    </section>
  );
}

export default function CustomerBehavior() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch(`/admin/customer-insights?days=${days}${fresh ? "&fresh=1" : ""}`));
    } catch (err) {
      setError(err.message || "Could not load customer behavior");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  return (
    <main style={{ padding: "28px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#1a1a1a", margin: "0 0 4px" }}>
            Customer behavior
          </h1>
          <p style={{ color: "#999", fontSize: 13, margin: 0 }}>
            Rule-based analysis from customer, order and cart history. Customer history is limited to the last 12 months.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div role="group" aria-label="Analysis period" style={{ display: "flex", background: "#fff", border: `1.5px solid ${LINE}`, borderRadius: 10, overflow: "hidden" }}>
            {RANGES.map((range) => (
              <button
                key={range}
                onClick={() => setDays(range)}
                aria-pressed={days === range}
                style={{ border: "none", cursor: "pointer", padding: "9px 13px", fontSize: 12, fontWeight: 700, background: days === range ? PINK : "transparent", color: days === range ? "#fff" : "#888" }}
              >
                {range} days
              </button>
            ))}
          </div>
          <button
            onClick={() => load(true)}
            disabled={loading}
            style={{ background: "#fff", border: `1.5px solid ${LINE}`, borderRadius: 10, color: PINK, fontWeight: 700, fontSize: 12, padding: "9px 14px", cursor: "pointer", opacity: loading ? 0.6 : 1 }}
          >
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <div style={{ ...card, textAlign: "center", padding: 40 }}>
          <p style={{ color: PINK, fontWeight: 700 }}>{error}</p>
          <button onClick={() => load(true)} style={{ background: PINK, border: 0, borderRadius: 9, color: "#fff", padding: "9px 16px", fontWeight: 700, cursor: "pointer" }}>Try again</button>
        </div>
      ) : !data ? (
        <div style={{ textAlign: "center", padding: 50, color: PINK }}>{loading ? "Analyzing customer activity..." : "No report available."}</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 16, opacity: loading ? 0.6 : 1 }}>
            <Metric label={`Active buyers · ${days} days`} value={data.overview.activeBuyers} />
            <Metric label="First-time buyers" value={data.overview.newBuyers} note={`In ${days} days · based on 12 months of order history`} />
            <Metric label="Returning buyers" value={data.overview.returningBuyers} note={`In ${days} days`} />
            <Metric label="Repeat customer rate" value={percent(data.overview.repeatRate)} note={`${data.overview.repeatBuyers} repeat buyers in 12 months`} />
            <Metric label="New sign-ups" value={data.overview.newSignups} note={`${data.overview.signupsWhoBought} bought · ${percent(data.overview.signupConversion)} conversion`} />
            <Metric label="Revenue from returning buyers" value={fmt(data.overview.returningRevenue)} note={`${percent(data.overview.returningRevenueShare)} of period revenue`} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 16 }}>
            <Section title="Customer segments · last 12 months">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {data.segments.map((segment) => (
                  <div key={segment.key}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 3 }}>
                      <strong style={{ fontSize: 13, color: "#333" }}>{segment.label} <span style={{ color: "#999", fontWeight: 500 }}>({segment.count})</span></strong>
                      <span style={{ fontSize: 12, color: PINK, fontWeight: 700 }}>{percent(segment.revenueShare)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#999" }}>{segment.hint} · {fmt(segment.revenue)} revenue</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Customers to win back">
              {data.winBack.length === 0 ? (
                <p style={{ color: "#999", fontSize: 13, margin: 0 }}>No overdue repeat buyers found in the available history.</p>
              ) : (
                <>
                  <p style={{ color: "#999", fontSize: 12, margin: "0 0 10px" }}>{data.winBackTotal} customers are overdue based on their usual reorder rhythm. First names only.</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {data.winBack.map((customer, index) => (
                      <div key={`${customer.name}-${customer.lastOrder}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: `1px solid ${LINE}`, paddingBottom: 8 }}>
                        <div>
                          <strong style={{ fontSize: 13 }}>
                            <CustomerName name={customer.name} status={customer.status} />
                          </strong>
                          <div style={{ color: "#999", fontSize: 11 }}>{customer.orders} orders · usually every ~{customer.usualGapDays} days</div>
                        </div>
                        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <strong style={{ color: PINK, fontSize: 13 }}>{customer.daysSince} days ago</strong>
                          <div style={{ color: "#999", fontSize: 11 }}>{fmt(customer.spent)} total</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Section>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 16 }}>
            <Section title="Shopping patterns">
              <div style={{ fontSize: 13, color: "#555", lineHeight: 1.8 }}>
                <div><strong>{data.basket.avgItemsPerOrder}</strong> items per order on average · <strong>{percent(data.basket.multiItemShare)}</strong> multi-item orders</div>
                <div><strong>{data.repeatRhythm.medianDaysToSecondOrder ?? "Not enough data"}</strong>{data.repeatRhythm.medianDaysToSecondOrder !== null ? " median days until a second order" : " for median time to second order"}</div>
                {data.concentration.available ? (
                  <div>Top {data.concentration.topCount} buyers account for <strong>{percent(data.concentration.topShare)}</strong> of 12-month revenue.</div>
                ) : (
                  <div>Revenue concentration appears after at least 10 buyers.</div>
                )}
              </div>
              {data.basket.pairs.length > 0 && (
                <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 12, paddingTop: 10 }}>
                  <strong style={{ fontSize: 12, color: "#555" }}>Often bought together</strong>
                  {data.basket.pairs.map((pair) => (
                    <div key={`${pair.a}-${pair.b}`} style={{ fontSize: 12, color: "#777", marginTop: 5 }}>
                      {pair.a} + {pair.b} · {pair.orders} orders · {percent(pair.confidence)} association
                    </div>
                  ))}
                </div>
              )}
              {!data.basket.available && <p style={{ fontSize: 11, color: "#999", margin: "10px 0 0" }}>Basket patterns need at least 15 paid orders in the last six months.</p>}
            </Section>

            <Section title="Peak ordering time · last 6 months">
              {data.timing.available ? (
                <>
                  <strong style={{ fontSize: 18, color: PINK }}>{data.timing.peak.label}</strong>
                  <p style={{ fontSize: 12, color: "#888", margin: "4px 0 12px" }}>{percent(data.timing.peak.share)} of orders fall in this three-hour period.</p>
                  <div aria-label="Paid orders by hour" style={{ height: 70, display: "flex", alignItems: "flex-end", gap: 2 }}>
                    {data.timing.byHour.map((hour) => {
                      const max = Math.max(1, ...data.timing.byHour.map((row) => row.orders));
                      return <div key={hour.hour} title={`${hour.hour}:00 · ${hour.orders} orders`} style={{ flex: 1, height: `${Math.max(4, (hour.orders / max) * 100)}%`, background: "#f9a8d4", borderRadius: "3px 3px 0 0" }} />;
                    })}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", fontSize: 10, marginTop: 4 }}><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span></div>
                </>
              ) : (
                <p style={{ fontSize: 13, color: "#999", margin: 0 }}>Peak-time analysis appears after 20 paid orders in the last six months. {data.timing.totalOrders} found.</p>
              )}
            </Section>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 16 }}>
            <Section title="Payments and cancellations">
              {data.payments.methods.length ? (
                <div style={{ marginBottom: 12 }}>
                  {data.payments.methods.map((method) => (
                    <div key={method.method} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", color: "#555" }}>
                      <span>{method.method}</span><span>{method.orders} orders · {percent(method.share)}</span>
                    </div>
                  ))}
                </div>
              ) : <p style={{ color: "#999", fontSize: 13 }}>No paid orders in this period.</p>}
              <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 10, fontSize: 13, color: "#555", lineHeight: 1.9 }}>
                <div>Unpaid over one day: <strong>{data.payments.unpaid.count}</strong> · {fmt(data.payments.unpaid.value)}</div>
                <div>Cancelled: <strong>{data.payments.cancellations.cancelled}/{data.payments.cancellations.placed}</strong> orders · {percent(data.payments.cancellations.rate)}</div>
                <div>Customers with 2+ cancellations: <strong>{data.payments.cancellations.repeatCancellers}</strong></div>
              </div>
            </Section>

            <Section title="Abandoned carts">
              {data.carts.available ? (
                data.carts.customers ? (
                  <>
                    <p style={{ color: "#555", fontSize: 13, margin: "0 0 8px" }}>{data.carts.customers} customers have had items in their cart for 3+ days, worth about <strong>{fmt(data.carts.value)}</strong>.</p>
                    {data.carts.topItems.map((item) => <div key={item.title} style={{ color: "#888", fontSize: 12, padding: "3px 0" }}>{item.title} · in {item.carts} carts</div>)}
                  </>
                ) : <p style={{ color: "#999", fontSize: 13, margin: 0 }}>No aged abandoned carts found.</p>
              ) : <p style={{ color: "#999", fontSize: 13, margin: 0 }}>Cart-age analysis is unavailable because cart records do not provide usable timestamps.</p>}
            </Section>
          </div>

          <Section title="What stands out">
            {data.insights.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {data.insights.map((insight, index) => {
                  const style = insightStyle[insight.type] || insightStyle.info;
                  return (
                    <article key={`${insight.title}-${index}`} style={{ background: style.bg, borderLeft: `4px solid ${style.bar}`, borderRadius: 8, padding: "11px 13px" }}>
                      <div style={{ fontSize: 10, color: style.color, fontWeight: 700, marginBottom: 3 }}>{style.label}</div>
                      <strong style={{ fontSize: 13, color: "#222" }}>{insight.title}</strong>
                      <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5, marginTop: 3 }}>{insight.detail}</div>
                    </article>
                  );
                })}
              </div>
            ) : <p style={{ color: "#999", fontSize: 13, margin: 0 }}>Not enough activity to highlight a customer behavior pattern yet.</p>}
            {data.anomalies.length > 0 && (
              <p style={{ borderTop: `1px solid ${LINE}`, paddingTop: 10, margin: "12px 0 0", color: "#888", fontSize: 12 }}>
                Unusual revenue days: {data.anomalies.map((row) => `${row.date} (${row.direction}, ${fmt(row.revenue)})`).join(" · ")}
              </p>
            )}
          </Section>
          <p style={{ color: "#aaa", fontSize: 11, lineHeight: 1.5, margin: "12px 2px" }}>
            Analysis uses paid, non-cancelled orders for purchase behavior. Segment, reorder and concentration figures cover the available 12-month order history; basket and peak-time analysis use six months. Insights are descriptive, not predictions.
          </p>
        </>
      )}
    </main>
  );
}
