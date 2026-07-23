import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';
import { parseEnv } from './config/env';
import { getMissingRequiredFieldIds, isCompleteWhatsAppIntake } from './domain/intakeFields';
import { getGCTechAdminDb } from './integrations/firebaseAdmin';
import { createWhatsAppAppointmentApproval } from './workflows/approvalTasks';
import {
  claimMessagesSchema,
  claimPendingMessages,
  enqueueWhatsAppMessage,
  failedMessageSchema,
  markMessageFailed,
  markMessageSent,
  OutboxError,
  sentMessageSchema,
} from './outbox/messageOutbox';
import {
  findActiveConversationByPhone,
  mergeIntakeFields,
  saveCollectingConversation,
  upsertContactByPhone,
} from './webhooks/conversationStore';
import { buildFaqReply } from './webhooks/faqReplies';
import { detectIntent } from './webhooks/intentDetection';
import { parseInboundMessage } from './webhooks/parseInboundMessage';
import { buildIdempotencyKey, claimWebhookEvent, completeWebhookEvent, releaseWebhookEvent } from './webhooks/idempotency';
import { buildInvalidPayloadReply, buildMissingFieldReply } from './webhooks/replies';

const app = express();
const env = parseEnv();
const port = env.OPS_PORT;
const db = getGCTechAdminDb();
const inboundPayloadSchema = z.record(z.string(), z.unknown());

app.disable('x-powered-by');
if (env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(express.json({ limit: '128kb' }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

function isLocalRequest(req: express.Request) {
  const remoteAddress = req.socket.remoteAddress || '';
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddress);
}

function requireWebhookToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const expectedToken = env.OPS_WEBHOOK_TOKEN;
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const headerToken = typeof req.headers['x-webhook-token'] === 'string'
    ? req.headers['x-webhook-token'].trim()
    : undefined;

  if (!expectedToken && isLocalRequest(req)) {
    return next();
  }

  if (!expectedToken) {
    return res.status(503).json({
      ok: false,
      error: 'OPS_WEBHOOK_TOKEN nao configurado. Configure um token antes de expor este webhook.',
    });
  }

  if (!tokensMatch(bearerToken, expectedToken) && !tokensMatch(headerToken, expectedToken)) {
    return res.status(401).json({
      ok: false,
      error: 'Token do webhook invalido.',
    });
  }

  next();
}

function requireOutboxToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const expectedToken = env.OPS_OUTBOX_TOKEN;
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const headerToken = typeof req.headers['x-outbox-token'] === 'string' ? req.headers['x-outbox-token'].trim() : undefined;
  if (!expectedToken && isLocalRequest(req)) return next();
  if (!expectedToken) return res.status(503).json({ ok: false, error: 'OPS_OUTBOX_TOKEN nao configurado.' });
  if (!tokensMatch(bearerToken, expectedToken) && !tokensMatch(headerToken, expectedToken)) {
    return res.status(401).json({ ok: false, error: 'Token da outbox invalido.' });
  }
  next();
}

function tokensMatch(receivedToken: string | undefined, expectedToken: string) {
  if (!receivedToken) return false;

  const received = Buffer.from(receivedToken);
  const expected = Buffer.from(expectedToken);

  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'gc-eletronica-ops',
    version: env.APP_VERSION,
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

app.get('/ready', async (_req, res) => {
  try {
    await db.collection('webhook_events').limit(1).get();
    res.json({ ok: true, service: 'gc-eletronica-ops', dependencies: { firestore: 'ok' } });
  } catch {
    res.status(503).json({ ok: false, service: 'gc-eletronica-ops', dependencies: { firestore: 'unavailable' } });
  }
});

const outboxIdSchema = z.string().regex(/^[a-f0-9]{64}$/);

app.post('/outbox/messages/claim', requireOutboxToken, async (req, res) => {
  const input = claimMessagesSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ ok: false, error: 'Payload invalido.' });
  try {
    const messages = await claimPendingMessages(db, input.data.workerId, input.data.limit);
    return res.json({ ok: true, messages });
  } catch (error) {
    console.error('Outbox claim error:', error);
    return res.status(500).json({ ok: false, error: 'Erro ao buscar mensagens.' });
  }
});

app.post('/outbox/messages/:id/sent', requireOutboxToken, async (req, res) => {
  const id = outboxIdSchema.safeParse(req.params.id);
  const input = sentMessageSchema.safeParse(req.body);
  if (!id.success || !input.success) return res.status(400).json({ ok: false, error: 'Payload invalido.' });
  try {
    await markMessageSent(db, id.data, input.data);
    return res.json({ ok: true, status: 'sent' });
  } catch (error) {
    const status = error instanceof OutboxError ? error.statusCode : 500;
    return res.status(status).json({ ok: false, error: error instanceof OutboxError ? error.message : 'Erro ao confirmar envio.' });
  }
});

app.post('/outbox/messages/:id/failed', requireOutboxToken, async (req, res) => {
  const id = outboxIdSchema.safeParse(req.params.id);
  const input = failedMessageSchema.safeParse(req.body);
  if (!id.success || !input.success) return res.status(400).json({ ok: false, error: 'Payload invalido.' });
  try {
    await markMessageFailed(db, id.data, input.data);
    return res.json({ ok: true, status: 'failed' });
  } catch (error) {
    const status = error instanceof OutboxError ? error.statusCode : 500;
    return res.status(status).json({ ok: false, error: error instanceof OutboxError ? error.message : 'Erro ao registrar falha.' });
  }
});

