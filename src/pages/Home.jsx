import { useState, useEffect } from "react";
import { publicApiFetch } from "../utils/api";
import { Hero } from "../components/Hero";
import { Card } from "../components/Card";

export default function Home({ setPage }) {
  const [featured, setFeatured] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    const loadHomeProducts = async () => {
      try {
        const home = await publicApiFetch("/products/home");
        if (!Array.isArray(home.items) || !Array.isArray(home.featuredIds) || !Array.isArray(home.arrivalIds)) {
          throw new Error("The home products response was invalid.");
        }
        const productsById = new Map(home.items.map((product) => [product.id, product]));
        const available = (product) => Number(product.stock) > 0;
        if (active) {
          setFeatured(home.featuredIds.map((id) => productsById.get(id)).filter(Boolean));
          setProducts(home.arrivalIds.map((id) => productsById.get(id)).filter((product) => product && available(product)));
        }
      } catch {
        try {
          const [featuredProducts, arrivals] = await Promise.all([
            publicApiFetch("/products/featured"),
            publicApiFetch("/products?limit=8&offset=0"),
          ]);
          if (!Array.isArray(featuredProducts) || !Array.isArray(arrivals)) {
            throw new Error("The product list response was invalid.");
          }
          const available = (product) => Number(product.stock) > 0;
          if (active) {
            setFeatured(featuredProducts.slice(0, 3));
            setProducts(arrivals.filter(available).slice(0, 8));
          }
        } catch (fallbackError) {
          console.error("Could not load homepage products:", fallbackError);
          if (active) setLoadError("We couldn't load products right now. Please try again later.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadHomeProducts();
    return () => { active = false; };
  }, []);

  return (
    <div style={{ background: "#fff" }}>
      <Hero featured={featured} setPage={setPage} />

      {/* New Arrivals */}
      <section className="home-arrivals" style={{ background: "#fff5f7", padding: "40px 0" }}>
        <div className="home-arrivals-content" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <h2 className="home-arrivals-title" style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#1a1a1a", margin: 0, letterSpacing: 1 }}>NEW ARRIVALS</h2>
            <button onClick={() => setPage("products")} style={{ background: "none", border: "1px solid #be185d", color: "#be185d", borderRadius: 20, padding: "6px 18px", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}>VIEW ALL</button>
          </div>
          {loadError ? (
            <p role="alert" style={{ color: "#be185d", textAlign: "center", padding: 24 }}>{loadError}</p>
          ) : products.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
              {products.map((p) => <Card key={p.id} product={p} compact={true} />)}
            </div>
          ) : loading ? (
            <div aria-label="Loading new arrivals" aria-busy="true" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} style={{ height: 190, borderRadius: 8, border: "1px solid #fce7f3", background: "linear-gradient(100deg, #fff 20%, #fff5f7 40%, #fff 60%)", backgroundSize: "200% 100%", animation: "home-skeleton 1.4s ease-in-out infinite" }} />
              ))}
            </div>
          ) : (
            <p style={{ color: "#888", textAlign: "center", padding: 24 }}>No products are available right now.</p>
          )}
        </div>
      </section>

      {/* Features Strip */}
      <section className="home-features" style={{ background: "#be185d", padding: "20px 0" }}>
        <div className="home-features-grid" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, textAlign: "center" }}>
          {[
            ["FREE SHIPPING", "Orders over ₱500"],
            ["30-DAY RETURNS", "Easy return policy"],
            ["SECURE PAYMENT", "100% protected"],
            ["24/7 SUPPORT", "Always here for you"],
          ].map(([title, sub]) => (
            <div key={title}>
              <div style={{ color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>{title}</div>
              <div style={{ color: "#fce7f3", fontSize: 10, marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>
      </section>
      <style>{`@keyframes home-skeleton { to { background-position-x: -200%; } }`}</style>
    </div>
  );
}