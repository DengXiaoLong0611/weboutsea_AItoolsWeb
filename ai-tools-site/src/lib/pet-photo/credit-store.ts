import 'server-only';
import { createCreditStore, createVisitorIdentity } from './credits';
import { supabaseFetch } from '../supabase/transport';

export function drawingCredits() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.DRAWING_COOKIE_SECRET;
  if (!base || !key || !secret || new URL(base).protocol !== 'https:') throw new Error('Drawing credits are not configured');
  return {
    visitor: createVisitorIdentity(secret),
    ...createCreditStore(async (name, args) => {
      const response = await supabaseFetch(new URL(`/rest/v1/rpc/${name}`, base), {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(args), cache: 'no-store', signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error('Credit service unavailable');
      return response.json();
    }),
  };
}
