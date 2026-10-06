
import { apiFetch } from "../utils/api";
import { supabase } from "../utils/supabase";
import { createContext, useContext, useState, useEffect, useRef } from "react";

export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [toasts, setToasts] = useState([]);

  const toast = (msg, type = "info") => {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  // Build our app's "user" shape from a Supabase session + profiles row
   const pendingChallengeRef = useRef(false); // suppresses auto user-load during MFA/OTP step


  const loadProfileForSession = async (session) => {
    if (!session?.user) {
      setUser(null);
      return;
    }
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, fullname, username, phone, address, role, status")
      .eq("id", session.user.id)
      .single();

    if (error || !profile) {
      console.error("Failed to load profile:", error?.message);
      setUser(null);
      return;
    }

    setUser({
      id: profile.id,
      fullname: profile.fullname,
      username: profile.username,
      email: session.user.email,
      phone: profile.phone,
      address: profile.address,
      role: profile.role,
      status: profile.status,
    });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!pendingChallengeRef.current) {
        loadProfileForSession(session).finally(() => setAuthLoading(false));
      } else {
        setAuthLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (pendingChallengeRef.current) return; // ignore session changes mid-challenge
      loadProfileForSession(session);
      if (event === "SIGNED_OUT") setCart([]);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      apiFetch("/cart").then(setCart).catch(() => {});
    } else {
      setCart([]);
    }
  }, [user?.id]);

  // ── AUTH ──────────────────────────────────────────────────

  // Step 1: password check + branch to the right second factor.
  // Returns one of:
  //   { status: "ok" }
  //   { status: "totp_required", factorId }
  //   { status: "email_otp_required", email }
  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();
    if (profileErr || !profile) throw new Error("Could not load account role");

    if (profile.role === "admin") {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        pendingChallengeRef.current = true;
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.find((f) => f.status === "verified");
        if (!totp) {
          pendingChallengeRef.current = false;
          return { status: "ok" }; // admin has no factor enrolled yet — let through, nag elsewhere
        }
        return { status: "totp_required", factorId: totp.id };
      }
      return { status: "ok" };
    }

    // Customer: sign back out, force an emailed code before granting access
    pendingChallengeRef.current = true;
    await supabase.auth.signOut();
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (otpErr) {
      pendingChallengeRef.current = false;
      throw new Error(otpErr.message);
    }
    return { status: "email_otp_required", email };
  };

  const verifyTotpChallenge = async (factorId, code) => {
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeErr) throw new Error(challengeErr.message);

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyErr) throw new Error(verifyErr.message);

    pendingChallengeRef.current = false;
    const { data: { session } } = await supabase.auth.getSession();
    await loadProfileForSession(session);
    toast(`Welcome back! 🌸`, "success");
  };

  const verifyEmailOtpChallenge = async (email, code) => {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (error) throw new Error(error.message);

    pendingChallengeRef.current = false;
    await loadProfileForSession(data.session);
    toast(`Welcome back! 🌸`, "success");
  };

  const cancelChallenge = async () => {
    pendingChallengeRef.current = false;
    await supabase.auth.signOut();
    setUser(null);
  };

  const completeLogin = () => {}; // kept for compatibility, no-op now (handled in verify* above)

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCart([]);
    toast("Logged out successfully.", "info");
  };

  const registerUser = async (form) => {
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          fullname: form.fullname || form.username,
          username: form.username,
          phone: form.phone,
          address: form.address,
        },
      },
    });
    if (error) throw new Error(error.message);
    return data;
  };

  const completeRegister = () => {
    toast(`Welcome to FITCHEQUE! 🌸`, "success");
  };

  const updateProfile = async (form) => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        fullname: form.fullname,
        phone: form.phone,
        address: form.address,
      })
      .eq("id", user.id);
    if (error) throw new Error(error.message);
    setUser((u) => ({ ...u, ...form }));
    toast("Profile updated! ✨", "success");
  };

  // ── CART (unchanged — still via Express) ───────────────────

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
    user, authLoading, cart, toasts,
    login, logout, registerUser, completeLogin, completeRegister, updateProfile,
    verifyTotpChallenge, verifyEmailOtpChallenge, cancelChallenge,
    addToCart, removeFromCart, updateQty, clearCart,
    toast,
  };



  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>;
}