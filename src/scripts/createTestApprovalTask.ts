import 'dotenv/config';
import { getGCTechAdminDb } from '../integrations/firebaseAdmin';
import type { WhatsAppIntakeFields } from '../domain/types';
import { createWhatsAppAppointmentApproval } from '../workflows/approvalTasks';

function getDefaultStartTime() {
  const configured = process.env.TEST_APPOINTMENT_START;
  if (configured?.trim()) return new Date(configured);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  return tomorrow;
}

function buildTestIntake(startTime: Date): WhatsAppIntakeFields {
  return {
    customerName: process.env.TEST_CUSTOMER_NAME || 'Cliente Teste WhatsApp',
    customerPhone: process.env.TEST_CUSTOMER_PHONE || '41999990000',
    deviceType: 'celular',
    deviceName: process.env.TEST_DEVICE_NAME || 'iPhone 11',
    problemDescription: process.env.TEST_PROBLEM_DESCRIPTION || 'Tela quebrada e toque falhando apos queda.',
    attendanceMode: 'technical_visit',
    city: 'rio-branco-do-sul',
    neighborhood: process.env.TEST_NEIGHBORHOOD || 'Centro',
    address: {
      raw: process.env.TEST_ADDRESS || 'Rua Teste, 123, Centro, Rio Branco do Sul - PR',
      city: 'rio-branco-do-sul',
    },
    preferredDate: startTime.toISOString().slice(0, 10),
    preferredTime: startTime.toISOString(),
    urgency: 'normal',
  };
}

async function main() {
  const db = getGCTechAdminDb();
  const startTime = getDefaultStartTime();
  const intake = buildTestIntake(startTime);

  const result = await createWhatsAppAppointmentApproval(db, {
    intake,
    sourceMessage: intake.problemDescription,
  });

  console.log('Approval task criada com sucesso.');
  console.log(`approvalTaskId=${result.approvalTask.id}`);
  console.log(`contactId=${result.contact.id}`);
  console.log(`conversationId=${result.conversation.id}`);
}

main().catch((error) => {
  console.error('Erro ao criar approval_task de teste:', error);
  process.exitCode = 1;
});

