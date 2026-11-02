import { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { Card } from "../components/Card";

const CATEGORIES = ["All", "Tops", "Bottoms", "Dresses", "Jackets", "Accessories"];
const PAGE_SIZE = 24;

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    setError("");
    const params = new URLSearchParams();
    if (category !== "All") params.set("category", category);
    if (query) params.set("search", query);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));

    let active = true;
    const controller = new AbortController();
    apiFetch(`/products?${params}`, { signal: controller.signal })
      .then((data) => {
        if (!active) return;
        setProducts((current) => offset === 0 ? data : [...current, ...data]);
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch((requestError) => {
        if (active && requestError.name !== "AbortError") {
          setError(requestError.message || "Could not load products. Please try again.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setLoadingMore(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [category, query, offset]);

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <div style={{ background: "linear-gradient(135deg, #fce7f3, #fbcfe8)", padding: "32px 24px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: "#1a1a1a", margin: "0 0 8px", letterSpacing: 2 }}>PRODUCTS</h1>
        <p style={{ color: "#be185d", fontSize: 13, margin: 0, fontWeight: 500 }}>Browse our curated thrift collection</p>
      </div>

      <style>{`
        .products-toolbar { display: flex; gap: 12px; margin-bottom: 28px; flex-wrap: wrap; align-items: center; }
        .products-search { position: relative; flex: 1 1 260px; min-width: 0; }
        .products-categories { display: flex; gap: 6px; flex-wrap: wrap; min-width: 0; }
        .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; }
        @media (max-width: 640px) {
          .products-toolbar { align-items: stretch; }
          .products-search, .products-categories { flex: 1 1 100%; width: 100%; }
          .products-count { margin-left: 0 !important; }
          .products-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        }
        @media (max-width: 360px) {
          .products-grid { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        <div className="products-toolbar">
          <div className="products-search">
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#db2777" }}>🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              aria-label="Search products"
              aria-busy={loading}
              style={{ width: "100%", paddingLeft: 36, paddingRight: 16, paddingTop: 10, paddingBottom: 10, border: "1.5px solid #fce7f3", borderRadius: 10, fontSize: 13, outline: "none", background: "#fff5f7", boxSizing: "border-box" }}
            />
          </div>
          <div className="products-categories">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => { setCategory(c); setOffset(0); }} style={{ padding: "8px 16px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, cursor: "pointer", background: category === c ? "linear-gradient(135deg, #f9a8d4, #be185d)" : "#fff", color: category === c ? "#fff" : "#be185d", border: `1.5px solid ${category === c ? "transparent" : "#fce7f3"}` }}>
                {c}
              </button>
            ))}
          </div>
          <span className="products-count" style={{ color: "#aaa", fontSize: 12, marginLeft: "auto" }}>
            {loading ? "Updating results..." : `Showing ${products.length}${hasMore ? "+" : ""} items`}
          </span>
        </div>

        {error && (
          <div role="alert" style={{ color: "#be185d", background: "#fff5f7", border: "1px solid #fce7f3", borderRadius: 10, padding: 14, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {loading && products.length === 0 && !error ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ width: 36, height: 36, border: "4px solid #fce7f3", borderTopColor: "#be185d", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto" }} />
          </div>
        ) : products.length > 0 ? (
          <div className="products-grid" aria-live="polite">
            {products.map((p) => <Card key={p.id} product={p} />)}
          </div>
        ) : !loading && !error ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🛍</div>
            <h3 style={{ color: "#be185d", fontFamily: "'Playfair Display', serif" }}>No products found</h3>
          </div>
        ) : null}
        {hasMore && (
          <div style={{ textAlign: "center", padding: "28px 0" }}>
            <button
              onClick={() => setOffset(products.length)}
              disabled={loading || loadingMore || search.trim() !== query}
              style={{ background: "linear-gradient(135deg, #f9a8d4, #be185d)", border: "none", borderRadius: 20, color: "#fff", fontWeight: 800, padding: "12px 28px", cursor: "pointer", opacity: loadingMore ? 0.7 : 1 }}
            >
              {loadingMore ? "LOADING..." : "LOAD MORE"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
