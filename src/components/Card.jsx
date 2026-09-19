import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { fmt, salePrice } from "../utils/api";

// Collect all available images for a product.
// Supports: product.images (array) OR falls back to product.image_url (string)
function getImages(product) {
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images.filter(Boolean);
  }
  return product.image_url
    ? [product.image_url]
    : ["https://placehold.co/400x300/fce7f3/be185d?text=FITCHEQUE"];
}

// ── Multi-angle image viewer ──────────────────────────────────────────────────
function ImageViewer({ images, height, title }) {
  const [idx, setIdx] = useState(0);
  const [dragStartX, setDragStartX] = useState(null);
  const multi = images.length > 1;

  const go = (dir, e) => {
    e && e.stopPropagation();
    setIdx((i) => (i + dir + images.length) % images.length);
  };

  const onPointerDown = (e) => setDragStartX(e.clientX);
  const onPointerUp = (e) => {
    if (dragStartX === null) return;
    const diff = dragStartX - e.clientX;
    if (Math.abs(diff) > 40) go(diff > 0 ? 1 : -1);
    setDragStartX(null);
  };

  return (
    <div
      style={{ position: "relative", height, overflow: "hidden", userSelect: "none", cursor: multi ? "grab" : "default" }}
      onPointerDown={multi ? onPointerDown : undefined}
      onPointerUp={multi ? onPointerUp : undefined}
      onPointerLeave={() => setDragStartX(null)}
    >
      {/* Slides */}
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={`${title} – view ${i + 1}`}
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%", objectFit: "cover",
            opacity: i === idx ? 1 : 0,
            transition: "opacity 0.32s ease",
            pointerEvents: "none",
          }}
          onError={(e) => { e.target.src = "https://placehold.co/400x300/fce7f3/be185d?text=FITCHEQUE"; }}
        />
      ))}

      {/* Hover zoom on single image (keeps original behaviour) */}
      {!multi && (
        <img
          src={images[0]}
          alt={title}
          style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform .4s", position: "absolute", inset: 0 }}
          onMouseEnter={(e) => (e.target.style.transform = "scale(1.08)")}
          onMouseLeave={(e) => (e.target.style.transform = "scale(1)")}
          onError={(e) => { e.target.src = "https://placehold.co/400x300/fce7f3/be185d?text=FITCHEQUE"; }}
        />
      )}

      {/* Controls — only shown when multiple images exist */}
      {multi && (
        <>
          {/* Prev / Next arrows */}
          <button onClick={(e) => go(-1, e)} style={arrowStyle("left")}>&#8249;</button>
          <button onClick={(e) => go(1, e)} style={arrowStyle("right")}>&#8250;</button>

          {/* "2 / 4" counter */}
          <span style={{
            position: "absolute", top: 8, left: 8, zIndex: 3,
            background: "rgba(0,0,0,0.42)", color: "#fff",
            fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, letterSpacing: 0.5,
          }}>
            {idx + 1} / {images.length}
          </span>

          {/* Dot indicators */}
          <div style={{
            position: "absolute", bottom: images.length > 1 ? 42 : 8,
            left: "50%", transform: "translateX(-50%)",
            display: "flex", gap: 5, zIndex: 3,
          }}>
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                style={{
                  width: i === idx ? 18 : 7, height: 7, padding: 0,
                  borderRadius: 4, border: "none", cursor: "pointer",
                  background: i === idx ? "#be185d" : "rgba(255,255,255,0.75)",
                  transition: "width .25s, background .25s",
                }}
              />
            ))}
          </div>

          {/* Thumbnail strip */}
          <div style={{
            position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)",
            display: "flex", gap: 4, zIndex: 3,
          }}>
            {images.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`angle ${i + 1}`}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                style={{
                  width: 30, height: 30, objectFit: "cover", borderRadius: 5,
                  cursor: "pointer",
                  border: i === idx ? "2px solid #be185d" : "2px solid rgba(255,255,255,0.6)",
                  opacity: i === idx ? 1 : 0.65,
                  transition: "border .2s, opacity .2s",
                }}
                onError={(e) => (e.target.style.display = "none")}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function arrowStyle(side) {
  return {
    position: "absolute", [side]: 6, top: "50%", transform: "translateY(-50%)",
    zIndex: 3, background: "rgba(255,255,255,0.88)", border: "none",
    borderRadius: "50%", width: 28, height: 28, cursor: "pointer",
    fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center",
    justifyContent: "center", boxShadow: "0 1px 6px rgba(0,0,0,0.18)",
    color: "#be185d", lineHeight: 1, padding: 0,
  };
}

