export function confirmationDestination(type: string | null): string | null {
  return type === "signup" ? "/account" : type === "recovery" ? "/auth/update-password" : null;
}
export function validSiteUrl(value: string | undefined): string | null {
  try {
    const url = new URL(value ?? "");
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
    return url.origin;
  } catch { return null; }
}
