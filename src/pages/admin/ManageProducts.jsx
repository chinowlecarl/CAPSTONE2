import { useState, useEffect, useRef } from "react";
import { apiFetch, fmt, salePrice } from "../../utils/api";
import { useApp } from "../../context/AppContext";

const CATEGORIES = ["Tops","Bottoms","Dresses","Jackets","Accessories"];

// Convert file to base64 data URL — no storage bucket required
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function ImageSlot({ label, value, onChange, inputStyle }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Image must be under 5MB."); return; }
    setError(null);
    setUploading(true);
    try {
      const url = await readFileAsDataURL(file);
      onChange(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div>
      <label style={{ display:"block", fontSize:10, fontWeight:800, color:"#888", letterSpacing:1.5, marginBottom:6 }}>
        {label}
      </label>
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        style={{
          display:"flex", alignItems:"center", gap:12,
          border:"1.5px dashed #fce7f3", borderRadius:10, padding:"10px 14px",
          background: uploading ? "#fff8fb" : "#fff5f7",
          cursor: uploading ? "not-allowed" : "pointer",
        }}
        onMouseEnter={(e)=>{ if(!uploading) e.currentTarget.style.borderColor="#db2777"; }}
        onMouseLeave={(e)=>{ e.currentTarget.style.borderColor="#fce7f3"; }}
      >
        <div style={{
          width:60, height:60, borderRadius:8, overflow:"hidden", flexShrink:0,
          background:"#fce7f3", display:"flex", alignItems:"center", justifyContent:"center",
          border:"1px solid #fce7f3",
        }}>
          {value ? (
            <img src={value} alt="preview" style={{ width:"100%", height:"100%", objectFit:"cover" }}
              onError={(e) => { e.target.style.display="none"; }} />
          ) : (
            <span style={{ fontSize:22, color:"#db2777" }}>📷</span>
          )}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          {uploading ? (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:14, height:14, border:"2px solid #fce7f3", borderTopColor:"#be185d", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
              <span style={{ fontSize:12, color:"#be185d", fontWeight:600 }}>Uploading…</span>
            </div>
          ) : value ? (
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:"#be185d" }}>✓ Image uploaded</div>
              <div style={{ fontSize:11, color:"#aaa" }}>Click to replace</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:"#db2777" }}>Click to upload image</div>
              <div style={{ fontSize:11, color:"#aaa" }}>JPG, PNG, WEBP · max 5 MB</div>
            </div>
          )}
        </div>
        {value && !uploading && (
          <button
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            style={{ background:"#fff5f7", border:"1px solid #fce7f3", color:"#be185d", borderRadius:6, fontSize:11, fontWeight:700, padding:"3px 9px", cursor:"pointer", flexShrink:0 }}
          >✕</button>
        )}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="or paste image URL…"
        style={{ ...inputStyle, marginTop:6, fontSize:12, padding:"7px 10px", background:"#fff" }}
        onFocus={(e)=>(e.target.style.borderColor="#db2777")}
        onBlur={(e)=>(e.target.style.borderColor="#fce7f3")}
      />
      {error && <div style={{ fontSize:11, color:"#be185d", marginTop:4, fontWeight:600 }}>⚠ {error}</div>}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display:"none" }} />
    </div>
  );
}

