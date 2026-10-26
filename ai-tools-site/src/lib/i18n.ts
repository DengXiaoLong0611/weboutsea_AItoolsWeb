export const localeCookie = "site_locale";
export type SiteLocale = "en" | "zh";

export function isLocale(value: unknown): value is SiteLocale {
  return value === "en" || value === "zh";
}

export function chooseLocale(saved?: string, acceptLanguage?: string | null): SiteLocale {
  if (isLocale(saved)) return saved;
  const languages = (acceptLanguage ?? "").split(",").map((entry, index) => {
    const [tag, ...parameters] = entry.trim().toLowerCase().split(";");
    const quality = parameters.find(value => value.trim().startsWith("q="));
    const weight = quality === undefined ? 1 : Number(quality.trim().slice(2));
    return { tag, weight, index };
  }).filter(item => item.tag && Number.isFinite(item.weight) && item.weight > 0 && item.weight <= 1)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  // The visitor's primary language determines the default; unknown languages use English.
  return /^zh(?:-|$)/.test(languages[0]?.tag ?? "") ? "zh" : "en";
}
