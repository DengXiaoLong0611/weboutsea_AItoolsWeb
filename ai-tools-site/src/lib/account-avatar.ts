export function accountInitial(email?: string) {
  return Array.from(email?.trim() || "?")[0].toUpperCase();
}
