import fs from 'node:fs';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  OPS_PORT: z.coerce.number().int().min(1).max(65535).default(3100),
  OPS_WEBHOOK_TOKEN: z.string().trim().min(32).optional(),
  OPS_OUTBOX_TOKEN: z.string().trim().min(32).optional(),
  GCTECH_FIREBASE_CONFIG_PATH: z.string().trim().min(1),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().trim().min(1).optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().trim().min(2).optional(),
  APP_VERSION: z.string().trim().default('development'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
});

export type OpsEnv = z.infer<typeof schema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): OpsEnv {
  const result = schema.safeParse(source);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.') || 'environment').join(', ');
    throw new Error(`Configuracao de ambiente invalida: ${fields}`);
  }

  const env = result.data;
  if (env.NODE_ENV === 'production' && !env.OPS_WEBHOOK_TOKEN) {
    throw new Error('OPS_WEBHOOK_TOKEN com pelo menos 32 caracteres e obrigatorio em producao.');
  }
  if (env.NODE_ENV === 'production' && !env.OPS_OUTBOX_TOKEN) {
    throw new Error('OPS_OUTBOX_TOKEN com pelo menos 32 caracteres e obrigatorio em producao.');
  }
  if (!fs.existsSync(env.GCTECH_FIREBASE_CONFIG_PATH)) {
    throw new Error('GCTECH_FIREBASE_CONFIG_PATH nao aponta para um arquivo existente.');
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS && !fs.existsSync(env.GOOGLE_APPLICATION_CREDENTIALS)) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS nao aponta para um arquivo existente.');
  }
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try { JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON); } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON nao contem JSON valido.');
    }
  }
  return env;
}
