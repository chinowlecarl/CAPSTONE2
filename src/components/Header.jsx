import { useState } from "react";
import { useApp } from "../context/AppContext";
import { HeaderNavLink } from "./HeaderNavLink";

export function Header({ page, setPage }) {
  const { user, cart } = useApp();
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const [open, setOpen] = useState(false);

  const links = [
    { label: "NEW ARRIVALS", to: "products" },
    { label: "HOME", to: "home" },
    { label: "PRODUCT", to: "products" },
    { label: "CART", to: "cart" },
    { label: "ABOUT", to: "about" },
  ];

  return (
    <nav style={{
      background: "#fff",
      borderBottom: "2px solid #fce7f3",
      position: "sticky", top: 0, zIndex: 100,
      boxShadow: "0 2px 12px rgba(190,24,93,0.08)",
    }}>
      <div style={{
        maxWidth: 1200, margin: "0 auto", padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 60,
      }}>
        <button
          onClick={() => setPage("home")}
          style={{
            fontFamily: "'Playfair Display', serif", fontSize: 22,
            fontWeight: 900, color: "#1a1a1a", letterSpacing: 2,
            background: "none", border: "none", cursor: "pointer",
          }}
        >
          FITCHEQUE
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {links.map((l) => (
            <HeaderNavLink
              key={l.label}
              label={l.label}
              active={page === l.to}
              onClick={() => setPage(l.to)}
            />
          ))}

          {user ? (
            <>
              {user.role === "admin" && (
                <HeaderNavLink
                  label="ADMIN"
                  active={page === "admin"}
                  onClick={() => setPage("admin")}
                />
              )}
              <button
                onClick={() => setPage("profile")}
                style={{ background: "none", border: "none", cursor: "pointer", marginLeft: 8 }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "linear-gradient(135deg, #f9a8d4, #be185d)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 800, fontSize: 14,
                  border: "2px solid #fce7f3",
                }}>
                  {user.fullname?.charAt(0).toUpperCase()}
                </div>
              </button>
            </>
          ) : (
            <button
              onClick={() => setPage("login")}
              style={{
                marginLeft: 8,
                background: "linear-gradient(135deg, #f9a8d4, #be185d)",
                border: "none", borderRadius: 20, color: "#fff",
                fontWeight: 700, fontSize: 11, letterSpacing: 1,
                padding: "8px 18px", cursor: "pointer",
              }}
            >
              LOGIN
            </button>
          )}

          <button
            onClick={() => setPage("cart")}
            style={{ position: "relative", background: "none", border: "none", cursor: "pointer", marginLeft: 4 }}
          >
            <span style={{ fontSize: 20 }}>🛍</span>
            {cartCount > 0 && (
              <span style={{
                position: "absolute", top: -4, right: -6,
                background: "#be185d", color: "#fff",
                borderRadius: "50%", width: 16, height: 16,
                fontSize: 9, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}
