import { useEffect } from "react";
import { useApp } from "../context/AppContext";

export function AdminRoute({ setPage, children }) {
  const { user, authLoading } = useApp();

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) setPage("login");
  }, [authLoading, user, setPage]);

  if (authLoading || !user || user.role !== "admin") return null;

  return children;
}
