import { ProxyAgent, fetch as proxyFetch } from 'undici';

let agent: ProxyAgent | undefined;
// Optional server-side proxy, for local networks that cannot reach Supabase directly.
export const supabaseFetch: typeof fetch = (input, init) => {
  const proxy = process.env.SUPABASE_PROXY_URL?.trim();
  if (!proxy) return fetch(input, init);
  agent ??= new ProxyAgent(proxy);
  return (proxyFetch as unknown as typeof fetch)(input, { ...init, dispatcher: agent } as RequestInit);
};
