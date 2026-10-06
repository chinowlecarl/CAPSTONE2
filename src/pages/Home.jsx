import { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { Hero } from "../components/Hero";
import { Card } from "../components/Card";

export default function Home({ setPage }) {
  const [featured, setFeatured] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiFetch("/products/featured"), apiFetch("/products")])
      .then(([f, p]) => { setFeatured(f); setProducts(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <div style={{ width: 40, height: 40, border: "4px solid #fce7f3", borderTopColor: "#be185d", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
      <p style={{ color: "#be185d", fontWeight: 600 }}>Loading FITCHEQUE...</p>
    </div>
  );

  return (
    <div style={{ background: "#fff" }}>
      <Hero featured={featured} setPage={setPage} />

      {/* New Arrivals */}
      <section style={{ background: "#fff5f7", padding: "40px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#1a1a1a", margin: 0, letterSpacing: 1 }}>NEW ARRIVALS</h2>
            <button onClick={() => setPage("products")} style={{ background: "none", border: "1px solid #be185d", color: "#be185d", borderRadius: 20, padding: "6px 18px", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}>VIEW ALL</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
            {products.slice(0, 8).map((p) => <Card key={p.id} product={p} compact={true} />)}
          </div>
        </div>
      </section>

      {/* Features Strip */}
      <section style={{ background: "#be185d", padding: "20px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, textAlign: "center" }}>
          {[
            ["🚚", "FREE SHIPPING", "Orders over ₱500"],
            ["↩", "30-DAY RETURNS", "Easy return policy"],
            ["🔒", "SECURE PAYMENT", "100% protected"],
            ["💬", "24/7 SUPPORT", "Always here for you"],
          ].map(([icon, title, sub]) => (
            <div key={title}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
              <div style={{ color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>{title}</div>
              <div style={{ color: "#fce7f3", fontSize: 10, marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
