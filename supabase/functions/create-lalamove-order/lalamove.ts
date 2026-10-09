// Pure helpers for the Lalamove Edge Function (no Deno-only APIs, so they can be unit tested).

const encoder = new TextEncoder();

export async function hmacSha256Hex(
  secret: string,
  message: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Lalamove v3: HMAC-SHA256 over  `${timestampMs}\r\n${METHOD}\r\n${path}\r\n\r\n${body}`  (lowercase hex)
// The body string signed MUST be the exact string sent. GET requests sign an empty body.
export async function signRequest(
  secret: string,
  timeMs: string,
  method: string,
  path: string,
  body: string,
): Promise<string> {
  const raw = `${timeMs}\r\n${method}\r\n${path}\r\n\r\n${body}`;
  return await hmacSha256Hex(secret, raw);
}

// Philippine mobile -> E.164 (+639XXXXXXXXX). Throws if it can't be made valid.
export function normalizePhPhone(input: string): string {
  const cleaned = (input ?? "").replace(/[^\d+]/g, "");
  let digits = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  if (digits.startsWith("0") && digits.length === 11)
    digits = "63" + digits.slice(1);
  if (digits.startsWith("9") && digits.length === 10) digits = "63" + digits;
  if (/^639\d{9}$/.test(digits)) return "+" + digits;
  throw new Error(`Invalid Philippine mobile number: "${input}"`);
}

// Checkout stores: "<street, >City ZIP — Phone: 09XXXXXXXXX". Split it back apart.
export function parseShippingAddress(raw: string): {
  address: string;
  phone: string | null;
} {
  const text = (raw ?? "").trim();
  const m = text.match(/^(.*?)\s*[—–-]\s*Phone:\s*([+\d][\d\s-]*)\s*$/i);
  if (m) return { address: m[1].trim(), phone: m[2].trim() };
  return { address: text, phone: null };
}

// Progressively simpler versions of an address to try when geocoding.
export function addressVariants(address: string): string[] {
  const parts = address
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) out.push(parts.slice(i).join(", "));
  const noZip = address
    .replace(/\b\d{4}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (noZip && !out.includes(noZip)) out.push(noZip);
  return Array.from(new Set(out.filter(Boolean)));
}

// Read claims from a JWT. Only call this AFTER the token was verified (auth.getUser).
export function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = token.split(".")[1];
  if (!part) return {};
  const b64 = part
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(part.length / 4) * 4, "=");
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return {};
  }
}
