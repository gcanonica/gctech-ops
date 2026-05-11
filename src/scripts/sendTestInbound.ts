import 'dotenv/config';

const port = Number(process.env.OPS_PORT || 3100);

async function main() {
  const response = await fetch(`http://localhost:${port}/webhooks/whatsapp/inbound`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone: process.env.TEST_CUSTOMER_PHONE || '41999990000',
      name: process.env.TEST_CUSTOMER_NAME || 'Cliente Teste WhatsApp',
      message:
        process.env.TEST_INBOUND_MESSAGE ||
        'Tenho um iPhone 11 com tela quebrada. Moro na Rua Teste, 123, Centro, Rio Branco do Sul e queria visita amanha as 10h.',
      timestamp: new Date().toISOString(),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  console.log(JSON.stringify(payload, null, 2));

  if (!response.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Erro ao enviar inbound de teste:', error);
  process.exitCode = 1;
});
