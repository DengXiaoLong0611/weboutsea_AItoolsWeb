import type { ChatTrialReservation } from './server.ts';

// Explicit local development mode only; this is never a production quota store.
export function createMemoryChatQuotaStore(clock = Date.now) {
  type Bucket = { used: number; pending?: { expires: number; settled: boolean } };
  const buckets = new Map<string, Bucket>();
  const networks = new Map<string, { minute: number; count: number }>();
  const bucket = (identity: string) => {
    const now = clock();
    const day = new Date(now).toISOString().slice(0, 10);
    const key = `${identity}:${day}`;
    let entry = buckets.get(key);
    if (!entry) { entry = { used: 0 }; buckets.set(key, entry); }
    if (entry.pending && entry.pending.expires <= now) {
      entry.pending.settled = true;
      entry.used--;
      entry.pending = undefined;
    }
    return { entry, resetsAt: new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString() };
  };
  return {
    status: async (identity: string) => {
      const { entry, resetsAt } = bucket(identity);
      return { remaining: 20 - entry.used, busy: !!entry.pending, limit: 20, resetsAt };
    },
    reserve: async (identity: string, network: string): Promise<ChatTrialReservation> => {
      const { entry } = bucket(identity);
      if (entry.pending) return { reason: 'busy' };
      if (entry.used >= 20) return { reason: 'exhausted' };
      const minute = Math.floor(clock() / 60000);
      const previous = networks.get(network);
      const counter = previous?.minute === minute ? previous : { minute, count: 0 };
      networks.set(network, counter);
      if (++counter.count > 15) return { reason: 'rate_limited' };
      entry.used++;
      const reservation = { expires: clock() + 180000, settled: false };
      entry.pending = reservation;
      return { settle: async (success: boolean) => {
        if (reservation.settled) return;
        reservation.settled = true;
        if (!success) entry.used--;
        if (entry.pending === reservation) entry.pending = undefined;
      } };
    },
  };
}
