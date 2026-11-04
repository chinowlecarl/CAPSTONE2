import { useState } from "react";
import { useApp } from "../context/AppContext";
import { HeaderNavLink } from "./HeaderNavLink";

export function Header({ page, setPage }) {
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  const goToPage = (nextPage) => {
    setPage(nextPage);
    setOpen(false);
  };

  const links = [
    { label: "NEW ARRIVALS", to: "home" },
    { label: "HOME", to: "products" },
    { label: "CART", to: "cart" },
    { label: "ABOUT", to: "about" },
  ];
  
  return (
    <nav style={{
      background: "#fff",
      borderBottom: "2px solid #fce7f3",
      position: "sticky", top: 0, zIndex: 100,
      boxShadow: "0 2px 12px rgba(190,24,93,0.08)",
    }} className="store-header">
      <div className="store-header-inner" style={{
        maxWidth: 1200, margin: "0 auto", padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 60,
      }}>
        <button
          className="store-header-brand"
          onClick={() => goToPage("home")}
          style={{
            fontFamily: "'Playfair Display', serif", fontSize: 22,
            fontWeight: 900, color: "#1a1a1a", letterSpacing: 2,
            background: "none", border: "none", cursor: "pointer",
          }}
        >
          FITCHEQUE
        </button>

        <button
          className="store-header-menu-toggle"
          type="button"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          aria-controls="store-header-actions"
          onClick={() => setOpen((isOpen) => !isOpen)}
        >
          {open ? "✕" : "☰"}
        </button>

        <div id="store-header-actions" className={`store-header-actions${open ? " is-open" : ""}`}>
          {links.map((l) => (
            <HeaderNavLink
              key={l.label}
              label={l.label}
              active={page === l.to}
              onClick={() => goToPage(l.to)}
            />
          ))}

          {user ? (
            <>
              {user.role === "admin" && (
                <HeaderNavLink
                  label="ADMIN"
                  active={page === "admin"}
                  onClick={() => goToPage("admin")}
                />
              )}
              <button
                aria-label="Open profile"
                onClick={() => goToPage("profile")}
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
              onClick={() => goToPage("login")}
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

        </div>
      </div>
    </nav>
  );
}
