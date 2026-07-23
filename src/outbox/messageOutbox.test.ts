import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOutboxId, claimMessagesSchema, failedMessageSchema } from './messageOutbox';

test('outbox id e deterministico por mensagem', () => {
  assert.equal(buildOutboxId('evt', '5541999', 'Ola'), buildOutboxId('evt', '5541999', 'Ola'));
  assert.notEqual(buildOutboxId('evt', '5541999', 'Ola'), buildOutboxId('evt', '5541999', 'Tchau'));
});

test('claim limita lote e exige worker identificavel', () => {
  assert.equal(claimMessagesSchema.parse({ workerId: 'n8n-01' }).limit, 10);
  assert.throws(() => claimMessagesSchema.parse({ workerId: 'n8n-01', limit: 100 }));
  assert.throws(() => claimMessagesSchema.parse({ workerId: 'x' }));
});

test('falha limita detalhes para nao armazenar payload irrestrito', () => {
  assert.throws(() => failedMessageSchema.parse({ workerId: 'n8n-01', errorMessage: 'x'.repeat(501) }));
});
