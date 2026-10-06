import { fmt, salePrice } from "../utils/api";

export function Hero({ featured, setPage }) {
  return (
    <section style={{
      background: "linear-gradient(135deg, #fff0f6 0%, #fce7f3 50%, #fbcfe8 100%)",
      padding: "40px 24px 32px",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {featured.length > 0 ? (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            gap: 4, borderRadius: 12, overflow: "hidden", height: 280,
          }}>
            {featured.slice(0, 4).map((p) => (
              <div key={p.id} style={{ position: "relative", overflow: "hidden" }}>
                <img
                  src={p.image_url}
                  alt={p.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) =>
                    (e.target.src = "https://via.placeholder.com/300x280/fce7f3/be185d?text=FITCHEQUE")
                  }
                />
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  background: "linear-gradient(0deg, rgba(190,24,93,0.7) 0%, transparent 100%)",
                  padding: "20px 12px 12px",
                }}>
                  <p style={{ color: "#fff", fontSize: 11, fontWeight: 700, margin: 0 }}>{p.title}</p>
                  <p style={{ color: "#fce7f3", fontSize: 12, fontWeight: 800, margin: "2px 0 0" }}>
                    {fmt(salePrice(p.price, p.discount))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            height: 280,
            background: "linear-gradient(135deg, #fce7f3, #f9a8d4)",
            borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              fontFamily: "'Playfair Display', serif", fontSize: 48,
              fontWeight: 900, color: "#be185d", letterSpacing: 4,
            }}>
              FITCHEQUE
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
