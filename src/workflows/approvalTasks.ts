import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { ApprovalTask, Contact, WhatsAppConversation, WhatsAppIntakeFields } from '../domain/types';
import { stripUndefined } from '../webhooks/conversationStore';
import { buildApprovalCreatedReply } from '../webhooks/replies';

export interface CreateWhatsAppAppointmentApprovalInput {
  intake: WhatsAppIntakeFields;
  sourceMessage: string;
  receivedAt?: string;
  whatsappId?: string;
  contactId?: string;
  conversationId?: string;
}

function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

function getStartTime(intake: WhatsAppIntakeFields) {
  const preferredTime = intake.preferredTime || intake.preferredDate;

  if (preferredTime) {
    const parsed = new Date(preferredTime);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  return tomorrow;
}

export async function createWhatsAppAppointmentApproval(
  db: Firestore,
  input: CreateWhatsAppAppointmentApprovalInput
) {
  const now = new Date().toISOString();
  const startTime = getStartTime(input.intake);
  const endTime = addHours(startTime, 1);
  const contactRef = input.contactId
    ? db.collection('contacts').doc(input.contactId)
    : db.collection('contacts').doc();
  const conversationRef = input.conversationId
    ? db.collection('whatsapp_conversations').doc(input.conversationId)
    : db.collection('whatsapp_conversations').doc();
  const approvalRef = db.collection('approval_tasks').doc();
  const existingContact = (await contactRef.get()).data() as Contact | undefined;
  const existingConversation = (await conversationRef.get()).data() as WhatsAppConversation | undefined;

  const contact = stripUndefined<Contact>({
    id: contactRef.id,
    name: input.intake.customerName,
    phone: input.intake.customerPhone,
    whatsappId: input.whatsappId || existingContact?.whatsappId || `${input.intake.customerPhone}@s.whatsapp.net`,
    source: existingContact?.source || 'whatsapp',
    address: input.intake.address || existingContact?.address,
    linkedUserId: existingContact?.linkedUserId,
    createdAt: existingContact?.createdAt || now,
    updatedAt: now,
  });

  const conversation = stripUndefined<WhatsAppConversation>({
    id: conversationRef.id,
    contactId: contactRef.id,
    phone: input.intake.customerPhone,
    status: 'waiting_approval',
    intent: existingConversation?.intent || 'new_service_order',
    collectedFields: input.intake,
    missingFields: [],
    approvalTaskId: approvalRef.id,
    lastSourceMessage: input.sourceMessage,
    lastMessageAt: input.receivedAt || now,
    createdAt: existingConversation?.createdAt || now,
    updatedAt: now,
  });

  const approvalTask = stripUndefined<ApprovalTask>({
    id: approvalRef.id,
    type: 'new_whatsapp_appointment',
    status: 'pending',
    riskLevel: 'low',
    payload: {
      contactId: contactRef.id,
      conversationId: conversationRef.id,
      proposedServiceOrder: {
        contactId: contactRef.id,
        customerName: input.intake.customerName,
        customerPhone: input.intake.customerPhone,
        address: input.intake.address?.raw,
        deviceType: input.intake.deviceType,
        deviceName: input.intake.deviceName,
        description: input.intake.problemDescription,
        status: 'visita-agendada',
        scheduledAt: startTime.toISOString(),
      },
      proposedSchedule: {
        contactId: contactRef.id,
        customerName: input.intake.customerName,
        customerPhone: input.intake.customerPhone,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        status: 'draft',
      },
      suggestedReply: buildApprovalCreatedReply(input.intake),
    },
    createdAt: now,
  });

  await db.runTransaction(async (transaction) => {
    transaction.set(
      contactRef,
      stripUndefined({
        ...contact,
        createdAtTimestamp: existingContact ? undefined : Timestamp.now(),
      }),
      { merge: true }
    );
    transaction.set(conversationRef, conversation, { merge: true });
    transaction.set(approvalRef, approvalTask);
  });

  return {
    approvalTask,
    contact,
    conversation,
  };
}
