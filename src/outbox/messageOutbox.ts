import crypto from 'node:crypto';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';

export const claimMessagesSchema = z.object({
  workerId: z.string().trim().min(3).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const sentMessageSchema = z.object({
  workerId: z.string().trim().min(3).max(100),
  providerMessageId: z.string().trim().min(1).max(200).optional(),
});

export const failedMessageSchema = z.object({
  workerId: z.string().trim().min(3).max(100),
  errorCode: z.string().trim().min(1).max(100).optional(),
  errorMessage: z.string().trim().min(1).max(500),
});

export function buildOutboxId(idempotencyKey: string, recipient: string, text: string) {
  return crypto.createHash('sha256').update(`${idempotencyKey}:${recipient}:${text}`).digest('hex');
}

export async function enqueueWhatsAppMessage(db: Firestore, input: {
  idempotencyKey: string;
  recipient: string;
  text: string;
  conversationId?: string;
}) {
  const id = buildOutboxId(input.idempotencyKey, input.recipient, input.text);
  const ref = db.collection('message_outbox').doc(id);
  await db.runTransaction(async (transaction) => {
    if ((await transaction.get(ref)).exists) return;
    transaction.create(ref, {
      channel: 'whatsapp',
      status: 'pending',
      idempotencyKey: input.idempotencyKey,
      recipient: input.recipient,
      text: input.text,
      conversationId: input.conversationId || null,
      attempts: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });
  return id;
}

export async function claimPendingMessages(db: Firestore, workerId: string, limit: number) {
  const candidates = await db.collection('message_outbox')
    .where('status', '==', 'pending')
    .limit(Math.min(limit * 3, 100))
    .get();
  const now = Date.now();
  const leaseUntil = Timestamp.fromMillis(now + 2 * 60 * 1000);
  const claimed: Array<Record<string, unknown>> = [];

  await db.runTransaction(async (transaction) => {
    const snapshots = candidates.docs.length > 0
      ? await transaction.getAll(...candidates.docs.map((candidate) => candidate.ref))
      : [];
    for (const snapshot of snapshots) {
      if (claimed.length >= limit) break;
      const data = snapshot.data();
      if (!data || data.status !== 'pending') continue;
      const existingLease = data.leaseUntil?.toMillis?.() as number | undefined;
      if (existingLease && existingLease > now) continue;

      transaction.update(snapshot.ref, {
        leaseOwner: workerId,
        leaseUntil,
        attempts: Number(data.attempts || 0) + 1,
        lastAttemptAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      claimed.push({
        id: snapshot.id,
        channel: data.channel,
        recipient: data.recipient,
        text: data.text,
        conversationId: data.conversationId || undefined,
        idempotencyKey: data.idempotencyKey,
        attempts: Number(data.attempts || 0) + 1,
        leaseUntil: leaseUntil.toDate().toISOString(),
      });
    }
  });
  return claimed;
}

async function finishMessage(db: Firestore, id: string, workerId: string, values: Record<string, unknown>) {
  const ref = db.collection('message_outbox').doc(id);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new OutboxError(404, 'Mensagem nao encontrada.');
    const data = snapshot.data();
    if (data?.status !== 'pending') throw new OutboxError(409, 'Mensagem ja finalizada.');
    if (data?.leaseOwner !== workerId) throw new OutboxError(409, 'Lease pertence a outro worker.');
    transaction.update(ref, {
      ...values,
      leaseOwner: null,
      leaseUntil: null,
      updatedAt: Timestamp.now(),
    });
  });
}

export function markMessageSent(db: Firestore, id: string, input: z.infer<typeof sentMessageSchema>) {
  return finishMessage(db, id, input.workerId, {
    status: 'sent',
    providerMessageId: input.providerMessageId || null,
    sentAt: Timestamp.now(),
  });
}

export function markMessageFailed(db: Firestore, id: string, input: z.infer<typeof failedMessageSchema>) {
  return finishMessage(db, id, input.workerId, {
    status: 'failed',
    errorCode: input.errorCode || null,
    errorMessage: input.errorMessage,
    failedAt: Timestamp.now(),
  });
}

export class OutboxError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}
