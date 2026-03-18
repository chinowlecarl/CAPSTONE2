import { useState } from "react";
import { apiFetch } from "../../utils/api";
import { useApp } from "../../context/AppContext";

const INITIAL = { title: "", description: "", price: "", discount: "0", category: "", stock: "", featured: false, image_url: "" };
const CATEGORIES = ["Tops","Bottoms","Dresses","Jackets","Accessories"];

export default function CreateEvent({ setPage }) {
  const { user, toast } = useApp();
  const [form, setForm]       = useState(INITIAL);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState([]);

  const sf = (k) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: val }));
    if (k === "image_url") setPreview(val);
  };

  const validate = () => {
    const errs = [];
    if (!form.title.trim())    errs.push("Title is required");
    if (!form.category)        errs.push("Category is required");
    if (!form.price || isNaN(+form.price) || +form.price <= 0) errs.push("Valid price is required");
    if (isNaN(+form.stock) || +form.stock < 0) errs.push("Stock must be 0 or more");
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    setErrors(errs);
    if (errs.length > 0) return;
    setLoading(true);
    try {
      await apiFetch("/products", {
        method: "POST",
        body: JSON.stringify({ ...form, price: +form.price, discount: +form.discount, stock: +form.stock }),
      });
      toast("Product created successfully! 🎉", "success");
      setForm(INITIAL);
      setPreview("");
      setErrors([]);
    } catch (err) {
      setErrors([err.message]);
    }
    setLoading(false);
  };

  if (!user || user.role !== "admin") return null;

  const inputStyle = { width: "100%", padding: "10px 12px", border: "1.5px solid #fce7f3", borderRadius: 10, fontSize: 13, outline: "none", background: "#fff5f7", boxSizing: "border-box" };
  const labelStyle = { display: "block", fontSize: 10, fontWeight: 800, color: "#888", letterSpacing: 1.5, marginBottom: 6, textTransform: "uppercase" };

  return (
    <div style={{ padding: "28px 24px", maxWidth: 860, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#1a1a1a", margin: "0 0 4px" }}>Add New Product</h1>
        <p style={{ color: "#aaa", fontSize: 13 }}>Fill in the details to add a new item to the store</p>
      </div>

      {errors.length > 0 && (
        <div style={{ background: "#fff5f7", border: "1px solid #fce7f3", borderLeft: "4px solid #be185d", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
          {errors.map((e, i) => <p key={i} style={{ color: "#be185d", fontSize: 12, fontWeight: 600, margin: "2px 0" }}>⚠ {e}</p>)}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
        {/* Form */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #fce7f3", padding: 24, boxShadow: "0 2px 16px rgba(190,24,93,0.06)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Title *</label>
              <input value={form.title} onChange={sf("title")} placeholder="e.g. Vintage Floral Dress"
                style={inputStyle}
                onFocus={(e)=>(e.target.style.borderColor="#db2777")} onBlur={(e)=>(e.target.style.borderColor="#fce7f3")} />
            </div>

            <div>
              <label style={labelStyle}>Category *</label>
              <select value={form.category} onChange={sf("category")} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="">Select category...</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Price (₱) *</label>
              <input type="number" value={form.price} onChange={sf("price")} min="0" step="0.01" placeholder="0.00"
                style={inputStyle}
                onFocus={(e)=>(e.target.style.borderColor="#db2777")} onBlur={(e)=>(e.target.style.borderColor="#fce7f3")} />
            </div>

            <div>
              <label style={labelStyle}>Discount (%)</label>
              <input type="number" value={form.discount} onChange={sf("discount")} min="0" max="100" placeholder="0"
                style={inputStyle}
                onFocus={(e)=>(e.target.style.borderColor="#db2777")} onBlur={(e)=>(e.target.style.borderColor="#fce7f3")} />
            </div>

            <div>
              <label style={labelStyle}>Stock *</label>
              <input type="number" value={form.stock} onChange={sf("stock")} min="0" placeholder="0"
                style={inputStyle}
                onFocus={(e)=>(e.target.style.borderColor="#db2777")} onBlur={(e)=>(e.target.style.borderColor="#fce7f3")} />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Description</label>
              <textarea value={form.description} onChange={sf("description")} rows={4} placeholder="Describe the product..."
                style={{ ...inputStyle, resize: "vertical" }}
                onFocus={(e)=>(e.target.style.borderColor="#db2777")} onBlur={(e)=>(e.target.style.borderColor="#fce7f3")} />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Image URL</label>
              <input value={form.image_url} onChange={sf("image_url")} placeholder="https://images.unsplash.com/..."
                style={inputStyle}
                onFocus={(e)=>(e.target.style.borderColor="#db2777")} onBlur={(e)=>(e.target.style.borderColor="#fce7f3")} />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#555" }}>
                <input type="checkbox" checked={form.featured} onChange={sf("featured")} style={{ width: 16, height: 16, accentColor: "#be185d" }} />
                ⭐ Feature this product on the homepage
              </label>
            </div>
          </div>

          <button onClick={handleSubmit} disabled={loading}
            style={{ width: "100%", background: "linear-gradient(135deg,#f9a8d4,#be185d)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 14, letterSpacing: 1, padding: "14px 0", cursor: "pointer", marginTop: 20, opacity: loading ? 0.7 : 1 }}>
            {loading ? "ADDING PRODUCT..." : "ADD PRODUCT"}
          </button>
        </div>

        {/* Preview */}
        <div>
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #fce7f3", overflow: "hidden", boxShadow: "0 2px 16px rgba(190,24,93,0.06)" }}>
            <div style={{ padding: "12px 16px", background: "linear-gradient(135deg,#fce7f3,#fbcfe8)", borderBottom: "1.5px solid #fce7f3" }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: "#be185d", letterSpacing: 1.2, textTransform: "uppercase", margin: 0 }}>Live Preview</p>
            </div>
            <div style={{ height: 200, background: "#fce7f3", overflow: "hidden" }}>
              {preview ? (
                <img src={preview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => { e.target.style.display = "none"; }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 40 }}>🖼</span>
                </div>
              )}
            </div>
            <div style={{ padding: 16 }}>
              {form.category && <p style={{ color: "#db2777", fontSize: 10, fontWeight: 700, letterSpacing: 1.2, margin: "0 0 4px", textTransform: "uppercase" }}>{form.category}</p>}
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: form.title ? "#1a1a1a" : "#ddd", margin: "0 0 8px" }}>{form.title || "Product title"}</h3>
              {form.description && <p style={{ color: "#888", fontSize: 12, margin: "0 0 10px", lineHeight: 1.5 }}>{form.description.slice(0,80)}{form.description.length > 80 ? "..." : ""}</p>}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {+form.discount > 0 && form.price && <span style={{ color: "#bbb", textDecoration: "line-through", fontSize: 12 }}>₱{Number(form.price).toFixed(2)}</span>}
                <span style={{ color: "#be185d", fontWeight: 800, fontSize: 16 }}>
                  {form.price ? `₱${(+form.price * (1 - (+form.discount || 0) / 100)).toFixed(2)}` : "₱0.00"}
                </span>
                {+form.discount > 0 && <span style={{ background: "#be185d", color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 20 }}>-{form.discount}%</span>}
              </div>
              {form.featured && <p style={{ fontSize: 11, color: "#f9a8d4", fontWeight: 700, margin: "8px 0 0" }}>★ Featured on homepage</p>}
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #fce7f3", padding: 16, marginTop: 14, boxShadow: "0 2px 16px rgba(190,24,93,0.06)" }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: "#be185d", letterSpacing: 1.2, textTransform: "uppercase", margin: "0 0 10px" }}>Quick Tips</p>
            {[
              "Use high-quality square images (500×500px)",
              "Write descriptions under 150 characters",
              "Set stock to 0 to mark as out of stock",
              "Featured items appear in the hero banner",
            ].map((tip) => (
              <p key={tip} style={{ fontSize: 12, color: "#777", margin: "0 0 6px", paddingLeft: 12, borderLeft: "2px solid #fce7f3" }}>{tip}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
