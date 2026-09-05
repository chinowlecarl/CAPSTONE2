import { useState } from "react";
import { useApp } from "../context/AppContext";
import { fmt, salePrice, apiFetch } from "../utils/api";
 
const PAYMENT_METHODS = [
  { id: "cod",    label: "Cash on Delivery",  icon: "💵", desc: "Pay when your order arrives" },
  { id: "gcash",  label: "GCash",             icon: "📱", desc: "Pay via GCash mobile wallet" },
  { id: "maya",   label: "Maya",              icon: "💳", desc: "Pay via Maya (PayMaya)" },
  { id: "card",   label: "Credit / Debit Card", icon: "🏦", desc: "Visa, Mastercard accepted" },
];
 
export default function Checkout({ setPage }) {
  const { user, cart, toast } = useApp();
 
  const getPrice = (item) => {
    const p = item.products || item;
    return salePrice(p.price, p.discount);
  };
  const getName = (item) => item.products?.title || item.title;
  const getImg  = (item) => item.products?.image_url || item.image_url;
 
  const subtotal = cart.reduce((s, i) => s + getPrice(i) * i.quantity, 0);
  const shipping = subtotal > 500 ? 0 : 80;
  const tax      = subtotal * 0.12;
  const total    = subtotal + shipping + tax;
 
  const [step, setStep]       = useState(1); // 1=details, 2=payment, 3=success
  const [payment, setPayment] = useState("cod");
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [form, setForm]       = useState({
    username: user?.username || "",
    fullname: user?.fullname || "",
    email:    user?.email    || "",
    phone:    user?.phone    || "",
    address:  user?.address  || "",
    city:     "",
    zip:      "",
    notes:    "",
  });
  const [cardForm, setCardForm] = useState({ number: "", name: "", expiry: "", cvv: "" });
 
  const sf  = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const scf = (k) => (e) => setCardForm((f) => ({ ...f, [k]: e.target.value }));
 
  const inputStyle = {
    width: "100%", padding: "10px 14px",
    border: "1.5px solid #fce7f3", borderRadius: 10,
    fontSize: 13, outline: "none", background: "#fff5f7",
    boxSizing: "border-box",
  };
  const labelStyle = {
    display: "block", fontSize: 10, fontWeight: 800,
    color: "#888", letterSpacing: 1.5, marginBottom: 6,
    textTransform: "uppercase",
  };
 
  const validateStep1 = () => {
    if (!form.fullname || !form.email || !form.phone || !form.city)
      return false;
    return true;
  };
 
  const placeOrder = async () => {
    setLoading(true);
    try {
      const addressPart = form.address ? `${form.address}, ` : "";
      const shipping_address = `${addressPart}${form.city} ${form.zip} — Phone: ${form.phone}`;
      const data = await apiFetch("/orders", {
        method: "POST",
        body: JSON.stringify({ shipping_address }),
      });
      setOrderId(data.order?.id);
      setStep(3);
      toast("Order placed successfully! 🎉", "success");
    } catch (err) {
      toast(err.message, "error");
    }
    setLoading(false);
  };
 
  // Redirect if not logged in or cart empty
  if (!user)  return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", color: "#be185d", marginBottom: 8 }}>Please login first</h2>
      <button onClick={() => setPage("login")} style={{ background: "linear-gradient(135deg,#f9a8d4,#be185d)", border: "none", borderRadius: 20, color: "#fff", fontWeight: 700, padding: "10px 28px", cursor: "pointer" }}>LOGIN</button>
    </div>
  );
 
  if (cart.length === 0 && step !== 3) return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🛍</div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", color: "#be185d", marginBottom: 8 }}>Your cart is empty</h2>
      <button onClick={() => setPage("products")} style={{ background: "linear-gradient(135deg,#f9a8d4,#be185d)", border: "none", borderRadius: 20, color: "#fff", fontWeight: 700, padding: "10px 28px", cursor: "pointer" }}>BROWSE PRODUCTS</button>
    </div>
  );
 
  // ── SUCCESS SCREEN ──────────────────────────────────────────
  if (step === 3) return (
    <div style={{ minHeight: "100vh", background: "#fff5f7", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 24, padding: "48px 40px", textAlign: "center", maxWidth: 480, width: "100%", border: "1px solid #fce7f3", boxShadow: "0 8px 40px rgba(190,24,93,0.12)" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg,#f9a8d4,#be185d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 20px" }}>✓</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: "#1a1a1a", margin: "0 0 8px" }}>Order Placed!</h1>
        <p style={{ color: "#be185d", fontWeight: 600, fontSize: 14, margin: "0 0 24px" }}>Thank you for shopping with FITCHEQUE 🌸</p>
        {orderId && (
          <div style={{ background: "#fff5f7", borderRadius: 12, padding: "12px 20px", marginBottom: 24, border: "1px solid #fce7f3" }}>
            <p style={{ color: "#aaa", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, margin: "0 0 4px" }}>ORDER ID</p>
            <p style={{ fontFamily: "monospace", color: "#be185d", fontWeight: 700, fontSize: 13, margin: 0 }}>#{orderId.slice(0,8).toUpperCase()}</p>
          </div>
        )}
        <div style={{ background: "#fff5f7", borderRadius: 12, padding: "16px 20px", marginBottom: 28, border: "1px solid #fce7f3", textAlign: "left" }}>
          <p style={{ color: "#aaa", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, margin: "0 0 10px" }}>ORDER DETAILS</p>
          {[
            ["Payment", PAYMENT_METHODS.find(p => p.id === payment)?.label],
            ["Deliver to", `${form.address}, ${form.city}`],
            ["Contact", form.phone],
            ["Total Paid", fmt(total)],
          ].map(([label, val]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: "#888" }}>{label}</span>
              <span style={{ fontWeight: 700, color: "#1a1a1a" }}>{val}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setPage("home")} style={{ flex: 1, background: "linear-gradient(135deg,#f9a8d4,#be185d)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 13, padding: "13px 0", cursor: "pointer" }}>GO HOME</button>
          <button onClick={() => setPage("profile")} style={{ flex: 1, background: "#fff", border: "1.5px solid #fce7f3", borderRadius: 12, color: "#be185d", fontWeight: 700, fontSize: 13, padding: "13px 0", cursor: "pointer" }}>MY ORDERS</button>
        </div>
      </div>
    </div>
  );
 
  return (
    <div style={{ background: "#fff5f7", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#fce7f3,#fbcfe8)", padding: "28px 24px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: "#1a1a1a", margin: "0 0 16px", letterSpacing: 2 }}>CHECKOUT</h1>
        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0 }}>
          {[["1", "Details"], ["2", "Payment"]].map(([num, label], i) => (
            <div key={num} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: step >= +num ? "linear-gradient(135deg,#f9a8d4,#be185d)" : "#fff", border: "2px solid #fce7f3", display: "flex", alignItems: "center", justifyContent: "center", color: step >= +num ? "#fff" : "#ccc", fontWeight: 800, fontSize: 13 }}>{num}</div>
                <span style={{ fontSize: 10, fontWeight: 700, color: step >= +num ? "#be185d" : "#ccc", marginTop: 4, letterSpacing: 1 }}>{label}</span>
              </div>
              {i < 1 && <div style={{ width: 60, height: 2, background: step > 1 ? "#be185d" : "#fce7f3", margin: "0 8px 16px" }} />}
            </div>
          ))}
        </div>
      </div>
 
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
 
        {/* Left — Steps */}
        <div>
          {/* STEP 1 — Delivery Details */}
          {step === 1 && (
            <div style={{ background: "#fff", borderRadius: 16, padding: 28, border: "1px solid #fce7f3", boxShadow: "0 2px 16px rgba(190,24,93,0.06)" }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a", margin: "0 0 24px" }}>Delivery Details</h2>
 
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Full Name *</label>
                  <input value={form.fullname} onChange={sf("fullname")} placeholder="Juan dela Cruz"
                    style={inputStyle} onFocus={(e)=>(e.target.style.borderColor="#db2777")} onBlur={(e)=>(e.target.style.borderColor="#fce7f3")} />
                </div>
                <div>
                  <label style={labelStyle}>Username</label>
                  <input value={form.username} disabled
                    style={{ ...inputStyle, background: "#f3f4f6", color: "#888", cursor: "not-allowed" }} />
                </div>
                <div>
                  <label style={labelStyle}>Email *</label>
                  <input type="email" value={form.email} onChange={sf("email")} placeholder="juan@email.com"
                    style={inputStyle} onFocus={(e)=>(e.target.style.borderColor="#db2777")} onBlur={(e)=>(e.target.style.borderColor="#fce7f3")} />
                </div>
                <div>
                  <label style={labelStyle}>Phone Number *</label>
                  <input type="tel" value={form.phone} onChange={sf("phone")} placeholder="09XX XXX XXXX"
                    style={inputStyle} onFocus={(e)=>(e.target.style.borderColor="#db2777")} onBlur={(e)=>(e.target.style.borderColor="#fce7f3")} />
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={labelStyle}>Street Address (optional)</label>
                  <input value={form.address} onChange={sf("address")} placeholder="123 Rizal St, Barangay..."
                    style={inputStyle} onFocus={(e)=>(e.target.style.borderColor="#db2777")} onBlur={(e)=>(e.target.style.borderColor="#fce7f3")} />
                </div>
                <div>
                  <label style={labelStyle}>City / Municipality *</label>
                  <input value={form.city} onChange={sf("city")} placeholder="Quezon City"
                    style={inputStyle} onFocus={(e)=>(e.target.style.borderColor="#db2777")} onBlur={(e)=>(e.target.style.borderColor="#fce7f3")} />
                </div>
                <div>
                  <label style={labelStyle}>ZIP Code</label>
                  <input value={form.zip} onChange={sf("zip")} placeholder="1100"
                    style={inputStyle} onFocus={(e)=>(e.target.style.borderColor="#db2777")} onBlur={(e)=>(e.target.style.borderColor="#fce7f3")} />
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={labelStyle}>Order Notes (optional)</label>
                  <textarea value={form.notes} onChange={sf("notes")} rows={3} placeholder="Any special instructions for your order..."
                    style={{ ...inputStyle, resize: "none" }} onFocus={(e)=>(e.target.style.borderColor="#db2777")} onBlur={(e)=>(e.target.style.borderColor="#fce7f3")} />
                </div>
              </div>
 
              <button
                onClick={() => { if (validateStep1()) setStep(2); else alert("Please fill in all required fields."); }}
                style={{ width: "100%", background: "linear-gradient(135deg,#f9a8d4,#be185d)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 14, letterSpacing: 1, padding: "14px 0", cursor: "pointer", marginTop: 24 }}>
                CONTINUE TO PAYMENT →
              </button>
            </div>
          )}
 
          {/* STEP 2 — Payment */}
          {step === 2 && (
            <div style={{ background: "#fff", borderRadius: 16, padding: 28, border: "1px solid #fce7f3", boxShadow: "0 2px 16px rgba(190,24,93,0.06)" }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a", margin: "0 0 24px" }}>Payment Method</h2>
 
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                {PAYMENT_METHODS.map((pm) => (
                  <button key={pm.id} onClick={() => setPayment(pm.id)}
                    style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", border: `2px solid ${payment === pm.id ? "#be185d" : "#fce7f3"}`, borderRadius: 12, background: payment === pm.id ? "#fff5f7" : "#fff", cursor: "pointer", textAlign: "left", transition: "all .2s" }}>
                    <span style={{ fontSize: 28 }}>{pm.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, color: "#1a1a1a", fontSize: 14 }}>{pm.label}</div>
                      <div style={{ color: "#aaa", fontSize: 12, marginTop: 2 }}>{pm.desc}</div>
                    </div>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${payment === pm.id ? "#be185d" : "#ddd"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {payment === pm.id && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#be185d" }} />}
                    </div>
                  </button>
                ))}
              </div>
 
              {/* Card form */}
              {payment === "card" && (
                <div style={{ background: "#fff5f7", borderRadius: 12, padding: 20, border: "1px solid #fce7f3", marginBottom: 20 }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: "#be185d", letterSpacing: 1.5, margin: "0 0 16px" }}>CARD DETAILS</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Card Number</label>
                      <input value={cardForm.number} onChange={scf("number")} placeholder="1234 5678 9012 3456" maxLength={19}
                        style={inputStyle} onFocus={(e)=>(e.target.style.borderColor="#db2777")} onBlur={(e)=>(e.target.style.borderColor="#fce7f3")} />
                    </div>
                    <div>
                      <label style={labelStyle}>Name on Card</label>
                      <input value={cardForm.name} onChange={scf("name")} placeholder="JUAN DELA CRUZ"
                        style={inputStyle} onFocus={(e)=>(e.target.style.borderColor="#db2777")} onBlur={(e)=>(e.target.style.borderColor="#fce7f3")} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Expiry Date</label>
                        <input value={cardForm.expiry} onChange={scf("expiry")} placeholder="MM/YY" maxLength={5}
                          style={inputStyle} onFocus={(e)=>(e.target.style.borderColor="#db2777")} onBlur={(e)=>(e.target.style.borderColor="#fce7f3")} />
                      </div>
                      <div>
                        <label style={labelStyle}>CVV</label>
                        <input value={cardForm.cvv} onChange={scf("cvv")} placeholder="123" maxLength={4} type="password"
                          style={inputStyle} onFocus={(e)=>(e.target.style.borderColor="#db2777")} onBlur={(e)=>(e.target.style.borderColor="#fce7f3")} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
 
              {/* GCash instructions */}
              {payment === "gcash" && (
                <div style={{ background: "#fff5f7", borderRadius: 12, padding: 20, border: "1px solid #fce7f3", marginBottom: 20 }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: "#be185d", letterSpacing: 1.5, margin: "0 0 10px" }}>GCASH INSTRUCTIONS</p>
                  <p style={{ fontSize: 13, color: "#555", margin: "0 0 6px" }}>📱 Send payment to: <strong>09XX XXX XXXX</strong></p>
                  <p style={{ fontSize: 13, color: "#555", margin: "0 0 6px" }}>💰 Amount: <strong>{fmt(total)}</strong></p>
                  <p style={{ fontSize: 12, color: "#aaa", margin: 0 }}>Use your Order ID as reference after placing order.</p>
                </div>
              )}
 
              {/* Maya instructions */}
              {payment === "maya" && (
                <div style={{ background: "#fff5f7", borderRadius: 12, padding: 20, border: "1px solid #fce7f3", marginBottom: 20 }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: "#be185d", letterSpacing: 1.5, margin: "0 0 10px" }}>MAYA INSTRUCTIONS</p>
                  <p style={{ fontSize: 13, color: "#555", margin: "0 0 6px" }}>💳 Send payment to: <strong>09XX XXX XXXX</strong></p>
                  <p style={{ fontSize: 13, color: "#555", margin: "0 0 6px" }}>💰 Amount: <strong>{fmt(total)}</strong></p>
                  <p style={{ fontSize: 12, color: "#aaa", margin: 0 }}>Use your Order ID as reference after placing order.</p>
                </div>
              )}
 
              {/* Delivery summary */}
              <div style={{ background: "#fff5f7", borderRadius: 12, padding: 16, border: "1px solid #fce7f3", marginBottom: 20 }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: "#be185d", letterSpacing: 1.5, margin: "0 0 10px" }}>DELIVERING TO</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", margin: "0 0 2px" }}>{form.fullname}</p>
                <p style={{ fontSize: 12, color: "#888", margin: "0 0 2px" }}>{form.address ? `${form.address}, ` : ""}{form.city} {form.zip}</p>
                <p style={{ fontSize: 12, color: "#888", margin: 0 }}>{form.phone}</p>
                <button onClick={() => setStep(1)} style={{ background: "none", border: "none", color: "#be185d", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "6px 0 0", textDecoration: "underline" }}>Edit details</button>
              </div>
 
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep(1)} style={{ flex: 1, background: "#fff", border: "1.5px solid #fce7f3", borderRadius: 12, color: "#be185d", fontWeight: 700, fontSize: 13, padding: "13px 0", cursor: "pointer" }}>← BACK</button>
                <button onClick={placeOrder} disabled={loading}
                  style={{ flex: 2, background: "linear-gradient(135deg,#f9a8d4,#be185d)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 14, letterSpacing: 1, padding: "13px 0", cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
                  {loading ? "PLACING ORDER..." : "PLACE ORDER 🌸"}
                </button>
              </div>
            </div>
          )}
        </div>
 
        {/* Right — Order Summary */}
        <div>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #fce7f3", boxShadow: "0 4px 20px rgba(190,24,93,0.08)", position: "sticky", top: 80 }}>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#1a1a1a", margin: "0 0 16px", paddingBottom: 14, borderBottom: "1.5px solid #fce7f3" }}>
              Order Summary
            </h3>
 
            {/* Cart items */}
            <div style={{ maxHeight: 240, overflowY: "auto", marginBottom: 16 }}>
              {cart.map((item, idx) => (
                <div key={item.id || idx} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
                  <img src={getImg(item)} alt={getName(item)} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, flexShrink: 0, border: "1px solid #fce7f3" }}
                    onError={(e) => (e.target.src = "https://placehold.co/48/fce7f3/be185d?text=?")} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", margin: "0 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{getName(item)}</p>
                    <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Qty: {item.quantity}</p>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#be185d", flexShrink: 0 }}>{fmt(getPrice(item) * item.quantity)}</span>
                </div>
              ))}
            </div>
 
            {/* Totals */}
            <div style={{ borderTop: "1.5px solid #fce7f3", paddingTop: 14 }}>
              {[["Subtotal", fmt(subtotal)], ["Shipping", shipping === 0 ? "FREE" : fmt(shipping)], ["Tax (12%)", fmt(tax)]].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13, color: "#666" }}>
                  <span>{label}</span>
                  <span style={{ fontWeight: 600, color: label === "Shipping" && shipping === 0 ? "#22c55e" : "#333" }}>{val}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 900, color: "#1a1a1a", borderTop: "2px solid #fce7f3", paddingTop: 12, marginTop: 4 }}>
                <span>TOTAL</span>
                <span style={{ color: "#be185d" }}>{fmt(total)}</span>
              </div>
            </div>
 
            {shipping === 0 && (
              <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "8px 12px", marginTop: 12, border: "1px solid #bbf7d0", fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
                🎉 You qualify for FREE shipping!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}