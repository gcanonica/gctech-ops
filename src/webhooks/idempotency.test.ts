import assert from 'node:assert/strict';
import test from 'node:test';
import { buildIdempotencyKey } from './idempotency';

test('gera a mesma chave para a mesma entrega', () => {
  assert.equal(buildIdempotencyKey({ id: 1 }), buildIdempotencyKey({ id: 1 }));
});

test('prioriza o identificador fornecido pelo provedor', () => {
  assert.equal(buildIdempotencyKey({ id: 1 }, 'event-123'), buildIdempotencyKey({ id: 2 }, 'event-123'));
});
