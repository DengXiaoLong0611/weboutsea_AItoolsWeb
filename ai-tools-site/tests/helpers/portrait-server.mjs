import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
import sharp from 'sharp';
import * as catalog from '../../src/lib/pet-portrait/catalog.ts';

export class ProviderRejected extends Error {}
export function loadPortraitServer(db, overrides = {}) {
  const source = ts.transpileModule(readFileSync(new URL('../../src/lib/pet-portrait/server.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    PET_PORTRAIT_COOKIE_SECRET: 'a'.repeat(40), PET_PORTRAIT_ENABLED: 'true',
    STRIPE_PORTRAIT_WEBHOOK_SECRET: 'webhook-test-secret',
  };
  const ctx = { exports: {}, Buffer, File, Blob, FormData, URL, AbortSignal, Date, process: { env },
    fetch: overrides.fetch || (() => { throw new Error('Unexpected network access'); }),
    require(name) {
      if (name === 'server-only') return {};
      if (name === '@supabase/supabase-js') return { createClient: () => db };
      if (name === 'sharp') return sharp;
      if (name === 'node:crypto') return crypto;
      if (name === '../pet-photo/bailian') return {
        BailianRejectedError: ProviderRejected,
        getBailianConfig: () => ({ model: 'test-model' }),
        editPetPhoto: overrides.generate || (() => { throw new Error('Unexpected paid call'); }),
      };
      if (name === '../pet-photo/credits') return { createVisitorIdentity: () => () => ({ id: '11111111-1111-4111-8111-111111111111', token: 'test-token' }) };
      if (name === '../supabase/transport') return { supabaseFetch: () => {} };
      if (name === './catalog') return catalog;
      if (overrides.modules?.[name]) return overrides.modules[name];
      throw new Error('Unexpected import: ' + name);
    },
  };
  vm.runInNewContext(source + '\nexports.verifyCheckoutForTest = verifyCheckout;', ctx);
  return ctx.exports;
}
export function rowsQuery(rows, onUpdate = () => {}) {
  const q = { data: rows, error: null, select() { return this; }, eq() { return this; }, in() { return this; },
    update(value) { onUpdate(value); return this; }, upsert() { return this; }, insert() { return this; }, delete() { return this; },
    order() { return this; }, limit() { return this; }, lt() { return this; },
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    single: async () => ({ data: rows[0] ?? null, error: null }),
    then(resolve, reject) { return Promise.resolve({ data: rows, error: null }).then(resolve, reject); },
  };
  return q;
}
