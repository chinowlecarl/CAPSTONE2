export function Footer({ setPage }) {
  return (
    <footer style={{ background: "#1a1a1a", color: "#fff", padding: "48px 0 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr",
          gap: 32, marginBottom: 40,
        }}>
          <div>
            <div style={{
              fontFamily: "'Playfair Display', serif", fontSize: 24,
              fontWeight: 900, color: "#f9a8d4", letterSpacing: 2, marginBottom: 12,
            }}>
              FITCHEQUE
            </div>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.7 }}>
              Your premier destination for curated pre-loved fashion. Sustainable style, accessible to all.
            </p>
          </div>
          <div>
            <h4 style={{ color: "#f9a8d4", fontSize: 10, fontWeight: 800, letterSpacing: 2, marginBottom: 16 }}>
              QUICK LINKS
            </h4>
            {[["Home", "home"], ["Products", "products"], ["About", "about"]].map(([l, p]) => (
              <button
                key={l}
                onClick={() => setPage(p)}
                style={{
                  display: "block", background: "none", border: "none",
                  cursor: "pointer", color: "rgba(255,255,255,0.5)",
                  fontSize: 12, textAlign: "left", marginBottom: 8, padding: 0,
                }}
              >
                {l}
              </button>
            ))}
          </div>
          <div>
            <h4 style={{ color: "#f9a8d4", fontSize: 10, fontWeight: 800, letterSpacing: 2, marginBottom: 16 }}>
              HELP
            </h4>
            {["Shipping Policy", "Return Policy", "Privacy Policy"].map((l) => (
              <p key={l} style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 8 }}>{l}</p>
            ))}
          </div>
          <div>
            <h4 style={{ color: "#f9a8d4", fontSize: 10, fontWeight: 800, letterSpacing: 2, marginBottom: 16 }}>
              CONTACT
            </h4>
            {["📍 Quezon City, PH", "📞 (555) 123-4567", "✉️ info@fitcheque.com"].map((t) => (
              <p key={t} style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 8 }}>{t}</p>
            ))}
          </div>
        </div>
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 20,
          textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12,
        }}>
          © {new Date().getFullYear()} FITCHEQUE. All rights reserved. Made with 🩷 for fashion lovers.
        </div>
      </div>
    </footer>
  );
}
