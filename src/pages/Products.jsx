import { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { Card } from "../components/Card";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const categories = ["All", ...new Set(products.map((p) => p.category))];

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== "All") params.set("category", category);
    if (search) params.set("search", search);
    apiFetch(`/products?${params}`)
      .then((data) => { setProducts(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [category, search]);

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <div style={{ background: "linear-gradient(135deg, #fce7f3, #fbcfe8)", padding: "32px 24px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: "#1a1a1a", margin: "0 0 8px", letterSpacing: 2 }}>PRODUCTS</h1>
        <p style={{ color: "#be185d", fontSize: 13, margin: 0, fontWeight: 500 }}>Browse our curated thrift collection</p>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#db2777" }}>🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              style={{ width: "100%", paddingLeft: 36, paddingRight: 16, paddingTop: 10, paddingBottom: 10, border: "1.5px solid #fce7f3", borderRadius: 10, fontSize: 13, outline: "none", background: "#fff5f7", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {categories.map((c) => (
              <button key={c} onClick={() => setCategory(c)} style={{ padding: "8px 16px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, cursor: "pointer", background: category === c ? "linear-gradient(135deg, #f9a8d4, #be185d)" : "#fff", color: category === c ? "#fff" : "#be185d", border: `1.5px solid ${category === c ? "transparent" : "#fce7f3"}` }}>
                {c}
              </button>
            ))}
          </div>
          <span style={{ color: "#aaa", fontSize: 12, marginLeft: "auto" }}>{products.length} items</span>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ width: 36, height: 36, border: "4px solid #fce7f3", borderTopColor: "#be185d", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto" }} />
          </div>
        ) : products.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
            {products.map((p) => <Card key={p.id} product={p} />)}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🛍</div>
            <h3 style={{ color: "#be185d", fontFamily: "'Playfair Display', serif" }}>No products found</h3>
          </div>
        )}
      </div>
    </div>
  );
}