app.post('/webhooks/whatsapp/inbound', webhookLimiter, requireWebhookToken, async (req, res) => {
  const suppliedKey = typeof req.headers['x-idempotency-key'] === 'string'
    ? req.headers['x-idempotency-key']
    : typeof req.headers['x-event-id'] === 'string'
      ? req.headers['x-event-id']
      : undefined;
  const idempotencyKey = buildIdempotencyKey(req.body, suppliedKey);
  let claimed = false;
  let recipientPhone: string | undefined;
  try {
    const claim = await claimWebhookEvent(db, idempotencyKey);
    if (!claim.claimed) {
      if (claim.response) {
        res.setHeader('X-Idempotent-Replay', 'true');
        return res.status(claim.response.statusCode).json(claim.response.body);
      }
      return res.status(409).json({ ok: false, status: 'already_processing', retryable: true });
    }
    claimed = true;
    const send = async (statusCode: number, body: Record<string, unknown>) => {
      if (statusCode >= 200 && statusCode < 300 && recipientPhone && typeof body.reply === 'string') {
        await enqueueWhatsAppMessage(db, {
          idempotencyKey,
          recipient: recipientPhone,
          text: body.reply,
          conversationId: typeof body.conversationId === 'string' ? body.conversationId : undefined,
        });
      }
      await completeWebhookEvent(db, idempotencyKey, { statusCode, body });
      return res.status(statusCode).json(body);
    };
    const bodyValidation = inboundPayloadSchema.safeParse(req.body);

    if (!bodyValidation.success) {
      const response = {
        ok: false,
        status: 'invalid_payload',
        reply: buildInvalidPayloadReply(['payload']),
      };
      return send(400, response);
    }

    const parsed = parseInboundMessage(req.body);
    recipientPhone = parsed.phone;

    if (parsed.missingPayloadFields.length > 0) {
      const response = {
        ok: false,
        status: 'invalid_payload',
        missingPayloadFields: parsed.missingPayloadFields,
        reply: buildInvalidPayloadReply(parsed.missingPayloadFields),
      };
      return send(400, response);
    }

    const activeConversation = await findActiveConversationByPhone(db, parsed.phone);
    const intent = detectIntent(parsed.message, activeConversation?.data);

    if (activeConversation?.data.status === 'waiting_approval' && activeConversation.data.approvalTaskId) {
      return send(200, {
        ok: true,
        status: 'waiting_approval',
        intent: intent.intent,
        approvalTaskId: activeConversation.data.approvalTaskId,
        contactId: activeConversation.data.contactId,
        conversationId: activeConversation.id,
        reply: 'Seu atendimento ja esta separado para confirmacao. Assim que for aprovado, te aviso por aqui.',
      });
    }

    if (!activeConversation && !intent.shouldStartServiceFlow) {
      return send(200, {
        ok: true,
        status: intent.intent === 'complaint' || intent.intent === 'human_help' ? 'needs_human' : 'faq_answer',
        intent: intent.intent,
        confidence: intent.confidence,
        reply: buildFaqReply(intent.intent),
      });
    }

    const collectedFields = mergeIntakeFields(
      activeConversation?.data.collectedFields || {},
      parsed.fields
    );
    const contactResult = await upsertContactByPhone(db, {
      phone: parsed.phone,
      whatsappId: parsed.whatsappId,
      fields: collectedFields,
    });
    const missingFields = getMissingRequiredFieldIds(collectedFields);
    const faqReply = intent.intent !== 'new_service_order'
      ? buildFaqReply(intent.intent, collectedFields)
      : undefined;

    if (activeConversation && !intent.shouldContinueActiveFlow && faqReply) {
      return send(200, {
        ok: true,
        status: intent.intent === 'complaint' || intent.intent === 'human_help' ? 'needs_human' : 'faq_answer',
        intent: intent.intent,
        confidence: intent.confidence,
        contactId: contactResult.contact.id,
        conversationId: activeConversation.id,
        reply: faqReply,
      });
    }

    if (!isCompleteWhatsAppIntake(collectedFields)) {
      const conversationResult = await saveCollectingConversation(db, {
        conversationId: activeConversation?.id,
        contactId: contactResult.contact.id,
        phone: parsed.phone,
        fields: collectedFields,
        missingFields,
        sourceMessage: parsed.message,
        receivedAt: parsed.timestamp,
      });

      return send(200, {
        ok: true,
        status: 'collecting_data',
        intent: intent.intent,
        confidence: intent.confidence,
        missingFields,
        contactId: contactResult.contact.id,
        conversationId: conversationResult.conversation.id,
        reply: faqReply
          ? `${faqReply}\n\nPara continuar o agendamento: ${buildMissingFieldReply(missingFields, collectedFields)}`
          : buildMissingFieldReply(missingFields, collectedFields),
      });
    }

    const result = await createWhatsAppAppointmentApproval(db, {
      intake: collectedFields,
      sourceMessage: parsed.message,
      receivedAt: parsed.timestamp,
      whatsappId: parsed.whatsappId,
      contactId: contactResult.contact.id,
      conversationId: activeConversation?.id,
    });

    const response = {
      ok: true,
      status: 'approval_created',
      intent: intent.intent,
      confidence: intent.confidence,
      approvalTaskId: result.approvalTask.id,
      contactId: result.contact.id,
      conversationId: result.conversation.id,
      reply: result.approvalTask.payload.suggestedReply,
    };
    await send(201, response);
  } catch (error) {
    console.error('Inbound webhook error:', error);
    if (claimed) await releaseWebhookEvent(db, idempotencyKey).catch(() => undefined);
    res.status(500).json({
      ok: false,
      error: 'Erro ao processar webhook.',
    });
  }
});

app.listen(port, () => {
  console.log(`GC Eletronica Ops rodando em http://localhost:${port}`);
});
