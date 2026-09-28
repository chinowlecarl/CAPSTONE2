import { supabase } from "./supabase";

const API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`;

export async function apiFetch(path, options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event("fitcheque:unauthorized"));
    }
    throw new Error(data.error || "Something went wrong");
  }
  return data;
}

export const fmt = (n) => `₱${Number(n).toFixed(2)}`;
export const salePrice = (price, discount) =>
  discount > 0 ? price * (1 - discount / 100) : price;
