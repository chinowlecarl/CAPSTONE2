// routes/behavior.cjs
//
// Customer behaviour analysis for the admin dashboard.
// "Smart" here means proper statistics on your own data, NOT an AI model:
// every figure is calculated from orders / carts / profiles and every sentence
// comes from a fixed rule, so it is free, instant and explainable.
//
//   GET /api/admin/customer-insights?days=30|90|180   (add &fresh=1 to skip the 60s cache)
//
// What it works out
//   - Customer segments (Champions, Loyal, New, One-time drifting, At risk, Lapsed)
//   - Win-back list: customers overdue compared with THEIR OWN usual reorder rhythm
//   - New vs returning buyers, repeat rate, sign-up to first-purchase conversion
//   - How concentrated revenue is in the top 10% of customers
//   - Peak ordering hours (Philippine time)
//   - Bought-together pairs (market-basket analysis with lift)
//   - Payment methods, unpaid orders, abandoned carts, cancellations
//   - Typical days until a second order, and unusually high/low revenue days
//
// Rules of the road
//   - Revenue orders = PAID and not cancelled. Days are Philippine time (UTC+8).
//   - Customer history looks back 12 months; basket and timing look back 6 months.
//   - Only first names/usernames shown to the admin; no emails or phone numbers are returned.

module.exports = function registerBehavior(app, { supabase, auth, adminOnly }) {
  const DAY = 24 * 60 * 60 * 1000;
  const TZ_OFFSET = 8 * 60 * 60 * 1000;
  const LOOKBACK_DAYS = 365;
  const BASKET_DAYS = 180;
  const ALLOWED_RANGES = [30, 90, 180];
  const CACHE_MS = 60 * 1000;

  // ── helpers ────────────────────────────────────────────────
  const dayKey = (t) => new Date(new Date(t).getTime() + TZ_OFFSET).toISOString().slice(0, 10);
  const addDays = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
  const diffDays = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY);
  const hourOf = (t) => new Date(new Date(t).getTime() + TZ_OFFSET).getUTCHours();
  const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h % 24 < 12 ? "AM" : "PM"}`;
  const round1 = (n) => Math.round(n * 10) / 10;
  const round2 = (n) => Math.round(n * 100) / 100;
  const peso = (n) => `₱${Math.round(n).toLocaleString("en-US")}`;
  const plural = (n, w, pl) => `${n} ${n === 1 ? w : pl || w + "s"}`;
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const share = (part, whole) => (whole > 0 ? round1((part / whole) * 100) : 0);
  const median = (arr) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const listNames = (names) => (names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

  async function fetchPaged(makeQuery) {
    const out = [];
    for (let from = 0; out.length < 20000; from += 1000) {
      const { data, error } = await makeQuery().range(from, from + 999);
      if (error) throw error;
      out.push(...data);
      if (data.length < 1000) break;
    }
    return out;
  }

  // ── segments ───────────────────────────────────────────────
  const SEGMENTS = [
    { key: "champion", label: "Champions", hint: "3+ orders, last one within 30 days" },
    { key: "loyal", label: "Loyal", hint: "2+ orders, last one within 60 days" },
    { key: "new", label: "New", hint: "One order, placed within 30 days" },
    { key: "drifting", label: "One-time, drifting", hint: "One order, 31 to 90 days ago" },
    { key: "atRisk", label: "At risk", hint: "2+ orders but quiet for 61 to 120 days" },
    { key: "lapsed", label: "Lapsed", hint: "Quiet for 4+ months, or a one-time buyer from 3+ months ago" },
  ];
  function classify(orders, recency) {
    if (orders >= 3 && recency <= 30) return "champion";
    if (orders >= 2 && recency <= 60) return "loyal";
    if (orders === 1 && recency <= 30) return "new";
    if (orders === 1 && recency <= 90) return "drifting";
    if (orders >= 2 && recency <= 120) return "atRisk";
    return "lapsed";
  }

  // ── the report ─────────────────────────────────────────────
  async function buildReport(days) {
    const now = Date.now();
    const today = dayKey(now);
    const curStart = addDays(today, -(days - 1));
    const basketStart = addDays(today, -(BASKET_DAYS - 1));
    const since = new Date(Date.parse(`${addDays(today, -(LOOKBACK_DAYS - 1))}T00:00:00Z`) - TZ_OFFSET).toISOString();

    const [orders, profiles] = await Promise.all([
      fetchPaged(() =>
        supabase
          .from("orders")
          .select("id,user_id,total_amount,status,payment_status,payment_method,created_at,order_items(product_id,quantity,unit_price,products(title,category))")
          .gte("created_at", since)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true }),
      ),
      fetchPaged(() => supabase.from("profiles").select("id,fullname,username,role,created_at").order("id", { ascending: true })),
    ]);

    // Carts are optional: if the table has no created_at column this part is simply skipped.
    let carts = null;
    try {
      carts = await fetchPaged(() =>
        supabase.from("cart_items").select("user_id,quantity,created_at,products(title,price,discount)").order("created_at", { ascending: true }),
      );
    } catch (_) {
      carts = null;
    }

    const names = new Map(profiles.map((p) => [p.id, (p.fullname || p.username || "Customer").trim()]));

    // ── per-customer history ───────────────────────────────
    const byUser = new Map();
    const user = (id) => {
      let c = byUser.get(id);
      if (!c) {
        c = { id, name: names.get(id) || "Customer", orders: 0, spent: 0, days: [], cancelled: 0, lastAnyAt: 0 };
        byUser.set(id, c);
      }
      return c;
    };
    const paid = [];
    for (const o of orders) {
      const c = user(o.user_id);
      c.lastAnyAt = Math.max(c.lastAnyAt, Date.parse(o.created_at));
      const cancelled = o.status === "cancelled";
      if (cancelled) c.cancelled++;
      if (o.payment_status === "PAID" && !cancelled) {
        const amount = Number(o.total_amount) || 0;
        const day = dayKey(o.created_at);
        c.orders++;
        c.spent += amount;
        c.days.push(day);
        paid.push({ ...o, userId: o.user_id, amount, day, hour: hourOf(o.created_at) });
      }
    }

    const buyers = [];
    for (const c of byUser.values()) {
      if (!c.orders) continue;
      const uniq = [...new Set(c.days)].sort();
      c.firstDay = uniq[0];
      c.lastDay = uniq.at(-1);
      c.recency = diffDays(today, c.lastDay);
      c.gaps = uniq.slice(1).map((d, i) => diffDays(d, uniq[i]));
      c.medianGap = c.gaps.length ? median(c.gaps) : null;
      c.secondGap = uniq.length >= 2 ? diffDays(uniq[1], uniq[0]) : null;
      c.segment = classify(c.orders, c.recency);
      buyers.push(c);
    }

    const inPeriod = (o) => o.day >= curStart;
    const periodPaid = paid.filter(inPeriod);
    const periodBuyerIds = new Set(periodPaid.map((o) => o.userId));
    const byId = new Map(buyers.map((b) => [b.id, b]));

    // ── overview ───────────────────────────────────────────
    const activeBuyers = periodBuyerIds.size;
    const newBuyerIds = new Set([...periodBuyerIds].filter((id) => byId.get(id).firstDay >= curStart));
    const returningBuyerIds = new Set([...periodBuyerIds].filter((id) => !newBuyerIds.has(id)));
    const periodRevenue = sum(periodPaid.map((o) => o.amount));
    const newRevenue = sum(periodPaid.filter((o) => newBuyerIds.has(o.userId)).map((o) => o.amount));
    const repeatBuyers = buyers.filter((b) => b.orders >= 2).length;
    const signups = profiles.filter((p) => p.role === "customer" && dayKey(p.created_at) >= curStart);
    const signupsWhoBought = signups.filter((p) => byId.has(p.id)).length;
    const totalSpent = sum(buyers.map((b) => b.spent));

    const overview = {
      buyersAllTime: buyers.length,
      activeBuyers,
      newBuyers: newBuyerIds.size,
      returningBuyers: returningBuyerIds.size,
      newSignups: signups.length,
      signupsWhoBought,
      signupConversion: signups.length ? share(signupsWhoBought, signups.length) : null,
      repeatBuyers,
      repeatRate: buyers.length ? share(repeatBuyers, buyers.length) : null,
      avgOrdersPerBuyer: buyers.length ? round1(sum(buyers.map((b) => b.orders)) / buyers.length) : 0,
      avgSpendPerBuyer: buyers.length ? round2(totalSpent / buyers.length) : 0,
      periodRevenue: round2(periodRevenue),
      newBuyerRevenue: round2(newRevenue),
      returningRevenue: round2(periodRevenue - newRevenue),
      returningRevenueShare: share(periodRevenue - newRevenue, periodRevenue),
    };

    // ── segments ───────────────────────────────────────────
    const segments = SEGMENTS.map((s) => {
      const members = buyers.filter((b) => b.segment === s.key);
      const orderCount = sum(members.map((m) => m.orders));
      const spent = sum(members.map((m) => m.spent));
      return {
        ...s,
        count: members.length,
        revenue: round2(spent),
        revenueShare: share(spent, totalSpent),
        avgOrder: orderCount ? round2(spent / orderCount) : 0,
      };
    });

    // ── win-back: overdue against each customer's own rhythm ──
    const winBack = buyers
      .filter((b) => b.orders >= 2 && b.medianGap !== null)
      .map((b) => ({ b, usual: Math.max(b.medianGap, 7) }))
      .filter(({ b, usual }) => b.recency >= Math.max(14, usual * 2) && b.recency <= LOOKBACK_DAYS)
      .sort((x, y) => y.b.spent - x.b.spent)
      .map(({ b, usual }) => ({
        name: b.name,
        orders: b.orders,
        spent: round2(b.spent),
        daysSince: b.recency,
        usualGapDays: Math.round(usual),
        lastOrder: b.lastDay,
        segment: b.segment,
      }));

    // ── revenue concentration ──────────────────────────────
    let concentration = { available: false };
    if (buyers.length >= 10) {
      const sorted = [...buyers].sort((a, b) => b.spent - a.spent);
      const topN = Math.max(1, Math.ceil(buyers.length * 0.1));
      concentration = { available: true, buyers: buyers.length, topCount: topN, topShare: share(sum(sorted.slice(0, topN).map((b) => b.spent)), totalSpent) };
    }

    // ── peak hours (last 6 months) ─────────────────────────
    const recentPaid = paid.filter((o) => o.day >= basketStart);
    const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0 }));
    recentPaid.forEach((o) => byHour[o.hour].orders++);
    let timing = { available: false, byHour, totalOrders: recentPaid.length };
    if (recentPaid.length >= 20) {
      let best = { start: 0, total: -1 };
      for (let h = 0; h < 24; h++) {
        const total = byHour[h].orders + byHour[(h + 1) % 24].orders + byHour[(h + 2) % 24].orders;
        if (total > best.total) best = { start: h, total };
      }
      timing = {
        available: true,
        byHour,
        totalOrders: recentPaid.length,
        peak: { startHour: best.start, endHour: (best.start + 3) % 24, label: `${hourLabel(best.start)} to ${hourLabel((best.start + 3) % 24)}`, share: share(best.total, recentPaid.length) },
      };
    }

    // ── basket analysis: items per order + bought-together pairs ──
    const titles = new Map();
    const productOrders = new Map(); // product -> order count
    const pairCounts = new Map();
    let units = 0;
    let multi = 0;
    for (const o of recentPaid) {
      const ids = [...new Set((o.order_items || []).map((i) => i.product_id))].sort();
      (o.order_items || []).forEach((i) => {
        units += Number(i.quantity) || 0;
        if (i.products?.title) titles.set(i.product_id, i.products.title);
      });
      ids.forEach((id) => productOrders.set(id, (productOrders.get(id) || 0) + 1));
      if (ids.length >= 2) {
        multi++;
        for (let a = 0; a < ids.length; a++)
          for (let b = a + 1; b < ids.length; b++) {
            const k = `${ids[a]}|${ids[b]}`;
            pairCounts.set(k, (pairCounts.get(k) || 0) + 1);
          }
      }
    }
    const N = recentPaid.length;
    const pairs = [...pairCounts.entries()]
      .map(([k, count]) => {
        const [a, b] = k.split("|");
        const na = productOrders.get(a);
        const nb = productOrders.get(b);
        return {
          a: titles.get(a) || "Product",
          b: titles.get(b) || "Product",
          orders: count,
          confidence: round1((count / Math.min(na, nb)) * 100), // of the less-common item's orders, how many also had the other
          lift: round2((count * N) / (na * nb)),
        };
      })
      .filter((p) => p.orders >= 3 && p.lift >= 1.2)
      .sort((x, y) => y.orders - x.orders || y.lift - x.lift)
      .slice(0, 5);
    const basket = {
      available: N >= 15,
      orders: N,
      avgItemsPerOrder: N ? round1(units / N) : 0,
      multiItemShare: N ? share(multi, N) : 0,
      pairs: N >= 15 ? pairs : [],
    };

    // ── payments, unpaid orders, cancellations ─────────────
    const methodCounts = {};
    periodPaid.forEach((o) => {
      const m = o.payment_method || "OTHER";
      methodCounts[m] = (methodCounts[m] || 0) + 1;
    });
    const methods = Object.entries(methodCounts)
      .map(([method, n]) => ({ method, orders: n, share: share(n, periodPaid.length) }))
      .sort((a, b) => b.orders - a.orders);

    const unpaidRows = orders.filter(
      (o) => o.payment_status === "PENDING" && o.status !== "cancelled" && now - Date.parse(o.created_at) >= DAY && now - Date.parse(o.created_at) <= 30 * DAY,
    );
    const unpaid = {
      count: unpaidRows.length,
      value: round2(sum(unpaidRows.map((o) => Number(o.total_amount) || 0))),
      oldestDays: unpaidRows.length ? Math.round(Math.max(...unpaidRows.map((o) => now - Date.parse(o.created_at))) / DAY) : 0,
    };

    const placed = orders.filter((o) => dayKey(o.created_at) >= curStart);
    const cancelledCount = placed.filter((o) => o.status === "cancelled").length;
    const cancellations = {
      placed: placed.length,
      cancelled: cancelledCount,
      rate: placed.length ? share(cancelledCount, placed.length) : 0,
      repeatCancellers: [...byUser.values()].filter((c) => c.cancelled >= 2).length,
    };

    // ── abandoned carts (items waiting 3+ days, no order since) ──
    let cartInfo = { available: false };
    if (carts) {
      const groups = new Map();
      for (const row of carts) {
        const g = groups.get(row.user_id) || { latest: 0, value: 0, items: [] };
        g.latest = Math.max(g.latest, Date.parse(row.created_at) || 0);
        const price = Number(row.products?.price) || 0;
        const disc = Number(row.products?.discount) || 0;
        g.value += (Number(row.quantity) || 0) * price * (1 - disc / 100);
        if (row.products?.title) g.items.push(row.products.title);
        groups.set(row.user_id, g);
      }
      const waiting = [...groups.entries()].filter(([uid, g]) => g.latest && now - g.latest >= 3 * DAY && g.latest > (byUser.get(uid)?.lastAnyAt || 0));
      const itemCounts = new Map();
      waiting.forEach(([, g]) => g.items.forEach((t) => itemCounts.set(t, (itemCounts.get(t) || 0) + 1)));
      cartInfo = {
        available: true,
        customers: waiting.length,
        value: round2(sum(waiting.map(([, g]) => g.value))),
        topItems: [...itemCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([title, n]) => ({ title, carts: n })),
      };
    }

    // ── repeat rhythm ──────────────────────────────────────
    const seconds = buyers.map((b) => b.secondGap).filter((g) => g !== null);
    const repeatRhythm = { repeaters: seconds.length, medianDaysToSecondOrder: seconds.length >= 5 ? Math.round(median(seconds)) : null };

    // ── unusual days (robust z-score vs the previous 28 days) ──
    const revenueByDay = {};
    paid.forEach((o) => (revenueByDay[o.day] = (revenueByDay[o.day] || 0) + o.amount));
    const baseline = Array.from({ length: 28 }, (_, i) => revenueByDay[addDays(today, -(31 - i))] || 0);
    const anomalies = [];
    if (baseline.filter((x) => x > 0).length >= 10) {
      const med = median(baseline);
      const mad = median(baseline.map((x) => Math.abs(x - med)));
      if (mad > 0) {
        for (let back = 1; back <= 3; back++) {
          const date = addDays(today, -back);
          const x = revenueByDay[date] || 0;
          const z = (x - med) / (1.4826 * mad);
          if (Math.abs(z) >= 3.5 && Math.abs(x - med) >= Math.max(1, med * 0.3))
            anomalies.push({ date, revenue: round2(x), expected: round2(med), direction: x > med ? "high" : "low" });
        }
      }
    }

    // ── insight rules ──────────────────────────────────────
    const insights = [];
    const add = (type, title, detail) => insights.push({ type, title, detail });
    const seg = (k) => segments.find((s) => s.key === k);

    if (buyers.length > 0 && buyers.length < 5)
      add("info", "Small sample size", `Only ${plural(buyers.length, "customer")} ${buyers.length === 1 ? "has" : "have"} bought so far, so segments and percentages are rough.`);

    if (activeBuyers === 0) {
      add("warning", `No customers bought in the last ${days} days`, "There were no paid orders in this period. Check that payments are being verified and consider a promotion to get orders moving.");
    } else {
      // signup conversion
      if (signups.length >= 3) {
        const pctBought = overview.signupConversion;
        if (pctBought < 25)
          add("warning", `Only ${signupsWhoBought} of ${signups.length} new sign-ups have bought`, `That is ${Math.round(pctBought)}%. Many people register but never order. A first-order discount or a welcome message could help.`);
        else if (pctBought >= 50)
          add("good", `${signupsWhoBought} of ${signups.length} new sign-ups have already ordered`, `${Math.round(pctBought)}% of people who registered in the last ${days} days bought something.`);
        else add("info", `${signupsWhoBought} of ${signups.length} new sign-ups have ordered`, `${Math.round(pctBought)}% of people who registered in the last ${days} days have bought something.`);
      }
      // new vs returning
      if (activeBuyers >= 5 && periodRevenue > 0) {
        if (overview.returningRevenueShare >= 50)
          add("good", `Returning customers bring ${Math.round(overview.returningRevenueShare)}% of revenue`, `${plural(returningBuyerIds.size, "returning buyer")} and ${plural(newBuyerIds.size, "new buyer")} in the last ${days} days.`);
        else if (100 - overview.returningRevenueShare >= 70)
          add("info", `${Math.round(100 - overview.returningRevenueShare)}% of revenue comes from first-time buyers`, "Good for growth, but repeat buyers cost less to keep. A thank-you message or small voucher after delivery can bring them back.");
      }
    }

    // repeat rate
    if (buyers.length >= 10) {
      if (overview.repeatRate >= 40) add("good", `${Math.round(overview.repeatRate)}% of customers have ordered more than once`, `${repeatBuyers} of ${buyers.length} customers bought again, a sign that people like what they get.`);
      else if (overview.repeatRate < 20) add("info", `Only ${Math.round(overview.repeatRate)}% of customers have ordered more than once`, `${repeatBuyers} of ${buyers.length} customers came back. Follow-ups after delivery and new-arrival announcements can lift this.`);
    }

    // segments
    const champs = seg("champion");
    if (champs.count > 0) add("good", `${plural(champs.count, "Champion")} bring ${Math.round(champs.revenueShare)}% of revenue`, `Customers with 3+ orders and a recent purchase. Keep them happy: early access to new items or a thank-you perk works well.`);
    const risk = seg("atRisk");
    if (risk.count > 0)
      add("warning", `${plural(risk.count, "regular customer")} ${risk.count === 1 ? "has" : "have"} gone quiet`, `They ordered 2+ times before but nothing for 61 to 120 days, and have spent ${peso(risk.revenue)} in total. A message or voucher now is cheaper than finding new customers.`);
    const drifting = seg("drifting");
    if (drifting.count >= 3)
      add("info", `${plural(drifting.count, "one-time buyer")} ${drifting.count === 1 ? "is" : "are"} drifting away`, "They ordered once 1 to 3 months ago and have not returned. A reminder with a new-arrivals highlight can earn a second order.");

    // win-back
    if (winBack.length > 0) {
      const top = winBack.slice(0, 3).map((w) => `${w.name} (usually every ~${w.usualGapDays} days, now ${w.daysSince})`);
      add("warning", `${plural(winBack.length, "customer")} ${winBack.length === 1 ? "is" : "are"} overdue for a reorder`, `Compared with their own buying rhythm: ${listNames(top)}. Together they have spent ${peso(sum(winBack.map((w) => w.spent)))}.`);
    }

    // concentration
    if (concentration.available && concentration.topShare >= 50)
      add("info", `Your top ${concentration.topCount} customers bring ${Math.round(concentration.topShare)}% of revenue`, "Revenue depends on a small group. Losing one of them would be felt, so look after them and widen your base.");

    // timing
    if (timing.available) add("info", `Orders peak between ${timing.peak.label}`, `${Math.round(timing.peak.share)}% of orders in the last 6 months were placed in that 3-hour window. Post new items or run promos just before it.`);

    // basket
    if (basket.available) {
      if (basket.pairs.length) {
        const p = basket.pairs[0];
        add("info", `${p.a} and ${p.b} are often bought together`, `${plural(p.orders, "order")} include both, and ${Math.round(p.confidence)}% of orders with the less common item also had the other. A bundle or a 'complete the look' suggestion could raise the order value.`);
      }
      if (basket.avgItemsPerOrder < 1.5)
        add("info", "Most orders are a single item", `Customers buy ${basket.avgItemsPerOrder} item${basket.avgItemsPerOrder === 1 ? "" : "s"} per order on average. Bundles or a free-delivery minimum can encourage bigger baskets.`);
    }

    // repeat rhythm
    if (repeatRhythm.medianDaysToSecondOrder !== null)
      add("info", `Repeat customers come back after about ${repeatRhythm.medianDaysToSecondOrder} days`, `Based on ${repeatRhythm.repeaters} customers with a second order. A reminder around day ${Math.max(1, Math.round(repeatRhythm.medianDaysToSecondOrder * 0.8))} fits their rhythm.`);

    // payments
    if (methods.length && periodPaid.length >= 10 && methods[0].method !== "OTHER")
      add("info", `${methods[0].method} is the favourite payment method`, `${Math.round(methods[0].share)}% of paid orders in the last ${days} days.`);
    if (unpaid.count > 0)
      add("warning", `${plural(unpaid.count, "order")} (${peso(unpaid.value)}) placed but never paid`, `Placed over a day ago with no payment sent, the oldest ${plural(unpaid.oldestDays, "day")} ago. A payment reminder could recover some of them.`);

    // carts
    if (cartInfo.available && cartInfo.customers > 0)
      add("info", `${plural(cartInfo.customers, "customer")} left items in their cart for 3+ days`, `About ${peso(cartInfo.value)} is sitting there${cartInfo.topItems.length ? `. Most often left behind: ${listNames(cartInfo.topItems.map((i) => i.title))}` : ""}. A reminder or small discount could finish those sales.`);

    // cancellations
    if (cancellations.placed >= 5 && cancellations.rate >= 15)
      add("warning", `${Math.round(cancellations.rate)}% of orders were cancelled`, `${cancellations.cancelled} of ${cancellations.placed} orders placed in the last ${days} days. Check whether cancellations come from stock, price or delivery concerns.`);
    if (cancellations.repeatCancellers > 0)
      add("info", `${plural(cancellations.repeatCancellers, "customer")} cancelled 2 or more orders`, "Worth a look: repeated cancellations can point to payment trouble or unclear delivery details.");

    // unusual days
    anomalies.slice(0, 2).forEach((a) =>
      add("info", `${a.date} was unusually ${a.direction === "high" ? "strong" : "quiet"}`, `Revenue was ${peso(a.revenue)} against a typical ${peso(a.expected)}. ${a.direction === "high" ? "Check what drove it (a promo, a post, a restock) so you can repeat it." : "Check for stock-outs, payment verification delays or site problems that day."}`),
    );

    const rank = { warning: 0, good: 1, info: 2 };
    insights.sort((a, b) => rank[a.type] - rank[b.type]);

    return {
      generatedAt: new Date(now).toISOString(),
      range: { days, from: curStart, to: today, timezone: "Asia/Manila", historyMonths: 12, basketMonths: 6 },
      overview,
      segments,
      winBack: winBack.slice(0, 8),
      winBackTotal: winBack.length,
      concentration,
      timing,
      basket,
      payments: { methods, unpaid, cancellations },
      carts: cartInfo,
      repeatRhythm,
      anomalies,
      insights,
    };
  }

  // ── route ──────────────────────────────────────────────────
  const cache = new Map();
  app.get("/api/admin/customer-insights", auth, adminOnly, async (req, res) => {
    const requested = Number(req.query.days);
    const days = ALLOWED_RANGES.includes(requested) ? requested : 30;
    const hit = cache.get(days);
    if (hit && Date.now() - hit.at < CACHE_MS && req.query.fresh !== "1") return res.json(hit.payload);
    try {
      const payload = await buildReport(days);
      cache.set(days, { at: Date.now(), payload });
      res.json(payload);
    } catch (err) {
      console.error(`[CUSTOMER INSIGHTS ERROR] ${err.message}`);
      res.status(500).json({ error: "Failed to build customer insights" });
    }
  });
};
