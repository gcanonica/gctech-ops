import crypto from 'node:crypto';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';

export type CachedWebhookResponse = { statusCode: number; body: Record<string, unknown> };

export function buildIdempotencyKey(payload: unknown, suppliedKey?: string) {
  const raw = suppliedKey?.trim() || JSON.stringify(payload);
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function claimWebhookEvent(db: Firestore, key: string) {
  const ref = db.collection('webhook_events').doc(key);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) {
      const data = snapshot.data();
      return { claimed: false as const, response: data?.response as CachedWebhookResponse | undefined };
    }
    transaction.create(ref, {
      state: 'processing',
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    return { claimed: true as const };
  });
}

export async function completeWebhookEvent(db: Firestore, key: string, response: CachedWebhookResponse) {
  await db.collection('webhook_events').doc(key).set({ state: 'completed', response, completedAt: Timestamp.now() }, { merge: true });
}

export async function releaseWebhookEvent(db: Firestore, key: string) {
  await db.collection('webhook_events').doc(key).delete();
}
