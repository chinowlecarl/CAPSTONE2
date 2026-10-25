// routes/account.cjs
//
//   POST /api/account/change-password        { currentPassword, newPassword }       (logged in)
//   GET  /api/auth/username-available?username=...                                  (public, rate limited)
//
// How it works
//  1. The current password is checked with a THROWAWAY Supabase client, so the
//     user's real browser session (and an admin's two-factor level) is untouched.
//  2. The new password is set with the admin API (service role key).
//  3. All OTHER devices are signed out. The current device stays signed in.
//
// Safety: max 8 failed attempts per user per 15 minutes (stops someone with a stolen
// session from guessing the current password), and the server never logs or
// returns either password. Wrong attempts are written to the activity log.

const rateLimit = require("express-rate-limit");
const { createClient } = require("@supabase/supabase-js");

module.exports = function registerAccount(app, { supabase, auth, supabaseUrl, verifyKey, log, authAdmin, createVerifier }) {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    skipSuccessfulRequests: true, // only failed attempts count against the limit
    keyGenerator: (req) => req.user?.id || req.ip,
    message: { error: "Too many password attempts. Please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Same rules as the Register page
  function passwordProblem(pw) {
    if (typeof pw !== "string" || !pw) return "New password is required";
    if (Buffer.byteLength(pw, "utf8") > 72) return "Password is too long (72 characters max)";
    if (pw.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(pw)) return "Password needs at least one uppercase letter";
    if (!/[0-9]/.test(pw)) return "Password needs at least one number";
    return null;
  }

  const makeVerifier =
    createVerifier ||
    (() => createClient(supabaseUrl, verifyKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }));
  const admin = () => authAdmin || supabase.auth.admin;

  app.post("/api/account/change-password", auth, limiter, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};

    if (typeof currentPassword !== "string" || !currentPassword)
      return res.status(400).json({ error: "Enter your current password" });
    const problem = passwordProblem(newPassword);
    if (problem) return res.status(400).json({ error: problem });
    if (newPassword === currentPassword)
      return res.status(400).json({ error: "Your new password must be different from the current one" });

    try {
      // 1. verify the current password (does not touch the real session)
      const { error: verifyErr } = await makeVerifier().auth.signInWithPassword({ email: req.user.email, password: currentPassword });
      if (verifyErr) {
        if (log) {
          await log.write({
            ...log.actorFields(req),
            action: "PASSWORD_CHANGE_FAILED",
            entity_type: "user",
            entity_id: req.user.id,
            summary: "Tried to change their password but the current password was wrong",
          });
        }
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // 2. set the new password
      const { error: updateErr } = await admin().updateUserById(req.user.id, { password: newPassword });
      if (updateErr) {
        const weak = updateErr.status === 422 || /password/i.test(updateErr.message || "");
        return res.status(weak ? 400 : 500).json({ error: weak ? updateErr.message : "Failed to change password" });
      }

      // 3. sign out every other device (best effort)
      let otherSessionsSignedOut = false;
      try {
        const token = (req.headers.authorization || "").split(" ")[1];
        const { error: outErr } = await admin().signOut(token, "others");
        otherSessionsSignedOut = !outErr;
      } catch (_) { /* the password is already changed; this part is optional */ }

      res.json({ message: "Password changed!", otherSessionsSignedOut });
    } catch (err) {
      console.error(`[CHANGE PASSWORD ERROR] ${err.message}`);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // ── username availability (used by the Sign Up form) ──────────────────────
  // Case-insensitive: "Chris" and "chris" are the same name. The database also has a unique
  // index (profiles_username_lower_idx), so even if two people sign up at the exact same
  // moment only one can win. This check just gives a clear message BEFORE they submit.
  const USERNAME_RE = /^[A-Za-z0-9_.]{3,20}$/;
  const usernameLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: "Too many username checks. Please wait a moment." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.get("/api/auth/username-available", usernameLimiter, async (req, res) => {
    const username = String(req.query.username || "").trim();
    if (!USERNAME_RE.test(username))
      return res.status(400).json({ available: false, error: "Username must be 3-20 characters: letters, numbers, _ or ." });
    try {
      const { data, error } = await supabase.rpc("username_exists", { p_username: username });
      if (error) throw error;
      if (data) return res.json({ available: false, error: "That username is already taken" });
      res.json({ available: true });
    } catch (err) {
      console.error(`[USERNAME CHECK ERROR] ${err.message}`);
      res.status(500).json({ error: "Could not check the username right now" });
    }
  });
};
