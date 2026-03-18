const API = "http://localhost:5000/api";

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("fitcheque_token");
  const res = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

export const fmt = (n) => `₱${Number(n).toFixed(2)}`;
export const salePrice = (price, discount) =>
  discount > 0 ? price * (1 - discount / 100) : price;
