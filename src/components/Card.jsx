import { useApp } from "../context/AppContext";
import { fmt, salePrice } from "../utils/api";

export function Card({ product, compact = false }) {
  const { addToCart } = useApp();
  const sp = salePrice(product.price, product.discount);

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: compact ? 8 : 14,
        overflow: "hidden",
        boxShadow: "0 2px 16px rgba(190,24,93,0.08)",
        border: "1px solid #fce7f3",
        transition: "transform .25s, box-shadow .25s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 8px 32px rgba(190,24,93,0.18)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 2px 16px rgba(190,24,93,0.08)";
      }}
    >
      <div style={{ position: "relative", height: compact ? 140 : 220, overflow: "hidden" }}>
        <img
          src={product.image_url}
          alt={product.title}
          style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform .4s" }}
          onMouseEnter={(e) => (e.target.style.transform = "scale(1.08)")}
          onMouseLeave={(e) => (e.target.style.transform = "scale(1)")}
          onError={(e) => {
            e.target.src = "https://placehold.co/400x300/fce7f3/be185d?text=FITCHEQUE";
          }}
        />
        {product.discount > 0 && (
          <span style={{
            position: "absolute", top: 8, right: 8,
            background: "#be185d", color: "#fff",
            fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 20,
          }}>
            -{product.discount}%
          </span>
        )}
        {product.featured && (
          <span style={{
            position: "absolute", top: 8, left: 8,
            background: "rgba(255,255,255,0.92)", color: "#be185d",
            fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 20,
            border: "1px solid #fce7f3",
          }}>
            FEATURED
          </span>
        )}
      </div>

      <div style={{ padding: compact ? "10px 12px" : "16px" }}>
        <p style={{
          color: "#db2777", fontSize: 10, fontWeight: 700,
          letterSpacing: 1.2, margin: "0 0 4px", textTransform: "uppercase",
        }}>
          {product.category}
        </p>
        <h3 style={{
          margin: "0 0 6px", fontSize: compact ? 12 : 14, fontWeight: 700,
          color: "#1a1a1a", lineHeight: 1.3, fontFamily: "'Playfair Display', serif",
        }}>
          {product.title}
        </h3>
        {!compact && (
          <p style={{ color: "#888", fontSize: 12, margin: "0 0 10px", lineHeight: 1.5 }}>
            {product.description?.slice(0, 70)}...
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: compact ? 8 : 12 }}>
          {product.discount > 0 && (
            <span style={{ color: "#bbb", textDecoration: "line-through", fontSize: 12 }}>
              {fmt(product.price)}
            </span>
          )}
          <span style={{ color: "#be185d", fontWeight: 800, fontSize: compact ? 14 : 16 }}>
            {fmt(sp)}
          </span>
        </div>
        <button
          onClick={() => addToCart(product)}
          style={{
            width: "100%",
            background: "linear-gradient(135deg, #f9a8d4 0%, #be185d 100%)",
            border: "none", borderRadius: 8, color: "#fff",
            fontWeight: 700, fontSize: compact ? 10 : 12, letterSpacing: 0.8,
            padding: compact ? "7px 0" : "10px 0", cursor: "pointer",
          }}
        >
          ADD TO CART
        </button>
      </div>
    </div>
  );
}
