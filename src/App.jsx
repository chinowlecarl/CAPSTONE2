import { useState } from "react";
import "./App.css";
 
import { AppProvider } from "./context/AppContext";
import { Main } from "./components/Main";
 
import Home from "./pages/Home";
import Products from "./pages/Products";
import Cart from "./pages/Cart";
import About from "./pages/About";
import SignIn from "./pages/SignIn";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import Checkout from "./pages/Checkout";
import AdminHome from "./pages/admin/AdminHome";
 
export default function App() {
  const [page, setPage] = useState("home");
 
  return (
    <AppProvider>
      <Main page={page} setPage={setPage}>
        {page === "home"     && <Home     setPage={setPage} />}
        {page === "products" && <Products setPage={setPage} />}
        {page === "cart"     && <Cart     setPage={setPage} />}
        {page === "about"    && <About    setPage={setPage} />}
        {page === "login"    && <SignIn   setPage={setPage} />}
        {page === "signup"   && <Register setPage={setPage} />}
        {page === "profile"  && <Profile  setPage={setPage} />}
        {page === "checkout" && <Checkout setPage={setPage} />}
        {page === "admin"    && <AdminHome setPage={setPage} />}
      </Main>
    </AppProvider>
  );
}
 