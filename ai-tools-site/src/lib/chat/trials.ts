import 'server-only';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { supabaseFetch } from '../supabase/transport';
import { createMemoryChatQuotaStore } from './memory';

const developmentStore = createMemoryChatQuotaStore();
const developmentSecret = randomUUID() + randomUUID();

export type ChatReservation =
  | { reason?: undefined; settle: (success: boolean) => Promise<void> }
  | { reason: 'busy' | 'exhausted' | 'unavailable' | 'rate_limited'; settle?: undefined };

export function createChatTrialStore() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const memory = process.env.NODE_ENV === 'development' && process.env.CHAT_QUOTA_STORE === 'memory';
  const secret = process.env.CHAT_COOKIE_SECRET || process.env.DRAWING_COOKIE_SECRET || (memory ? developmentSecret : undefined);
  if (!secret || secret.length < 32) throw new Error('Chat trials are not configured');

  const sign = (id: string) => createHmac('sha256', secret).update(id).digest('hex');
  const visitor = (token?: string) => {
    const parts = token?.split('.') ?? [];
    if (parts.length === 2 && /^[a-f0-9-]{36}$/.test(parts[0])
      && /^[a-f0-9]{64}$/.test(parts[1])
      && timingSafeEqual(Buffer.from(parts[1]), Buffer.from(sign(parts[0])))) {
      return { id: parts[0], token: token! };
    }
    const id = randomUUID();
    return { id, token: `${id}.${sign(id)}` };
  };
  const network = (address: string) => createHmac('sha256', secret).update(`network:${address}`).digest('hex');
  if (memory) return { ...developmentStore, visitor, network };
  if (!base || !key) throw new Error('Chat trials are not configured');
  if (new URL(base).protocol !== 'https:') throw new Error('Chat trials require HTTPS Supabase');
  const rpc = async (name: 'chat_daily_status' | 'chat_daily_reserve' | 'chat_daily_settle', args: Record<string, unknown>) => {
    const response = await supabaseFetch(new URL(`/rest/v1/rpc/${name}`, base), {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('Chat trial service unavailable');
    return response.json();
  };
  return {
    visitor,
    network,
    status: async (identity: string) => rpc('chat_daily_status', { p_identity: identity }) as Promise<{ remaining: number; busy: boolean; limit: number; resetsAt: string }>,
    reserve: async (identity: string, network: string): Promise<ChatReservation> => {
      try {
        const result = await rpc('chat_daily_reserve', { p_identity: identity, p_network: network }) as { reason?: string; reservation?: string };
        if (result?.reason && ['busy', 'exhausted', 'unavailable', 'rate_limited'].includes(result.reason)) {
          return { reason: result.reason as 'busy' | 'exhausted' | 'unavailable' | 'rate_limited' };
        }
        if (!result || result.reason || !/^[a-f0-9-]{36}$/.test(result.reservation ?? '')) return { reason: 'unavailable' };
        let settlement: Promise<void> | undefined;
        return { settle: async (success: boolean) => {
          settlement ??= rpc('chat_daily_settle', { p_reservation: result.reservation, p_success: success }).then(() => {});
          await settlement;
        } };
      } catch {
        return { reason: 'unavailable' };
      }
    },
  };
}
