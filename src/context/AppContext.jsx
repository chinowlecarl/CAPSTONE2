
import { apiFetch } from "../utils/api";
import { supabase } from "../utils/supabase";
import { createContext, useContext, useState, useEffect, useRef } from "react";

export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

const isPasswordResetLocation = () => {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  return query.get("page") === "reset-password" ||
    hash.get("type") === "recovery" ||
    hash.has("error_code");
};

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [passwordRecoveryReady, setPasswordRecoveryReady] = useState(false);
  const [cart, setCart] = useState([]);
  const [toasts, setToasts] = useState([]);
  const initialHashParams = new URLSearchParams(window.location.hash.slice(1));
  const recoveryCallbackRef = useRef(initialHashParams.get("type") === "recovery");

  const toast = (msg, type = "info") => {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  const pendingChallengeRef = useRef(false);
  const unauthorizedRef = useRef(false);


  const loadProfileForSession = async (session) => {
    if (!session?.user) {
      setUser(null);
      return false;
    }

    try {
      const profile = await apiFetch("/me");
      if (profile.id !== session.user.id) {
        throw new Error("The authenticated account did not match the loaded profile.");
      }
      if (profile.role === "admin") {
        await apiFetch("/admin/session");
      }

      unauthorizedRef.current = false;
      setUser({ ...profile, email: session.user.email });
      return true;
    } catch (error) {
      console.error("Failed to validate the authenticated session:", error.message);
      setUser(null);
      if ([401, 403, 404].includes(error.status)) {
        try {
          const { error: signOutError } = await supabase.auth.signOut();
          if (signOutError) {
            console.error("Failed to sign out after session validation failed:", signOutError.message);
          }
        } catch (signOutError) {
          console.error("Failed to sign out after session validation failed:", signOutError.message);
        }
      }
      return false;
    }
  };

  useEffect(() => {
    let active = true;

    const initializeSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (recoveryCallbackRef.current && session) {
          setPasswordRecoveryReady(true);
        }
        if (isPasswordResetLocation()) {
          setUser(null);
          return;
        }
        if (!pendingChallengeRef.current) {
          await loadProfileForSession(session);
        }
      } catch (error) {
        console.error("Failed to initialize the authentication session:", error.message);
        setUser(null);
      } finally {
        if (active) setAuthLoading(false);
      }
    };

    initializeSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      queueMicrotask(() => {
        if (!active) return;
        if (event === "PASSWORD_RECOVERY") {
          recoveryCallbackRef.current = true;
          setPasswordRecoveryReady(true);
          setUser(null);
          return;
        }
        if (event === "SIGNED_OUT") {
          setUser(null);
          setCart([]);
          setPasswordRecoveryReady(false);
        }
        if (pendingChallengeRef.current) return;
        if (isPasswordResetLocation()) setUser(null);
        else loadProfileForSession(session);
      });
    });

    const handleUnauthorized = () => {
      if (unauthorizedRef.current) return;
      unauthorizedRef.current = true;
      setUser(null);
      setCart([]);
      supabase.auth.signOut().catch((error) => {
        console.error("Failed to clear an unauthorized session:", error.message);
      });
    };
    window.addEventListener("fitcheque:unauthorized", handleUnauthorized);

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      window.removeEventListener("fitcheque:unauthorized", handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    if (user) {
      apiFetch("/cart").then(setCart).catch(() => {});
    } else {
      setCart([]);
    }
  }, [user?.id]);

  // ── AUTH ──────────────────────────────────────────────────
  const reportActivity = async (action) => {
    try {
      await apiFetch("/activity/event", {
        method: "POST",
        body: JSON.stringify({ action }),
      });
    } catch (err) {
      console.warn(`Could not record ${action.toLowerCase()} activity: ${err.message}`);
    }
  };

  const requestPasswordReset = async (email) => {
    const redirectTo = `${window.location.origin}/?page=reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) throw new Error(error.message);
  };

  const completePasswordReset = async (newPassword) => {
    if (!passwordRecoveryReady) {
      throw new Error("Open the password reset link from your email before setting a new password.");
    }
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    if (!session) throw new Error("Your reset link is invalid or has expired. Request a new one.");

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw new Error(signOutError.message);
    setUser(null);
    setPasswordRecoveryReady(false);
  };

  // Step 1: password check + branch to the right second factor.
  // Returns one of:
  //   { status: "ok" }
  //   { status: "totp_required", factorId }
  //   { status: "totp_setup_required", factorId, qrCode, secret }
  //   { status: "email_otp_required", email }
  const login = async (email, password) => {
    pendingChallengeRef.current = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();
      if (profileErr || !profile) throw new Error("Could not load account role");

      if (profile.role === "admin") {
        const { data: aal, error: aalError } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalError) throw new Error(aalError.message);
        if (aal?.currentLevel !== "aal2") {
          const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
          if (factorsError) throw new Error(factorsError.message);
          const totp = factors?.totp?.find((factor) => factor.status === "verified");
          if (!totp) {
            for (const factor of factors?.totp || []) {
              const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
              if (unenrollError) throw new Error(unenrollError.message);
            }
            const { data: enrollment, error: enrollmentError } = await supabase.auth.mfa.enroll({
              factorType: "totp",
            });
            if (enrollmentError) throw new Error(enrollmentError.message);
            return {
              status: "totp_setup_required",
              factorId: enrollment.id,
              qrCode: enrollment.totp.qr_code,
              secret: enrollment.totp.secret,
            };
          }
          return { status: "totp_required", factorId: totp.id };
        }

        pendingChallengeRef.current = false;
        if (!await loadProfileForSession(data.session)) {
          throw new Error("Could not verify the admin session. Please sign in again.");
        }
        await reportActivity("LOGIN");
        return { status: "ok" };
      }

      await supabase.auth.signOut();
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (otpErr) throw new Error(otpErr.message);
      return { status: "email_otp_required", email };
    } catch (error) {
      pendingChallengeRef.current = false;
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error("Failed to clear the incomplete login session:", signOutError.message);
      }
      throw error;
    }
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

    const { data: { session } } = await supabase.auth.getSession();
    if (!await loadProfileForSession(session)) {
      pendingChallengeRef.current = false;
      throw new Error("Could not verify the admin session. Please sign in again.");
    }
    pendingChallengeRef.current = false;
    await reportActivity("LOGIN");
    toast(`Welcome back! 🌸`, "success");
  };

  const verifyEmailOtpChallenge = async (email, code) => {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (error) throw new Error(error.message);

    if (!await loadProfileForSession(data.session)) {
      pendingChallengeRef.current = false;
      throw new Error("Could not verify the authenticated session. Please sign in again.");
    }
    pendingChallengeRef.current = false;
    await reportActivity("LOGIN");
    toast(`Welcome back! 🌸`, "success");
  };

  const resendEmailOtpChallenge = async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) throw new Error(error.message);
  };

  const cancelChallenge = async () => {
    pendingChallengeRef.current = false;
    await supabase.auth.signOut();
    setUser(null);
  };

  const completeLogin = () => {}; // kept for compatibility, no-op now (handled in verify* above)

  const logout = async () => {
    if (user) await reportActivity("LOGOUT");
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
       if (error) {
      const m = error.message.toLowerCase();
      if (m.includes("already registered")) throw new Error("That email is already taken. Try signing in instead.");
      if (/database error/i.test(error.message)) throw new Error("That phone number or username is already used by another account");
      if (error.status === 429) throw new Error("Too many attempts. Please wait a minute and try again.");
      throw new Error(error.message);
    }
    // Confirm-email ON: an existing email comes back with no error and no identities
    if (data.user && data.user.identities?.length === 0)
      throw new Error("That email is already taken. Try signing in instead.");
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
    user, authLoading, cart, toasts, passwordRecoveryReady,
    login, logout, registerUser, completeLogin, completeRegister, updateProfile,
    requestPasswordReset, completePasswordReset,
    verifyTotpChallenge, verifyEmailOtpChallenge, resendEmailOtpChallenge, cancelChallenge,
    addToCart, removeFromCart, updateQty, clearCart,
    toast,
  };



  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>;
}