export default function ManageProducts({ setPage }) {
  const { user } = useApp();
  const [products, setProducts] = useState([]);
  const [stats, setStats]       = useState({});
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [editP, setEditP]       = useState(null);
  const [msg, setMsg]           = useState(null);
  const [search, setSearch]     = useState("");
  const [catFilter, setCatFilter] = useState("All");

  const [form, setForm] = useState({
    title:"", description:"", price:"", discount:"0", category:"", stock:"",
    featured:false, image_url:"",
    extra_images: ["", "", ""],
  });

  const sf = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const setImgUrl = (val) => setForm((f) => ({ ...f, image_url: val }));
  const setExtraImage = (i, val) =>
    setForm((f) => {
      const ei = [...f.extra_images];
      ei[i] = val;
      return { ...f, extra_images: ei };
    });

  const showMsg = (text, type = "success") => { setMsg({ text, type }); setTimeout(() => setMsg(null), 3000); };

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    setLoading(true);
    apiFetch("/products")
      .then((p) => setProducts(p))
      .catch(() => {})
      .finally(() => setLoading(false));
    apiFetch("/admin/stats")
      .then((s) => setStats(s))
      .catch(() => {});
  }, [user?.id]);

  const openAdd = () => {
    setForm({ title:"", description:"", price:"", discount:"0", category:"", stock:"", featured:false, image_url:"", extra_images:["","",""] });
    setEditP(null); setModal(true);
  };
  const openEdit = (p) => {
    const ei = [
      (p.images && p.images[1]) || "",
      (p.images && p.images[2]) || "",
      (p.images && p.images[3]) || "",
    ];
    setForm({ title:p.title, description:p.description||"", price:p.price, discount:p.discount, category:p.category, stock:p.stock, featured:!!p.featured, image_url:p.image_url||"", extra_images:ei });
    setEditP(p); setModal(true);
  };

  const save = async () => {
    try {
      // Use the first filled image as image_url; store extras in image_url_2/3/4 if columns exist,
      // but at minimum only image_url is required by the DB.
      const body = {
        title: form.title,
        description: form.description,
        price: +form.price,
        discount: +form.discount,
        category: form.category,
        stock: +form.stock,
        featured: form.featured,
        image_url: form.image_url || form.extra_images.find(Boolean) || "",
      };
      if (editP) {
        const updated = await apiFetch(`/products/${editP.id}`, { method:"PUT", body:JSON.stringify(body) });
        setProducts((ps) => ps.map((p) => p.id === editP.id ? updated.product : p));
        showMsg("Product updated!");
      } else {
        const created = await apiFetch("/products", { method:"POST", body:JSON.stringify(body) });
        setProducts((ps) => [created.product, ...ps]);
        showMsg("Product added!");
      }
      setModal(false);
    } catch (err) { showMsg(err.message, "error"); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    try { await apiFetch(`/products/${id}`,{method:"DELETE"}); setProducts((ps)=>ps.filter((p)=>p.id!==id)); showMsg("Deleted!"); }
    catch (err) { showMsg(err.message, "error"); }
  };

  const allCats = ["All", ...CATEGORIES];
  const filtered = products.filter((p) => {
    const matchCat = catFilter === "All" || p.category === catFilter;
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  if (!user || user.role !== "admin") return null;

  const inputStyle = { width:"100%", padding:"10px 12px", border:"1.5px solid #fce7f3", borderRadius:10, fontSize:13, outline:"none", background:"#fff5f7", boxSizing:"border-box" };

  return (
    <div style={{ padding:"28px 24px", maxWidth:1200, margin:"0 auto" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:14, marginBottom:24 }}>
        {[
          ["📦", stats.total_products||0, "Products",  "#be185d"],
          ["👥", stats.total_customers||0,"Customers", "#db2777"],
          ["🛍", stats.total_orders||0,   "Orders",    "#f472b6"],
          ["₱",  `₱${(stats.total_revenue||0).toFixed(0)}`, "Revenue", "#be185d"],
          ["⚠️", stats.low_stock||0,      "Low Stock", "#9f1239"],
        ].map(([icon, val, label, color]) => (
          <div key={label} style={{ background:"#fff", borderRadius:14, padding:18, border:"1px solid #fce7f3", boxShadow:"0 2px 12px rgba(190,24,93,0.06)", textAlign:"center" }}>
            <div style={{ fontSize:22, marginBottom:4 }}>{icon}</div>
            <div style={{ fontSize:20, fontWeight:900, color, marginBottom:2 }}>{val}</div>
            <div style={{ color:"#888", fontSize:11, fontWeight:600 }}>{label}</div>
          </div>
        ))}
      </div>

      {msg && (
        <div style={{ borderRadius:10, padding:"12px 16px", marginBottom:20, fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:8, background:msg.type==="success"?"#f0fdf4":"#fff5f7", borderLeft:`4px solid ${msg.type==="success"?"#22c55e":"#be185d"}`, color:msg.type==="success"?"#16a34a":"#be185d" }}>
          {msg.type==="success"?"✓":"✗"} {msg.text}
        </div>
      )}

      <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ position:"relative", flex:1, minWidth:200 }}>
          <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#db2777" }}>🔍</span>
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search products..."
            style={{ width:"100%", paddingLeft:36, paddingRight:16, paddingTop:10, paddingBottom:10, border:"1.5px solid #fce7f3", borderRadius:10, fontSize:13, outline:"none", background:"#fff5f7", boxSizing:"border-box" }} />
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {allCats.map((c) => (
            <button key={c} onClick={()=>setCatFilter(c)} style={{ padding:"7px 14px", borderRadius:20, fontSize:11, fontWeight:700, cursor:"pointer", background:catFilter===c?"linear-gradient(135deg,#f9a8d4,#be185d)":"#fff", color:catFilter===c?"#fff":"#be185d", border:`1.5px solid ${catFilter===c?"transparent":"#fce7f3"}` }}>{c}</button>
          ))}
        </div>
        <span style={{ color:"#aaa", fontSize:12 }}>{filtered.length} items</span>
        <button onClick={openAdd} style={{ background:"linear-gradient(135deg,#f9a8d4,#be185d)", border:"none", borderRadius:10, color:"#fff", fontWeight:800, fontSize:12, padding:"9px 20px", cursor:"pointer", letterSpacing:.8, marginLeft:"auto" }}>+ ADD PRODUCT</button>
      </div>

      <div style={{ background:"#fff", borderRadius:16, border:"1px solid #fce7f3", overflow:"hidden", boxShadow:"0 2px 16px rgba(190,24,93,0.06)" }}>
        {loading ? (
          <div style={{ textAlign:"center", padding:60 }}>
            <div style={{ width:36, height:36, border:"4px solid #fce7f3", borderTopColor:"#be185d", borderRadius:"50%", animation:"spin 1s linear infinite", margin:"0 auto" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 24px", color:"#ccc" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📦</div>
            <p style={{ fontWeight:600 }}>No products found</p>
          </div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:"linear-gradient(135deg,#fce7f3,#fbcfe8)" }}>
                  {["Image","Product","Category","Price","Stock","Featured","Actions"].map((h)=>(
                    <th key={h} style={{ padding:"12px 14px", textAlign:"left", fontSize:10, fontWeight:800, color:"#be185d", letterSpacing:1.2, textTransform:"uppercase", borderBottom:"1.5px solid #fce7f3" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p,i)=>(
                  <tr key={p.id} style={{ borderBottom:"1px solid #fce7f3", background:i%2===0?"#fff":"#fff8fb" }}
                    onMouseEnter={(e)=>(e.currentTarget.style.background="#fff5f7")}
                    onMouseLeave={(e)=>(e.currentTarget.style.background=i%2===0?"#fff":"#fff8fb")}>
                    <td style={{ padding:"18px 14px" }}>
                      <img src={p.image_url} alt={p.title} style={{ width:64, height:64, objectFit:"cover", borderRadius:8, border:"1px solid #fce7f3" }}
                        onError={(e)=>(e.target.src="https://placehold.co/52/fce7f3/be185d?text=?")} />
                    </td>
                    <td style={{ padding:"18px 14px" }}>
                      <div style={{ fontWeight:700, color:"#1a1a1a" }}>{p.title}</div>
                      <div style={{ color:"#bbb", fontSize:11, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.description}</div>
                    </td>
                    <td style={{ padding:"18px 14px" }}>
                      <span style={{ background:"#fff5f7", color:"#be185d", fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20, border:"1px solid #fce7f3" }}>{p.category}</span>
                    </td>
                    <td style={{ padding:"18px 14px" }}>
                      {p.discount>0 ? (
                        <div>
                          <div style={{ textDecoration:"line-through", color:"#ccc", fontSize:11 }}>{fmt(p.price)}</div>
                          <div style={{ fontWeight:800, color:"#be185d" }}>{fmt(salePrice(p.price,p.discount))}</div>
                        </div>
                      ) : <div style={{ fontWeight:700 }}>{fmt(p.price)}</div>}
                    </td>
                    <td style={{ padding:"18px 14px" }}>
                      <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700, background:p.stock===0?"#fff5f5":p.stock<5?"#fffbeb":"#f0fdf4", color:p.stock===0?"#ef4444":p.stock<5?"#f59e0b":"#22c55e" }}>
                        {p.stock===0?"Out":p.stock<5?`${p.stock} Low`:p.stock}
                      </span>
                    </td>
                    <td style={{ padding:"18px 14px", textAlign:"center" }}>
                      {p.featured?<span style={{ color:"#f9a8d4", fontSize:18 }}>★</span>:<span style={{ color:"#eee" }}>–</span>}
                    </td>
                    <td style={{ padding:"18px 14px" }}>
                      <div style={{ display:"flex", gap:6 }}>
                        <button onClick={()=>openEdit(p)} style={{ background:"#eff6ff", border:"1px solid #bfdbfe", color:"#3b82f6", fontSize:11, fontWeight:700, padding:"5px 12px", borderRadius:8, cursor:"pointer" }}>Edit</button>
                        <button onClick={()=>del(p.id)} style={{ background:"#fff5f7", border:"1px solid #fce7f3", color:"#be185d", fontSize:11, fontWeight:700, padding:"5px 12px", borderRadius:8, cursor:"pointer" }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:560, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ background:"linear-gradient(135deg,#1a1a1a,#2d1d2e)", padding:"18px 22px", display:"flex", justifyContent:"space-between", alignItems:"center", borderRadius:"20px 20px 0 0" }}>
              <h3 style={{ color:"#fff", margin:0, fontFamily:"'Playfair Display',serif", fontSize:18 }}>{editP?"Edit Product":"Add New Product"}</h3>
              <button onClick={()=>setModal(false)} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.6)", fontSize:22, cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ padding:24, display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                {[["Title *","title","text"],["Category *","category","select"],["Price (₱) *","price","number"],["Discount (%)","discount","number"],["Stock *","stock","number"]].map(([label,key,type])=>(
                  <div key={key} style={key==="title"?{gridColumn:"1/-1"}:{}}>
                    <label style={{ display:"block", fontSize:10, fontWeight:800, color:"#888", letterSpacing:1.5, marginBottom:6 }}>{label.toUpperCase()}</label>
                    {type==="select" ? (
                      <select value={form[key]} onChange={sf(key)} style={{ ...inputStyle }}>
                        <option value="">Select...</option>
                        {CATEGORIES.map((c)=><option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <input type={type} value={form[key]} onChange={sf(key)} min={type==="number"?0:undefined}
                        style={inputStyle}
                        onFocus={(e)=>(e.target.style.borderColor="#db2777")} onBlur={(e)=>(e.target.style.borderColor="#fce7f3")} />
                    )}
                  </div>
                ))}
              </div>
              <div>
                <label style={{ display:"block", fontSize:10, fontWeight:800, color:"#888", letterSpacing:1.5, marginBottom:6 }}>DESCRIPTION</label>
                <textarea value={form.description} onChange={sf("description")} rows={3}
                  style={{ ...inputStyle, resize:"none" }}
                  onFocus={(e)=>(e.target.style.borderColor="#db2777")} onBlur={(e)=>(e.target.style.borderColor="#fce7f3")} />
              </div>

              <ImageSlot label="IMAGE — ANGLE 1 (MAIN) *" value={form.image_url} onChange={setImgUrl} inputStyle={inputStyle} />
              {form.extra_images.map((url, i) => (
                <ImageSlot key={i} label={`IMAGE — ANGLE ${i + 2} (optional)`} value={url} onChange={(val) => setExtraImage(i, val)} inputStyle={inputStyle} />
              ))}

              <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", fontSize:13, fontWeight:600, color:"#555" }}>
                <input type="checkbox" checked={form.featured} onChange={sf("featured")} style={{ width:16, height:16, accentColor:"#be185d" }} />
                ⭐ Feature this product on homepage
              </label>
              <button onClick={save} style={{ background:"linear-gradient(135deg,#f9a8d4,#be185d)", border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:14, letterSpacing:1, padding:"14px 0", cursor:"pointer", marginTop:4 }}>
                {editP?"SAVE CHANGES":"ADD PRODUCT"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}