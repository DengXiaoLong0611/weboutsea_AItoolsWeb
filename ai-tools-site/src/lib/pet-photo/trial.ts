import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type Ledger = { day: string; total: number; visitors: Record<string, { count: number; busyUntil: number }> };
export type TrialResult = { reason?: undefined; release: () => Promise<void> } | { reason: 'busy' | 'exhausted' | 'unavailable'; release?: undefined };

// Persist this directory on a single server. Multi-instance hosting needs a shared DB.
export function createTrialStore(directory: string, dailyLimit = 20) {
  async function secret() {
    await mkdir(directory, { recursive: true });
    const path = join(directory, 'secret');
    try { await writeFile(path, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
    for (let i = 0; i < 20; i++) {
      const value = await readFile(path, 'utf8');
      if (/^[a-f0-9]{64}$/.test(value)) return value;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error('trial secret unavailable');
  }
  async function visitor(token?: string) {
    const key = await secret();
    const sign = (id: string) => createHmac('sha256', key).update(id).digest('hex');
    const parts = token?.split('.') ?? [];
    if (/^[a-f0-9-]{36}$/.test(parts[0] ?? '') && /^[a-f0-9]{64}$/.test(parts[1] ?? '') && timingSafeEqual(Buffer.from(parts[1]), Buffer.from(sign(parts[0])))) return { id: parts[0], token: token! };
    const id = randomUUID();
    return { id, token: `${id}.${sign(id)}` };
  }
  async function update<T>(change: (ledger: Ledger) => T): Promise<T> {
    await mkdir(directory, { recursive: true });
    const lockPath = join(directory, 'ledger.lock');
    let lock;
    for (let i = 0; i < 20; i++) {
      try { lock = await open(lockPath, 'wx'); break; }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; await new Promise(resolve => setTimeout(resolve, 25)); }
    }
    if (!lock) throw new Error('trial store busy');
    const path = join(directory, 'ledger.json');
    const temporary = join(directory, `${randomUUID()}.tmp`);
    try {
      let data: Ledger;
      try { data = JSON.parse(await readFile(path, 'utf8')); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; data = { day: '', total: 0, visitors: {} }; }
      const today = new Date().toISOString().slice(0, 10);
      if (data.day !== today) { data.day = today; data.total = 0; }
      const result = change(data);
      await writeFile(temporary, JSON.stringify(data), { mode: 0o600 });
      await rename(temporary, path);
      return result;
    } finally { await lock.close(); await unlink(lockPath); await unlink(temporary).catch(() => {}); }
  }
  async function acquire(id: string): Promise<TrialResult> {
    if (!/^[a-f0-9-]{36}$/.test(id)) return { reason: 'unavailable' };
    try {
      const reason = await update(data => {
        const record = data.visitors[id] ?? { count: 0, busyUntil: 0 };
        if (record.busyUntil > Date.now()) return 'busy' as const;
        if (record.count >= 2) return 'exhausted' as const;
        if (data.total >= dailyLimit || Object.keys(data.visitors).length >= 10000) return 'unavailable' as const;
        record.count++;
        record.busyUntil = Date.now() + 300_000;
        data.visitors[id] = record;
        data.total++;
        return undefined;
      });
      if (reason) return { reason };
      return { release: async () => { await update(data => { if (data.visitors[id]) data.visitors[id].busyUntil = 0; }).catch(() => {}); } };
    } catch { return { reason: 'unavailable' }; }
  }
  return { visitor, acquire };
}
