import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectIntent } from './intentDetection';

describe('detectIntent', () => {
  it('answers FAQ without starting a service flow', () => {
    const result = detectIntent('qual horario de atendimento?');

    assert.equal(result.intent, 'business_hours');
    assert.equal(result.shouldStartServiceFlow, false);
  });

  it('continues collection when pricing includes a service signal', () => {
    const result = detectIntent('quanto custa trocar bateria de iphone?');

    assert.equal(result.intent, 'pricing');
    assert.equal(result.shouldStartServiceFlow, true);
  });

  it('routes complaints to human review', () => {
    const result = detectIntent('quero fazer uma reclamacao do atendimento');

    assert.equal(result.intent, 'complaint');
    assert.equal(result.shouldContinueActiveFlow, false);
  });
});
