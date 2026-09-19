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

  // Auto-logout when any API call receives a 401 (expired/invalid token)
  useEffect(() => {
    const handle = () => {
      setUser(null);
      setCart([]);
      toast("Your session has expired. Please sign in again.", "error");
    };
    window.addEventListener("fitcheque:unauthorized", handle);
    return () => window.removeEventListener("fitcheque:unauthorized", handle);
  }, []);

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
    // Don't commit the session yet — wait for OTP verification
    return data; // { token, user }
  };

  const completeLogin = (data) => {
    localStorage.setItem("fitcheque_token", data.token);
    localStorage.setItem("fitcheque_user", JSON.stringify(data.user));
    setUser(data.user);
    toast(`Welcome back, ${data.user.fullname}! 🌸`, "success");
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
    // Don't commit the session yet — wait for OTP verification
    return data; // { token, user }
  };

  const completeRegister = (data) => {
    localStorage.setItem("fitcheque_token", data.token);
    localStorage.setItem("fitcheque_user", JSON.stringify(data.user));
    setUser(data.user);
    toast(`Welcome to FITCHEQUE, ${data.user.username}! 🌸`, "success");
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
        toast(`${product.title} added to cart! 🛍`, "success");
      } catch (err) {
        toast(err.message || "Failed to add to cart", "error");
      }
    } else {
      setCart((c) => {
        const found = c.find((i) => i.product_id === product.id);
        if (found)
          return c.map((i) =>
            i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
          );
        return [...c, { ...product, product_id: product.id, quantity: 1 }];
      });
      toast(`${product.title} added to cart! 🛍`, "success");
    }
  };

  const removeFromCart = async (id) => {
    if (user) {
      try {
        await apiFetch(`/cart/${id}`, { method: "DELETE" });
        const updated = await apiFetch("/cart");
        setCart(updated);
      } catch (err) {
        toast(err.message || "Failed to remove item", "error");
      }
    } else {
      setCart((c) => c.filter((i) => i.product_id !== id && i.id !== id));
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
      } catch (err) {
        toast(err.message || "Failed to update quantity", "error");
      }
    } else {
      setCart((c) =>
        c.map((i) =>
          i.product_id === id || i.id === id ? { ...i, quantity: qty } : i
        )
      );
    }
  };

  // Clear cart after a successful order — refresh from server if logged in
  // (in case the backend already emptied it), otherwise just clear local state.
  const clearCart = async () => {
    if (user) {
      try {
        const updated = await apiFetch("/cart");
        setCart(updated);
      } catch {
        setCart([]);
      }
    } else {
      setCart([]);
    }
  };

  const ctx = {
    user, cart, toasts,
    login, logout, registerUser, completeLogin, completeRegister, updateProfile,
    addToCart, removeFromCart, updateQty, clearCart,
    toast,
  };

  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>;
}