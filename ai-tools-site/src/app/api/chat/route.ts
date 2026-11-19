import { handleChatRequest, createLimiter } from "@/lib/chat/server";
import { createChatTrialStore } from "@/lib/chat/trials";
import { supabaseServer } from "@/lib/supabase/server";
import { isIP } from "node:net";

export const maxDuration = 120;
const limiter = createLimiter();
const cookieName = "chat_visitor";

function readVisitorToken(request: Request) {
  return request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
}
function setVisitor(response: Response, value: string, request: Request) {
  response.headers.set("Set-Cookie", `${cookieName}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`);
  return response;
}
async function getUser() {
  const supabase = await supabaseServer();
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") throw new Error("Authentication unavailable");
  return user?.id ?? null;
}

function networkAddress(request: Request) {
  // On Vercel this header is overwritten by the platform, unlike arbitrary client headers.
  const header = process.env.VERCEL === "1" ? "x-vercel-forwarded-for" : "x-forwarded-for";
  const address = request.headers.get(header)?.split(",")[0]?.trim();
  return address && isIP(address) ? address : "unknown";
}

export async function GET(request: Request) {
  try {
    const trials = createChatTrialStore();
    const visitor = trials.visitor(readVisitorToken(request));
    const user = await getUser();
    const status = await trials.status(user ? `user:${user}` : `guest:${visitor.id}`);
    return setVisitor(Response.json({ signedIn: !!user, ...status }, { headers: { "Cache-Control": "private, no-store" } }), visitor.token, request);
  } catch {
    return Response.json({ error: "trial_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  let trials: ReturnType<typeof createChatTrialStore> | undefined;
  let visitor: { id: string; token: string } | undefined;
  try {
    trials = createChatTrialStore();
    visitor = trials.visitor(readVisitorToken(request));
  } catch {
    // Fail closed: signed-in users must not bypass quota during storage outages.
  }
  const trialStore = trials;
  const response = await handleChatRequest(request, {
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL,
    siteOrigin: process.env.NEXT_PUBLIC_SITE_URL,
    trial: async identity => trialStore
      ? trialStore.reserve(identity, trialStore.network(networkAddress(request)))
      : { reason: "unavailable" as const },
    getVisitor: () => visitor!.id,
    limiter,
    getUser,
  });
  return visitor ? setVisitor(response, visitor.token, request) : response;
}
