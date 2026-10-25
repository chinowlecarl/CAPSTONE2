// routes/insights.cjs
//
// Rule-based sales insights for the admin dashboard.
// NO AI / LLM involved: every number is calculated from your tables and every
// sentence comes from a fixed rule below, so it is free, instant and explainable.
//
//   GET /api/admin/sales-insights?days=7|14|30|90     (add &fresh=1 to skip the 60s cache)
//
// Rules of the road
//   - Revenue = orders that are PAID and not cancelled, dated by when the order was placed.
//   - Days are Philippine time (UTC+8, no daylight saving).
//   - "Previous period" = the same number of days directly before the selected period.
//   - Forecast = straight-line trend over the last 28 days, next 7 days. Only shown when
//     there is enough history, and always labelled as an estimate.

module.exports = function registerInsightRoutes(
  app,
  { supabase, auth, adminOnly },
) {
  const DAY = 24 * 60 * 60 * 1000;
  const TZ_OFFSET = 8 * 60 * 60 * 1000; // Asia/Manila
  const WEEKDAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const ALLOWED_RANGES = [7, 14, 30, 90];
  const HISTORY_DAYS = 28;
  const FORECAST_DAYS = 7;
  const CACHE_MS = 60 * 1000;

  // ── small helpers ──────────────────────────────────────────
  const dayKey = (t) =>
    new Date(new Date(t).getTime() + TZ_OFFSET).toISOString().slice(0, 10);
  const addDays = (key, n) =>
    new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY)
      .toISOString()
      .slice(0, 10);
  const weekdayOf = (key) => new Date(`${key}T00:00:00Z`).getUTCDay();
  const round1 = (n) => Math.round(n * 10) / 10;
  const round2 = (n) => Math.round(n * 100) / 100;
  const peso = (n) => `₱${Math.round(n).toLocaleString("en-US")}`;
  const pct = (cur, prev) =>
    prev > 0 ? round1(((cur - prev) / prev) * 100) : null;
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const sum = (arr) => arr.reduce((s, x) => s + x, 0);
  const ageText = (hours) =>
    hours < 48
      ? `${Math.max(1, Math.round(hours))} hours`
      : `${Math.round(hours / 24)} days`;

  // Supabase returns max 1000 rows per request, so read in pages.
  async function fetchPaged(makeQuery) {
    const out = [];
    const size = 1000;
    for (let from = 0; out.length < 20000; from += size) {
      const { data, error } = await makeQuery().range(from, from + size - 1);
      if (error) throw error;
      out.push(...data);
      if (data.length < size) break;
    }
    return out;
  }

  const periodStats = (orders) => {
    const revenue = sum(orders.map((o) => o.amount));
    const units = sum(
      orders.flatMap((o) =>
        (o.order_items || []).map((i) => Number(i.quantity) || 0),
      ),
    );
    return {
      revenue: round2(revenue),
      orders: orders.length,
      units,
      aov: orders.length ? round2(revenue / orders.length) : 0,
    };
  };

  // ── forecast: least-squares line through the last 28 days ──
  function buildForecast(history, today) {
    const orderCount = sum(history.map((d) => d.orders));
    const activeDays = history.filter((d) => d.orders > 0).length;
    if (orderCount < 10 || activeDays < 5) {
      return {
        available: false,
        reason: `Not enough sales history yet (${plural(orderCount, "paid order")} on ${plural(activeDays, "day")} in the last ${HISTORY_DAYS} days). A forecast needs at least 10 orders across 5 different days.`,
        days: [],
        total: 0,
      };
    }
    const n = history.length;
    const ys = history.map((d) => d.revenue);
    const mx = (n - 1) / 2;
    const my = sum(ys) / n;
    let num = 0;
    let den = 0;
    ys.forEach((y, i) => {
      num += (i - mx) * (y - my);
      den += (i - mx) ** 2;
    });
    const slope = den ? num / den : 0;
    const intercept = my - slope * mx;
    const best = Math.max(...ys);

    const days = Array.from({ length: FORECAST_DAYS }, (_, i) => {
      const raw = intercept + slope * (n - 1 + (i + 1));
      return {
        date: addDays(today, i + 1),
        revenue: round2(Math.min(best, Math.max(0, raw))),
      };
    });

    const drift = my > 0 ? (slope * (n - 1)) / my : 0; // change across the window relative to average
    return {
      available: true,
      days,
      total: round2(sum(days.map((d) => d.revenue))),
      trend: drift > 0.25 ? "rising" : drift < -0.25 ? "falling" : "steady",
      confidence: orderCount >= 30 && activeDays >= 14 ? "medium" : "low",
      basedOnDays: n,
    };
  }

  // ── the report ─────────────────────────────────────────────
  async function buildReport(days) {
    const now = Date.now();
    const today = dayKey(now);
    const curStart = addDays(today, -(days - 1));
    const prevStart = addDays(today, -(2 * days - 1));
    const prevEnd = addDays(curStart, -1);
    const lookback = Math.max(2 * days, HISTORY_DAYS);
    const fetchFrom = new Date(
      Date.parse(`${addDays(today, -(lookback - 1))}T00:00:00Z`) - TZ_OFFSET,
    ).toISOString();

    const [orders, products, pendingRows] = await Promise.all([
      fetchPaged(() =>
        supabase
          .from("orders")
          .select(
            "id,total_amount,status,payment_status,created_at,order_items(product_id,quantity,unit_price,products(title,category))",
          )
          .gte("created_at", fetchFrom)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true }),
      ),
      // archived products are not for sale, so they are ignored here
      // (falls back to "all products" if the archive migration has not been run yet)
      fetchPaged(() =>
        supabase
          .from("products")
          .select("id,title,category,price,stock,created_at")
          .is("archived_at", null)
          .order("id", { ascending: true }),
      ).catch((err) => {
        if (/archived_at/.test(err.message || ""))
          return fetchPaged(() =>
            supabase
              .from("products")
              .select("id,title,category,price,stock,created_at")
              .order("id", { ascending: true }),
          );
        throw err;
      }),
      fetchPaged(() =>
        supabase
          .from("orders")
          .select("id,created_at,updated_at")
          .eq("payment_status", "PENDING_VERIFICATION")
          .order("id", { ascending: true }),
      ),
    ]);

    // Split orders into: revenue orders (paid, not cancelled) and "placed" counts for cancellations.
    const paid = [];
    let placedCur = 0;
    let cancelledCur = 0;
    for (const o of orders) {
      const day = dayKey(o.created_at);
      const cancelled = o.status === "cancelled";
      if (day >= curStart) {
        placedCur++;
        if (cancelled) cancelledCur++;
      }
      if (o.payment_status === "PAID" && !cancelled)
        paid.push({ ...o, day, amount: Number(o.total_amount) || 0 });
    }

    const curPaid = paid.filter((o) => o.day >= curStart);
    const prevPaid = paid.filter((o) => o.day >= prevStart && o.day <= prevEnd);
    const cur = periodStats(curPaid);
    const prev = periodStats(prevPaid);

    // Daily series (zero-filled)
    const byDay = {};
    for (const o of paid) {
      const d = (byDay[o.day] = byDay[o.day] || { revenue: 0, orders: 0 });
      d.revenue += o.amount;
      d.orders += 1;
    }
    const series = (from, count) =>
      Array.from({ length: count }, (_, i) => {
        const date = addDays(from, i);
        const d = byDay[date] || { revenue: 0, orders: 0 };
        return { date, revenue: round2(d.revenue), orders: d.orders };
      });
    const daily = series(curStart, days);
    const history = series(addDays(today, -(HISTORY_DAYS - 1)), HISTORY_DAYS);
    const forecast = buildForecast(history, today);

    // Products and categories (current period only)
    const prodMap = new Map();
    const catMap = new Map();
    for (const o of curPaid) {
      for (const it of o.order_items || []) {
        const qty = Number(it.quantity) || 0;
        const rev = qty * (Number(it.unit_price) || 0);
        const title = it.products?.title || "Deleted product";
        const category = it.products?.category || "Uncategorised";
        const p = prodMap.get(it.product_id) || {
          id: it.product_id,
          title,
          category,
          units: 0,
          revenue: 0,
        };
        p.units += qty;
        p.revenue += rev;
        prodMap.set(it.product_id, p);
        const c = catMap.get(category) || { category, units: 0, revenue: 0 };
        c.units += qty;
        c.revenue += rev;
        catMap.set(category, c);
      }
    }
    const itemRevenue = sum([...prodMap.values()].map((p) => p.revenue));
    const share = (rev) =>
      itemRevenue > 0 ? round1((rev / itemRevenue) * 100) : 0;
    const topProducts = [...prodMap.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((p) => ({
        ...p,
        revenue: round2(p.revenue),
        share: share(p.revenue),
      }));
    const categories = [...catMap.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((c) => ({
        ...c,
        revenue: round2(c.revenue),
        share: share(c.revenue),
      }));

    // Stock rules
    const restock = [];
    const slowAll = [];
    for (const p of products) {
      const stock = Number(p.stock) || 0;
      const sold = prodMap.get(p.id)?.units || 0;
      if (sold > 0) {
        const velocity = sold / days;
        const daysLeft = stock / velocity;
        if (stock <= 0)
          restock.push({
            title: p.title,
            stock: 0,
            sold,
            soldPerWeek: round1(velocity * 7),
            daysLeft: 0,
            soldOut: true,
          });
        else if (daysLeft <= 14)
          restock.push({
            title: p.title,
            stock,
            sold,
            soldPerWeek: round1(velocity * 7),
            daysLeft: Math.max(1, Math.floor(daysLeft)),
            soldOut: false,
          });
      } else if (stock > 0 && dayKey(p.created_at) < curStart) {
        slowAll.push({
          title: p.title,
          stock,
          valueTied: round2(stock * (Number(p.price) || 0)),
        });
      }
    }
    restock.sort((a, b) => a.daysLeft - b.daysLeft);
    slowAll.sort((a, b) => b.valueTied - a.valueTied);
    const slowMovers = {
      count: slowAll.length,
      valueTied: round2(sum(slowAll.map((s) => s.valueTied))),
      items: slowAll.slice(0, 8),
    };

    // Pending payments
    const oldestHours = pendingRows.length
      ? Math.max(
          ...pendingRows.map(
            (r) => (now - Date.parse(r.updated_at || r.created_at)) / 3600000,
          ),
        )
      : 0;
    const pending = {
      count: pendingRows.length,
      oldestHours: Math.round(oldestHours),
    };

    // ── insight rules ────────────────────────────────────────
    const insights = [];
    const add = (type, title, detail) => insights.push({ type, title, detail });
    const revChange = pct(cur.revenue, prev.revenue);
    const ordersChange = pct(cur.orders, prev.orders);
    const aovChange = pct(cur.aov, prev.aov);

    // 1. Revenue trend
    if (cur.orders === 0) {
      add(
        "warning",
        `No paid sales in the last ${days} days`,
        pending.count > 0
          ? `${plural(pending.count, "payment")} ${pending.count === 1 ? "is" : "are"} waiting for verification. Approving them is the quickest way to get sales on the board.`
          : "Nothing was paid in this period. If customers are placing orders, check that their payments are being verified.",
      );
    } else if (prev.revenue === 0) {
      add(
        "info",
        "Your first paid sales in this comparison",
        `${peso(cur.revenue)} from ${plural(cur.orders, "order")}. There were no paid sales in the previous ${days} days to compare against.`,
      );
    } else if (revChange >= 10) {
      add(
        "good",
        `Revenue is up ${Math.round(revChange)}% on the previous ${days} days`,
        `${peso(cur.revenue)} now vs ${peso(prev.revenue)} before, from ${plural(cur.orders, "order")}.`,
      );
    } else if (revChange <= -10) {
      const why =
        ordersChange !== null && aovChange !== null && ordersChange < aovChange
          ? `The drop comes mostly from fewer orders (${cur.orders} vs ${prev.orders}).`
          : `Orders held up, but the average order is smaller (${peso(cur.aov)} vs ${peso(prev.aov)}).`;
      add(
        "warning",
        `Revenue is down ${Math.abs(Math.round(revChange))}% on the previous ${days} days`,
        `${peso(cur.revenue)} now vs ${peso(prev.revenue)} before. ${why}`,
      );
    } else {
      add(
        "info",
        "Revenue is steady",
        `${peso(cur.revenue)} vs ${peso(prev.revenue)} in the previous ${days} days (${revChange > 0 ? "+" : ""}${revChange}%).`,
      );
    }

    // 2. Small sample caution
    if (cur.orders > 0 && cur.orders < 5) {
      add(
        "info",
        "Small sample size",
        `Only ${plural(cur.orders, "paid order")} in this period, so treat the percentages with caution.`,
      );
    }

    // 3. Average order value
    if (cur.orders >= 5 && prev.orders >= 5 && aovChange !== null) {
      if (aovChange >= 10)
        add(
          "good",
          "Customers are spending more per order",
          `The average order is ${peso(cur.aov)}, up from ${peso(prev.aov)}.`,
        );
      else if (aovChange <= -10)
        add(
          "info",
          "The average order value dropped",
          `${peso(cur.aov)} vs ${peso(prev.aov)} before. Bundles or a free-delivery minimum can lift it.`,
        );
    }

    // 4. Best seller and dependence on it
    if (topProducts.length) {
      const t = topProducts[0];
      if (t.share >= 40 && cur.orders >= 5) {
        add(
          "info",
          `${t.title} brings in ${Math.round(t.share)}% of revenue`,
          `${plural(t.units, "unit")} sold for ${peso(t.revenue)}. Keep it well stocked, and consider promoting a second product so sales depend on it less.`,
        );
      } else {
        add(
          "good",
          `${t.title} is your best seller`,
          `${plural(t.units, "unit")} sold for ${peso(t.revenue)}, ${Math.round(t.share)}% of item revenue.`,
        );
      }
    }

    // 5. Category
    if (categories.length >= 2 && categories[0].share >= 50) {
      add(
        "info",
        `${categories[0].category} is your strongest category`,
        `${Math.round(categories[0].share)}% of item revenue, ahead of ${categories[1].category} at ${Math.round(categories[1].share)}%.`,
      );
    }

    // 6. Best / quietest weekday (uses the 28-day history)
    if (sum(history.map((d) => d.orders)) >= 15) {
      const perDay = WEEKDAYS.map((name, idx) => {
        const rows = history.filter((d) => weekdayOf(d.date) === idx);
        return {
          name,
          avg: rows.length ? sum(rows.map((r) => r.revenue)) / rows.length : 0,
        };
      });
      const overall = sum(history.map((d) => d.revenue)) / history.length;
      const best = [...perDay].sort((a, b) => b.avg - a.avg)[0];
      const worst = [...perDay].sort((a, b) => a.avg - b.avg)[0];
      if (overall > 0 && best.avg >= overall * 1.3) {
        add(
          "info",
          `${best.name}s are your strongest day`,
          `About ${peso(best.avg)} on an average ${best.name}, vs ${peso(overall)} across all days. A good day to run promos or post new items.`,
        );
      }
      if (
        overall > 0 &&
        worst.avg <= overall * 0.5 &&
        worst.name !== best.name
      ) {
        add(
          "info",
          `${worst.name}s are the quietest`,
          `About ${peso(worst.avg)} on an average ${worst.name}. A flash sale or a social post could fill that gap.`,
        );
      }
    }

    // 7. Stock: sold out while selling / running out soon
    const soldOut = restock.filter((r) => r.soldOut);
    const running = restock.filter((r) => !r.soldOut);
    if (soldOut.length) {
      const first = soldOut[0];
      add(
        "warning",
        soldOut.length === 1
          ? `${first.title} is out of stock`
          : `${first.title} and ${plural(soldOut.length - 1, "other product")} are out of stock`,
        `${soldOut.length === 1 ? "It sold" : "They sold"} ${plural(sum(soldOut.map((s) => s.sold)), "unit")} in the last ${days} days, so every day without stock is lost sales.`,
      );
    }
    if (running.length) {
      const list = running
        .slice(0, 3)
        .map(
          (r) =>
            `${r.title} (${r.stock} left, about ${plural(r.daysLeft, "day")})`,
        )
        .join("; ");
      add(
        "warning",
        `${plural(running.length, "product")} will run out within two weeks`,
        `At the current pace: ${list}.`,
      );
    }

    // 8. Slow movers
    if (slowMovers.count > 0 && cur.orders >= 5) {
      const names = slowMovers.items
        .slice(0, 3)
        .map((s) => s.title)
        .join(", ");
      add(
        "info",
        `${plural(slowMovers.count, "product")} had no sales in ${days} days`,
        `${names}${slowMovers.count > 3 ? " and more" : ""}, together holding about ${peso(slowMovers.valueTied)} in stock. A discount or a featured spot could help move them.`,
      );
    }

    // 9. Payments waiting
    if (pending.count > 0 && cur.orders > 0) {
      add(
        pending.oldestHours >= 24 ? "warning" : "info",
        `${plural(pending.count, "payment")} waiting for verification`,
        `The oldest has been waiting ${ageText(pending.oldestHours)}. Those customers are held up until you approve or reject the payment.`,
      );
    }

    // 10. Cancellations
    if (placedCur >= 5 && cancelledCur / placedCur >= 0.2) {
      add(
        "warning",
        `${Math.round((cancelledCur / placedCur) * 100)}% of orders were cancelled`,
        `${cancelledCur} of ${placedCur} orders placed in this period. Check whether customers are cancelling over stock, price or delivery.`,
      );
    }

    // 11. Forecast
    if (forecast.available) {
      add(
        "info",
        `Expect about ${peso(forecast.total)} over the next ${FORECAST_DAYS} days`,
        `The ${HISTORY_DAYS}-day trend is ${forecast.trend}. This is a straight-line estimate from past sales, not a guarantee. Confidence: ${forecast.confidence}.`,
      );
    } else {
      add("info", "No forecast yet", forecast.reason);
    }

    const rank = { warning: 0, good: 1, info: 2 };
    insights.sort((a, b) => rank[a.type] - rank[b.type]);

    return {
      generatedAt: new Date(now).toISOString(),
      range: {
        days,
        from: curStart,
        to: today,
        previousFrom: prevStart,
        previousTo: prevEnd,
        timezone: "Asia/Manila",
      },
      kpis: {
        ...cur,
        previous: prev,
        change: {
          revenue: revChange,
          orders: ordersChange,
          aov: aovChange,
          units: pct(cur.units, prev.units),
        },
      },
      daily,
      forecast,
      topProducts,
      categories,
      restock: restock.slice(0, 8),
      slowMovers,
      pending,
      insights,
    };
  }

  // ── route ──────────────────────────────────────────────────
  const cache = new Map();

  app.get("/api/admin/sales-insights", auth, adminOnly, async (req, res) => {
    const requested = Number(req.query.days);
    const days = ALLOWED_RANGES.includes(requested) ? requested : 30;
    const hit = cache.get(days);
    if (hit && Date.now() - hit.at < CACHE_MS && req.query.fresh !== "1")
      return res.json(hit.payload);
    try {
      const payload = await buildReport(days);
      cache.set(days, { at: Date.now(), payload });
      res.json(payload);
    } catch (err) {
      console.error(`[SALES INSIGHTS ERROR] ${err.message}`);
      res.status(500).json({ error: "Failed to build sales insights" });
    }
  });

  // Customer behaviour analysis lives in its own file but is loaded from here,
  // so server.cjs does not need another require line.
  require("./behavior.cjs")(app, { supabase, auth, adminOnly });
};
