import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { Contact, ContactAddress, WhatsAppConversation, WhatsAppIntakeFields } from '../domain/types';

const ACTIVE_CONVERSATION_STATUSES = ['open', 'collecting_data', 'waiting_customer', 'waiting_approval'];

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefined(entryValue)])
    ) as T;
  }

  return value;
}

function isUsefulFieldValue(
  key: keyof WhatsAppIntakeFields,
  value: WhatsAppIntakeFields[keyof WhatsAppIntakeFields] | undefined,
  currentValue: WhatsAppIntakeFields[keyof WhatsAppIntakeFields] | undefined
) {
  if (value === undefined || value === null || value === '') return false;
  if (key === 'city' && value === 'unknown') return !currentValue;
  if (key === 'attendanceMode' && value === 'unknown') return !currentValue;
  if (key === 'deviceType' && value === 'outro') return !currentValue;
  if (key === 'address' && isPlainObject(value) && !value.raw) return false;
  return true;
}

function mergeAddress(
  existingAddress?: ContactAddress,
  incomingAddress?: ContactAddress
) {
  if (!existingAddress) return incomingAddress;
  if (!incomingAddress) return existingAddress;

  return stripUndefined<ContactAddress>({
    ...existingAddress,
    ...incomingAddress,
    city: incomingAddress.city !== 'unknown' ? incomingAddress.city : existingAddress.city,
    raw: incomingAddress.raw || existingAddress.raw,
    street: incomingAddress.street || existingAddress.street,
    number: incomingAddress.number || existingAddress.number,
    neighborhood: incomingAddress.neighborhood || existingAddress.neighborhood,
    complement: incomingAddress.complement || existingAddress.complement,
  });
}

export function mergeIntakeFields(
  existingFields: Partial<WhatsAppIntakeFields>,
  incomingFields: Partial<WhatsAppIntakeFields>
) {
  const merged: Partial<WhatsAppIntakeFields> = { ...existingFields };

  for (const [rawKey, value] of Object.entries(incomingFields)) {
    const key = rawKey as keyof WhatsAppIntakeFields;
    const currentValue = merged[key] as WhatsAppIntakeFields[keyof WhatsAppIntakeFields] | undefined;

    if (key === 'address') {
      const mergedAddress = mergeAddress(
        merged.address,
        value as ContactAddress | undefined
      );

      if (mergedAddress) {
        merged.address = mergedAddress;
        merged.neighborhood = mergedAddress.neighborhood || merged.neighborhood || mergedAddress.raw;
      }

      continue;
    }

    if (isUsefulFieldValue(key, value as WhatsAppIntakeFields[keyof WhatsAppIntakeFields], currentValue)) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  return stripUndefined(merged);
}

export async function findActiveConversationByPhone(db: Firestore, phone: string) {
  const snapshot = await db
    .collection('whatsapp_conversations')
    .where('phone', '==', phone)
    .limit(20)
    .get();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, data: doc.data() as WhatsAppConversation }))
    .filter(({ data }) => ACTIVE_CONVERSATION_STATUSES.includes(data.status))
    .sort((a, b) => {
      const aDate = new Date(a.data.updatedAt || a.data.lastMessageAt || 0).getTime();
      const bDate = new Date(b.data.updatedAt || b.data.lastMessageAt || 0).getTime();
      return bDate - aDate;
    })[0];
}

export async function upsertContactByPhone(
  db: Firestore,
  input: {
    phone: string;
    whatsappId?: string;
    fields: Partial<WhatsAppIntakeFields>;
  }
) {
  const now = new Date().toISOString();
  const snapshot = await db.collection('contacts').where('phone', '==', input.phone).limit(1).get();
  const existingDoc = snapshot.docs[0];
  const contactRef = existingDoc?.ref || db.collection('contacts').doc();
  const existing = existingDoc?.data() as Contact | undefined;

  const contact = stripUndefined<Contact>({
    id: contactRef.id,
    name: input.fields.customerName || existing?.name,
    phone: input.phone,
    whatsappId: input.whatsappId || existing?.whatsappId || `${input.phone}@s.whatsapp.net`,
    source: 'whatsapp',
    address: input.fields.address || existing?.address,
    linkedUserId: existing?.linkedUserId,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });

  await contactRef.set(
    stripUndefined({
      ...contact,
      createdAtTimestamp: existingDoc?.exists ? undefined : Timestamp.now(),
    }),
    { merge: true }
  );

  return {
    ref: contactRef,
    contact,
  };
}

export async function saveCollectingConversation(
  db: Firestore,
  input: {
    conversationId?: string;
    contactId: string;
    phone: string;
    fields: Partial<WhatsAppIntakeFields>;
    missingFields: string[];
    sourceMessage: string;
    receivedAt?: string;
  }
) {
  const now = new Date().toISOString();
  const conversationRef = input.conversationId
    ? db.collection('whatsapp_conversations').doc(input.conversationId)
    : db.collection('whatsapp_conversations').doc();
  const existingSnapshot = await conversationRef.get();
  const existing = existingSnapshot.data() as WhatsAppConversation | undefined;

  const conversation = stripUndefined<WhatsAppConversation>({
    id: conversationRef.id,
    contactId: input.contactId,
    phone: input.phone,
    status: 'collecting_data',
    intent: existing?.intent || 'new_service_order',
    collectedFields: input.fields,
    missingFields: input.missingFields,
    lastSourceMessage: input.sourceMessage,
    lastMessageAt: input.receivedAt || now,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });

  await conversationRef.set(conversation, { merge: true });

  return {
    ref: conversationRef,
    conversation,
  };
}
