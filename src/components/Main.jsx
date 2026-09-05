import { Header } from "./Header";
import { Footer } from "./Footer";
import { Toast } from "./Toast";
import { useApp } from "../context/AppContext";
 
export function Main({ page, setPage, children }) {
  const { toasts } = useApp();
  const noNav    = ["login", "signup"].includes(page);
  const noFooter = ["login", "signup", "admin", "checkout"].includes(page);
 
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Toast toasts={toasts} />
      {!noNav && <Header page={page} setPage={setPage} />}
      <main style={{ flex: 1 }}>{children}</main>
      {!noFooter && <Footer setPage={setPage} />}
    </div>
  );
}
 