import 'dotenv/config';
import express from 'express';
import { getMissingRequiredFieldIds, isCompleteWhatsAppIntake } from './domain/intakeFields';
import { getGCTechAdminDb } from './integrations/firebaseAdmin';
import { createWhatsAppAppointmentApproval } from './workflows/approvalTasks';
import {
  findActiveConversationByPhone,
  mergeIntakeFields,
  saveCollectingConversation,
  upsertContactByPhone,
} from './webhooks/conversationStore';
import { buildFaqReply } from './webhooks/faqReplies';
import { detectIntent } from './webhooks/intentDetection';
import { parseInboundMessage } from './webhooks/parseInboundMessage';
import { buildInvalidPayloadReply, buildMissingFieldReply } from './webhooks/replies';

const app = express();
const port = Number(process.env.OPS_PORT || 3100);
const db = getGCTechAdminDb();

app.use(express.json());

function isLocalRequest(req: express.Request) {
  const remoteAddress = req.socket.remoteAddress || '';
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddress);
}

function requireWebhookToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const expectedToken = process.env.OPS_WEBHOOK_TOKEN?.trim();
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

  if (bearerToken !== expectedToken && headerToken !== expectedToken) {
    return res.status(401).json({
      ok: false,
      error: 'Token do webhook invalido.',
    });
  }

  next();
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'gc-eletronica-ops',
  });
});

app.post('/webhooks/whatsapp/inbound', requireWebhookToken, async (req, res) => {
  try {
    const parsed = parseInboundMessage(req.body);

    if (parsed.missingPayloadFields.length > 0) {
      return res.status(400).json({
        ok: false,
        status: 'invalid_payload',
        missingPayloadFields: parsed.missingPayloadFields,
        reply: buildInvalidPayloadReply(parsed.missingPayloadFields),
      });
    }

    const activeConversation = await findActiveConversationByPhone(db, parsed.phone);
    const intent = detectIntent(parsed.message, activeConversation?.data);

    if (activeConversation?.data.status === 'waiting_approval' && activeConversation.data.approvalTaskId) {
      return res.status(200).json({
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
      return res.status(200).json({
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
      return res.status(200).json({
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

      return res.status(200).json({
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

    res.status(201).json({
      ok: true,
      status: 'approval_created',
      intent: intent.intent,
      confidence: intent.confidence,
      approvalTaskId: result.approvalTask.id,
      contactId: result.contact.id,
      conversationId: result.conversation.id,
      reply: result.approvalTask.payload.suggestedReply,
    });
  } catch (error) {
    console.error('Inbound webhook error:', error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Erro ao processar webhook.',
    });
  }
});

app.listen(port, () => {
  console.log(`GC Eletronica Ops rodando em http://localhost:${port}`);
});
