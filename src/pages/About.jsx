export default function About() {
  return (
    <div style={{ background: "#fff" }}>
      <div style={{ background: "linear-gradient(160deg, #fce7f3 0%, #fbcfe8 60%, #f9a8d4 100%)", padding: "60px 24px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.1, backgroundImage: "url('https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=60')", backgroundSize: "cover" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 44, fontWeight: 900, color: "#1a1a1a", margin: "0 0 12px", letterSpacing: 3 }}>ABOUT FITCHEQUE</h1>
          <p style={{ color: "#be185d", fontSize: 15, fontWeight: 500, maxWidth: 500, margin: "0 auto" }}>Your premier destination for curated thrift fashion since 2023</p>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "56px 24px" }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: "#1a1a1a", borderBottom: "3px solid #fce7f3", paddingBottom: 12, marginBottom: 20 }}>Our Story</h2>
        <p style={{ color: "#555", lineHeight: 1.9, fontSize: 15, marginBottom: 16 }}>
          FITCHEQUE was founded in 2023 with a simple mission: to make premium fashion accessible to everyone. What started as a small boutique has grown into a leading online thrift fashion destination across the Philippines.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, margin: "40px 0" }}>
          {[
            ["🎯", "Our Mission", "To provide high-quality thrift fashion at affordable prices while delivering exceptional customer service and supporting sustainable practices."],
            ["👁", "Our Vision", "To become the Philippines' most trusted thrift fashion brand, where everyone can find their perfect style."],
            ["💚", "Sustainability", "Every purchase supports sustainable fashion. We believe in giving clothes a second life and reducing fashion waste."],
            ["🤝", "Community", "FITCHEQUE is more than a store — it's a community of fashion lovers who believe style shouldn't cost the earth."],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{ background: "linear-gradient(135deg, #fff5f7, #fce7f3)", borderRadius: 16, padding: 28, border: "1px solid #fce7f3", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#1a1a1a", marginBottom: 10 }}>{title}</h3>
              <p style={{ color: "#777", fontSize: 13, lineHeight: 1.7, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>

        <div style={{ background: "#be185d", borderRadius: 20, padding: "40px 32px", color: "#fff", margin: "40px 0", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, textAlign: "center" }}>
          {[["300+", "Happy Customers"], ["500+", "Products"], ["50+", "Brands"], ["24/7", "Support"]].map(([n, l]) => (
            <div key={l}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#fce7f3", marginBottom: 4 }}>{n}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
