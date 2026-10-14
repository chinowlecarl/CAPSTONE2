import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { HeaderNavLink } from "./HeaderNavLink";

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < breakpoint
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

export function Header({ page, setPage }) {
  const { user, cart } = useApp();
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const links = [
    { label: "NEW ARRIVALS", to: "home" },
    { label: "HOME", to: "products" },
    { label: "CART", to: "cart" },
    { label: "ABOUT", to: "about" },
  ];

  const go = (to) => {
    setPage(to);
    setOpen(false);
  };

  const loginOrAvatar = user ? (
    <button
      onClick={() => go("profile")}
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
  ) : (
    <button
      onClick={() => go("login")}
      style={{
        marginLeft: 8,
        background: "linear-gradient(135deg, #f9a8d4, #be185d)",
        border: "none", borderRadius: 20, color: "#fff",
        fontWeight: 700, fontSize: 11, letterSpacing: 1,
        padding: "8px 14px", cursor: "pointer", whiteSpace: "nowrap",
      }}
    >
      LOGIN
    </button>
  );

  const cartButton = (
    <button
      onClick={() => go("cart")}
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
  );

  return (
    <nav style={{
      background: "#fff",
      borderBottom: "2px solid #fce7f3",
      position: "sticky", top: 0, zIndex: 100,
      boxShadow: "0 2px 12px rgba(190,24,93,0.08)",
      width: "100%",
    }}>
      <div style={{
        maxWidth: 1200, margin: "0 auto",
        padding: isMobile ? "0 12px" : "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 60,
      }}>
        <button
          onClick={() => go("home")}
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: isMobile ? 18 : 22,
            fontWeight: 900, color: "#1a1a1a", letterSpacing: isMobile ? 1 : 2,
            background: "none", border: "none", cursor: "pointer",
          }}
        >
          FITCHEQUE
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {!isMobile && links.map((l) => (
            <HeaderNavLink
              key={l.label}
              label={l.label}
              active={page === l.to}
              onClick={() => go(l.to)}
            />
          ))}

          {user?.role === "admin" && !isMobile && (
            <HeaderNavLink
              label="ADMIN"
              active={page === "admin"}
              onClick={() => go("admin")}
            />
          )}

          {loginOrAvatar}
          {cartButton}

          {isMobile && (
            <button
              onClick={() => setOpen((o) => !o)}
              aria-label="Menu"
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 24, color: "#be185d", marginLeft: 4, lineHeight: 1,
              }}
            >
              {open ? "✕" : "☰"}
            </button>
          )}
        </div>
      </div>

      {isMobile && open && (
        <div style={{
          display: "flex", flexDirection: "column",
          padding: "8px 12px 12px",
          borderTop: "1px solid #fce7f3",
          background: "#fff",
        }}>
          {links.map((l) => (
            <HeaderNavLink
              key={l.label}
              label={l.label}
              active={page === l.to}
              onClick={() => go(l.to)}
            />
          ))}
          {user?.role === "admin" && (
            <HeaderNavLink
              label="ADMIN"
              active={page === "admin"}
              onClick={() => go("admin")}
            />
          )}
        </div>
      )}
    </nav>
  );
}