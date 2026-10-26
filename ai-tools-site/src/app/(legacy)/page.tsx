import { redirect } from "next/navigation";

// The proxy negotiates language and preserves the query before this fallback is reached.
export default function Page() {
  redirect("/en");
}
