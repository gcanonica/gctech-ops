import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parseEnv } from './env';

test('exige token forte em producao', () => {
  const config = path.join(os.tmpdir(), `ops-config-${process.pid}.json`);
  fs.writeFileSync(config, '{}');
  assert.throws(() => parseEnv({ NODE_ENV: 'production', GCTECH_FIREBASE_CONFIG_PATH: config }), /OPS_WEBHOOK_TOKEN/);
  fs.unlinkSync(config);
});

test('aceita ambiente de producao completo', () => {
  const config = path.join(os.tmpdir(), `ops-config-${process.pid}.json`);
  fs.writeFileSync(config, '{}');
  const env = parseEnv({ NODE_ENV: 'production', OPS_WEBHOOK_TOKEN: 'x'.repeat(32), OPS_OUTBOX_TOKEN: 'y'.repeat(32), GCTECH_FIREBASE_CONFIG_PATH: config });
  assert.equal(env.OPS_PORT, 3100);
  fs.unlinkSync(config);
});
