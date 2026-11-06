import { Suspense, useState } from "react";
import "./App.css";
import "./UIConsistency.css";
 
import { AppProvider } from "./context/AppContext";
import { Main } from "./components/Main";
import { ConfirmHost } from "./components/ConfirmDialog";
import { AdminRoute } from "./components/AdminRoute";
import { lazyWithRecovery } from "./utils/lazyWithRecovery.mjs";
 
import Home from "./pages/Home";
const Products = lazyWithRecovery(() => import("./pages/Products"));
const Cart = lazyWithRecovery(() => import("./pages/Cart"));
const About = lazyWithRecovery(() => import("./pages/About"));
const SignIn = lazyWithRecovery(() => import("./pages/SignIn"));
const Register = lazyWithRecovery(() => import("./pages/Register"));
const Profile = lazyWithRecovery(() => import("./pages/Profile"));
const Checkout = lazyWithRecovery(() => import("./pages/Checkout"));
const ResetPassword = lazyWithRecovery(() => import("./pages/ResetPassword"));

const AdminHome = lazyWithRecovery(() => import("./pages/admin/AdminHome"));
 
export default function App() {
  const [page, setPage] = useState(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const recoveryCallback = hash.get("type") === "recovery" ||
      hash.get("error_code") === "otp_expired" ||
      query.get("error_code") === "otp_expired";
    return query.get("page") === "reset-password" || recoveryCallback
      ? "reset-password"
      : "home";
  });
 
  return (
    <AppProvider onRequireLogin={() => setPage("login")}>
      <>
        <Main page={page} setPage={setPage}>
          <Suspense fallback={<div role="status" style={{ padding: 48, textAlign: "center", color: "#be185d" }}>Loading page...</div>}>
            {page === "home"     && <Home     setPage={setPage} />}
            {page === "products" && <Products setPage={setPage} />}
            {page === "cart"     && <Cart     setPage={setPage} />}
            {page === "about"    && <About    setPage={setPage} />}
            {page === "login"    && <SignIn   setPage={setPage} />}
            {page === "reset-password" && <ResetPassword setPage={setPage} />}
            {page === "signup"   && <Register setPage={setPage} />}
            {page === "profile"  && <Profile  setPage={setPage} />}
            {page === "checkout" && <Checkout setPage={setPage} />}
            {page === "admin"    && (
              <AdminRoute setPage={setPage}>
                <Suspense fallback={<div role="status" style={{ padding: 48, textAlign: "center", color: "#be185d" }}>Loading admin dashboard...</div>}>
                  <AdminHome setPage={setPage} />
                </Suspense>
              </AdminRoute>
            )}
          </Suspense>
        </Main>
        <ConfirmHost />
      </>
    </AppProvider>
  );
}
 