// ── Product Detail Modal ──────────────────────────────────────────────────────
function ProductModal({ product, onClose, onAddToCart }) {
  const images = getImages(product);
  const [idx, setIdx] = useState(0);
  const sp = salePrice(product.price, product.discount);
  const soldOut = product.stock === 0;

  // Close on backdrop click
  const onBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onBackdrop}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 20, maxWidth: 900, width: "100%",
        maxHeight: "96vh", overflowY: "auto",
        boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: "1px solid #fce7f3",
          position: "sticky", top: 0, background: "#fff", zIndex: 2, borderRadius: "20px 20px 0 0",
        }}>
          <span style={{ color: "#db2777", fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" }}>
            {product.category}
          </span>
          <button onClick={onClose} style={{
            background: "#fff5f7", border: "1px solid #fce7f3", borderRadius: "50%",
            width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#be185d",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
          {/* Image gallery */}
          <div style={{ flex: "1 1 340px", minWidth: 280 }}>
            {/* Main image */}
            <div style={{ position: "relative", height: 520, background: "#fff5f7" }}>
              <img
                src={images[idx]}
                alt={`${product.title} – view ${idx + 1}`}
                style={{ width: "100%", height: "100%", objectFit: "cover", filter: soldOut ? "grayscale(0.6)" : "none" }}
                onError={(e) => { e.target.src = "https://placehold.co/600x400/fce7f3/be185d?text=FITCHEQUE"; }}
              />
              {product.discount > 0 && !soldOut && (
                <span style={{
                  position: "absolute", top: 12, right: 12,
                  background: "#be185d", color: "#fff",
                  fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 20,
                }}>
                  -{product.discount}%
                </span>
              )}
              {product.featured && (
                <span style={{
                  position: "absolute", top: 12, left: 12,
                  background: "rgba(255,255,255,0.92)", color: "#be185d",
                  fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 20,
                  border: "1px solid #fce7f3",
                }}>
                  FEATURED
                </span>
              )}
              {/* Prev/Next arrows */}
              {images.length > 1 && (
                <>
                  <button onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)} style={arrowStyle("left")}>&#8249;</button>
                  <button onClick={() => setIdx((i) => (i + 1) % images.length)} style={arrowStyle("right")}>&#8250;</button>
                  <span style={{
                    position: "absolute", bottom: 10, right: 10,
                    background: "rgba(0,0,0,0.45)", color: "#fff",
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                  }}>
                    {idx + 1} / {images.length}
                  </span>
                </>
              )}
            </div>

            {/* Thumbnail strip — only when multiple images */}
            {images.length > 1 && (
              <div style={{ display: "flex", gap: 8, padding: "10px 12px", background: "#fff5f7", flexWrap: "wrap" }}>
                {images.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`angle ${i + 1}`}
                    onClick={() => setIdx(i)}
                    style={{
                      width: 58, height: 58, objectFit: "cover", borderRadius: 8, cursor: "pointer",
                      border: i === idx ? "2.5px solid #be185d" : "2px solid #fce7f3",
                      opacity: i === idx ? 1 : 0.65,
                      transition: "border .2s, opacity .2s",
                    }}
                    onError={(e) => (e.target.style.display = "none")}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: "1 1 300px", minHeight: 520, padding: "28px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{
              margin: 0, fontFamily: "'Playfair Display', serif",
              fontSize: 24, fontWeight: 900, color: "#1a1a1a", lineHeight: 1.2,
            }}>
              {product.title}
            </h2>

            {/* Price */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ color: "#be185d", fontWeight: 900, fontSize: 26 }}>₱{sp.toFixed(2)}</span>
              {product.discount > 0 && (
                <span style={{ color: "#bbb", textDecoration: "line-through", fontSize: 15 }}>
                  ₱{Number(product.price).toFixed(2)}
                </span>
              )}
              {product.discount > 0 && (
                <span style={{
                  background: "#fff5f7", color: "#be185d", fontSize: 11,
                  fontWeight: 800, padding: "2px 10px", borderRadius: 20, border: "1px solid #fce7f3",
                }}>
                  Save {product.discount}%
                </span>
              )}
            </div>

            {/* Description */}
            <p style={{ color: "#555", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
              {product.description || "No description available."}
            </p>

            {/* Stock badge — single item only, so just Available / Sold */}
            <div>
              <span style={{
                padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: soldOut ? "#fff5f5" : "#f0fdf4",
                color: soldOut ? "#ef4444" : "#22c55e",
                border: `1px solid ${soldOut ? "#fecaca" : "#bbf7d0"}`,
              }}>
                {soldOut ? "Sold" : "Available — 1 of a kind"}
              </span>
            </div>

            {/* Add to cart */}
            <button
              onClick={() => { onAddToCart(product); onClose(); }}
              disabled={soldOut}
              style={{
                background: soldOut ? "#e5e7eb" : "linear-gradient(135deg, #f9a8d4 0%, #be185d 100%)",
                border: "none", borderRadius: 12, color: soldOut ? "#9ca3af" : "#fff",
                fontWeight: 800, fontSize: 14, letterSpacing: 1, padding: "14px 0",
                cursor: soldOut ? "not-allowed" : "pointer",
                marginTop: "auto",
              }}
            >
              {soldOut ? "SOLD" : "ADD TO CART"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card ───────────────────────────────────────────────────────────────────
export function Card({ product, compact = false }) {
  const { addToCart } = useApp();
  const [showModal, setShowModal] = useState(false);
  const sp = salePrice(product.price, product.discount);
  const images = getImages(product);
  const soldOut = product.stock === 0;

  return (
    <>
      {showModal && (
        <ProductModal
          product={product}
          onClose={() => setShowModal(false)}
          onAddToCart={addToCart}
        />
      )}
    <div
      onClick={() => setShowModal(true)}
      style={{
        background: "#fff",
        borderRadius: compact ? 8 : 14,
        overflow: "hidden",
        boxShadow: "0 2px 16px rgba(190,24,93,0.08)",
        border: "1px solid #fce7f3",
        transition: "transform .25s, box-shadow .25s",
        cursor: "pointer",
        opacity: soldOut ? 0.75 : 1,
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
      {/* Image area */}
      <div style={{ position: "relative", height: compact ? 140 : 220, overflow: "hidden" }}>
        <div style={{ filter: soldOut ? "grayscale(0.7)" : "none", height: "100%" }}>
          <ImageViewer images={images} height={compact ? 140 : 220} title={product.title} />
        </div>

        {/* Sold Out overlay badge */}
        {soldOut && (
          <span style={{
            position: "absolute", top: 8, right: 8, zIndex: 4,
            background: "#ef4444", color: "#fff",
            fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 20,
          }}>
            SOLD
          </span>
        )}
        {/* Discount badge */}
        {!soldOut && product.discount > 0 && (
          <span style={{
            position: "absolute", top: 8, right: 8, zIndex: 4,
            background: "#be185d", color: "#fff",
            fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 20,
          }}>
            -{product.discount}%
          </span>
        )}
        {/* Featured badge */}
        {product.featured && (
          <span style={{
            position: "absolute", top: images.length > 1 ? 30 : 8, left: 8, zIndex: 4,
            background: "rgba(255,255,255,0.92)", color: "#be185d",
            fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 20,
            border: "1px solid #fce7f3",
          }}>
            FEATURED
          </span>
        )}
      </div>

      {/* Card body */}
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
          onClick={(e) => { e.stopPropagation(); if (!soldOut) addToCart(product); }}
          disabled={soldOut}
          style={{
            width: "100%",
            background: soldOut ? "#e5e7eb" : "linear-gradient(135deg, #f9a8d4 0%, #be185d 100%)",
            border: "none", borderRadius: 8, color: soldOut ? "#9ca3af" : "#fff",
            fontWeight: 700, fontSize: compact ? 10 : 12, letterSpacing: 0.8,
            padding: compact ? "7px 0" : "10px 0",
            cursor: soldOut ? "not-allowed" : "pointer",
          }}
        >
          {soldOut ? "SOLD" : "ADD TO CART"}
        </button>
      </div>
    </div>
    </>
  );
}