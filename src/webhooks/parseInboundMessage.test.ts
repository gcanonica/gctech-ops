import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseInboundMessage } from './parseInboundMessage';

describe('parseInboundMessage', () => {
  it('extracts natural WhatsApp appointment fields', () => {
    const parsed = parseInboundMessage({
      phone: '41 98888-0000',
      message: 'Meu nome e Paula, meu notebook nao liga, quero visita tecnica em Rio Branco do Sul amanha de manha na Rua XV numero 120 bairro Centro complemento apartamento 3',
      timestamp: '2026-07-14T12:00:00.000Z',
    });

    assert.equal(parsed.phone, '41988880000');
    assert.equal(parsed.fields.customerName, 'Paula');
    assert.equal(parsed.fields.deviceType, 'notebook');
    assert.equal(parsed.fields.deviceName, 'Notebook');
    assert.equal(parsed.fields.attendanceMode, 'technical_visit');
    assert.equal(parsed.fields.city, 'rio-branco-do-sul');
    assert.equal(parsed.fields.address?.street, 'Rua XV');
    assert.equal(parsed.fields.address?.number, '120');
    assert.equal(parsed.fields.address?.neighborhood, 'Centro');
    assert.equal(parsed.fields.address?.complement, 'apartamento 3');
    assert.equal(parsed.fields.preferredPeriod, 'manha');
  });

  it('does not require a model when a generic iPhone service is detected', () => {
    const parsed = parseInboundMessage({
      phone: '41988880001',
      message: 'quanto custa trocar bateria de iphone?',
      timestamp: '2026-07-14T12:00:00.000Z',
    });

    assert.equal(parsed.fields.deviceType, 'celular');
    assert.equal(parsed.fields.deviceName, 'iPhone');
    assert.equal(parsed.fields.problemDescription, 'quanto custa trocar bateria de iphone?');
  });

  it('classifies network and CFTV services supported by the operation', () => {
    const wifi = parseInboundMessage({ phone: '41988880002', message: 'preciso arrumar meu wifi que nao funciona' });
    const cftv = parseInboundMessage({ phone: '41988880003', message: 'quero manutencao nas cameras do CFTV' });

    assert.equal(wifi.fields.deviceType, 'wifi');
    assert.equal(cftv.fields.deviceType, 'cftv');
  });
});
