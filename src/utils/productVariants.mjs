export const VARIANT_ATTRIBUTES = [
  { key: "size", label: "Size" },
  { key: "color", label: "Color" },
  { key: "style", label: "Style" },
];

export function normalizeVariantOptions(variants = {}) {
  if (!variants || typeof variants !== "object" || Array.isArray(variants)) return {};

  return Object.fromEntries(VARIANT_ATTRIBUTES.flatMap(({ key }) => {
    const rawOptions = variants[key];
    const options = (Array.isArray(rawOptions)
      ? rawOptions
      : typeof rawOptions === "string" ? rawOptions.split(",") : [])
      .filter((option) => typeof option === "string")
      .map((option) => option.trim())
      .filter(Boolean);
    const uniqueOptions = [...new Set(options)];
    return uniqueOptions.length ? [[key, uniqueOptions]] : [];
  }));
}

export function normalizeVariantSelection(variants, selection = {}) {
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) return null;

  const options = normalizeVariantOptions(variants);
  const selectedKeys = Object.keys(selection);
  if (selectedKeys.some((key) => !Object.hasOwn(options, key))) return null;

  const normalized = {};
  for (const [key, values] of Object.entries(options)) {
    if (!values.includes(selection[key])) return null;
    normalized[key] = selection[key];
  }
  return normalized;
}

export function formatVariantSelection(selection) {
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) return "";
  return VARIANT_ATTRIBUTES
    .filter(({ key }) => typeof selection[key] === "string" && selection[key].trim())
    .map(({ key, label }) => `${label}: ${selection[key]}`)
    .join(" · ");
}
