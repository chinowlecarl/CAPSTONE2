import { createContext, useContext, useState, useEffect } from "react";
import { apiFetch } from "../utils/api";

export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fitcheque_user")); }
    catch { return null; }
  });
  const [cart, setCart] = useState([]);
  const [toasts, setToasts] = useState([]);

  const toast = (msg, type = "info") => {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  useEffect(() => {
    if (user) {
      apiFetch("/cart").then(setCart).catch(() => {});
    } else {
      setCart([]);
    }
  }, [user?.id]);

  const login = async (username, password) => {
    const data = await apiFetch("/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem("fitcheque_token", data.token);
    localStorage.setItem("fitcheque_user", JSON.stringify(data.user));
    setUser(data.user);
    toast(`Welcome back, ${data.user.fullname}! 🌸`, "success");
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("fitcheque_token");
    localStorage.removeItem("fitcheque_user");
    setUser(null);
    setCart([]);
    toast("Logged out successfully.", "info");
  };

  const registerUser = async (form) => {
    const data = await apiFetch("/register", {
      method: "POST",
      body: JSON.stringify(form),
    });
    localStorage.setItem("fitcheque_token", data.token);
    localStorage.setItem("fitcheque_user", JSON.stringify(data.user));
    setUser(data.user);
    toast(`Welcome to FITCHEQUE, ${data.user.username}! 🌸`, "success");
    return data.user;
  };

  const updateProfile = async (form) => {
    const data = await apiFetch("/me", {
      method: "PUT",
      body: JSON.stringify(form),
    });
    const updated = { ...user, ...data.user };
    localStorage.setItem("fitcheque_user", JSON.stringify(updated));
    setUser(updated);
    toast("Profile updated! ✨", "success");
  };

  const addToCart = async (product) => {
    if (user) {
      try {
        await apiFetch("/cart", {
          method: "POST",
          body: JSON.stringify({ product_id: product.id, quantity: 1 }),
        });
        const updated = await apiFetch("/cart");
        setCart(updated);
      } catch {}
    } else {
      setCart((c) => {
        const found = c.find((i) => i.id === product.id);
        if (found)
          return c.map((i) =>
            i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
          );
        return [...c, { ...product, quantity: 1 }];
      });
    }
    toast(`${product.title} added to cart! 🛍`, "success");
  };

  const removeFromCart = async (id) => {
    if (user) {
      try {
        await apiFetch(`/cart/${id}`, { method: "DELETE" });
        const updated = await apiFetch("/cart");
        setCart(updated);
      } catch {}
    } else {
      setCart((c) => c.filter((i) => i.id !== id));
    }
  };

  const updateQty = async (id, qty) => {
    if (qty < 1) { removeFromCart(id); return; }
    if (user) {
      try {
        await apiFetch(`/cart/${id}`, {
          method: "PUT",
          body: JSON.stringify({ quantity: qty }),
        });
        const updated = await apiFetch("/cart");
        setCart(updated);
      } catch {}
    } else {
      setCart((c) => c.map((i) => (i.id === id ? { ...i, quantity: qty } : i)));
    }
  };

  const ctx = {
    user, cart, toasts,
    login, logout, registerUser, updateProfile,
    addToCart, removeFromCart, updateQty,
    toast,
  };

  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>;
}
