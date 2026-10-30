import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export type CreditStatus = { signedIn: boolean; freeRemaining: number; paidRemaining: number; busy: boolean };
export type CreditReservation = { reason?: undefined; settle: (success: boolean) => Promise<void> }
  | { reason: 'login' | 'payment' | 'busy' | 'unavailable'; settle?: undefined };
type Rpc = (name: string, args: Record<string, unknown>) => Promise<unknown>;

export function createVisitorIdentity(secret: string) {
  if (secret.length < 32) throw new Error('Drawing cookie secret must contain at least 32 characters');
  const sign = (id: string) => createHmac('sha256', secret).update(id).digest('hex');
  return (token?: string) => {
    const parts = token?.split('.') ?? [];
    if (parts.length === 2 && /^[a-f0-9-]{36}$/.test(parts[0]) && /^[a-f0-9]{64}$/.test(parts[1])
      && timingSafeEqual(Buffer.from(parts[1]), Buffer.from(sign(parts[0])))) return { id: parts[0], token: token! };
    const id = randomUUID();
    return { id, token: `${id}.${sign(id)}` };
  };
}

export function createCreditStore(rpc: Rpc) {
  return {
    async status(visitor: string, user: string | null): Promise<CreditStatus> {
      const result = await rpc('drawing_status', { p_visitor: visitor, p_user: user }) as CreditStatus;
      if (!result || typeof result.signedIn !== 'boolean' || typeof result.busy !== 'boolean'
        || !Number.isInteger(result.freeRemaining) || result.freeRemaining < 0 || result.freeRemaining > 2
        || !Number.isInteger(result.paidRemaining) || result.paidRemaining < 0) throw new Error('Invalid credit status');
      return result;
    },
    async acquire(visitor: string, user: string | null): Promise<CreditReservation> {
      try {
        const result = await rpc('drawing_reserve', { p_visitor: visitor, p_user: user }) as { reason?: string; reservation?: string };
        if (result?.reason && ['login', 'payment', 'busy', 'unavailable'].includes(result.reason)) {
          return { reason: result.reason as 'login' | 'payment' | 'busy' | 'unavailable' };
        }
        if (!result || result.reason || !/^[a-f0-9-]{36}$/.test(result.reservation ?? '')) return { reason: 'unavailable' };
        let settled = false;
        return { settle: async success => {
          if (settled) return;
          // RPC settlement is idempotent as well, including retries after a network failure.
          await rpc('drawing_settle', { p_reservation: result.reservation, p_success: success });
          settled = true;
        } };
      } catch { return { reason: 'unavailable' }; }
    },
  };
}
