import type { WhatsAppConversation } from '../domain/types';

export type WhatsAppIntent =
  | 'greeting'
  | 'new_service_order'
  | 'pricing'
  | 'business_hours'
  | 'service_area'
  | 'payment_methods'
  | 'warranty'
  | 'dropoff_info'
  | 'status_check'
  | 'complaint'
  | 'human_help'
  | 'unknown';

export interface IntentDetectionResult {
  intent: WhatsAppIntent;
  confidence: 'low' | 'medium' | 'high';
  shouldStartServiceFlow: boolean;
  shouldContinueActiveFlow: boolean;
}

export function normalizeIntentText(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{Letter}\p{Number}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function isShortGreeting(text: string) {
  return [
    'oi',
    'ola',
    'bom dia',
    'boa tarde',
    'boa noite',
    'opa',
  ].includes(text.trim());
}

function hasServiceSignal(text: string) {
  return includesAny(text, [
    'agendar',
    'agenda',
    'marcar',
    'visita',
    'tecnico',
    'conserto',
    'arrumar',
    'reparo',
    'orcamento',
    'tela',
    'bateria',
    'conector',
    'nao liga',
    'nao carrega',
    'defeito',
    'problema',
    'quebrad',
    'notebook',
    'iphone',
    'samsung',
    'motorola',
    'xiaomi',
    'ps4',
    'ps5',
    'xbox',
    'gpu',
    'placa de video',
  ]);
}

export function detectIntent(
  message: string,
  activeConversation?: WhatsAppConversation
): IntentDetectionResult {
  const text = normalizeIntentText(message);
  const hasActiveCollection = activeConversation?.status === 'collecting_data';

  if (includesAny(text, ['reclamacao', 'reclamar', 'insatisfeito', 'ruim', 'nao gostei', 'problema com atendimento'])) {
    return {
      intent: 'complaint',
      confidence: 'high',
      shouldStartServiceFlow: false,
      shouldContinueActiveFlow: false,
    };
  }

  if (includesAny(text, ['atendente', 'humano', 'pessoa', 'falar com alguem', 'responsavel'])) {
    return {
      intent: 'human_help',
      confidence: 'high',
      shouldStartServiceFlow: false,
      shouldContinueActiveFlow: false,
    };
  }

  if (includesAny(text, ['minha os', 'status', 'andamento', 'ficou pronto', 'esta pronto', 'ta pronto', 'numero da os'])) {
    return {
      intent: 'status_check',
      confidence: 'high',
      shouldStartServiceFlow: false,
      shouldContinueActiveFlow: false,
    };
  }

  if (includesAny(text, ['garantia', 'garantido', 'cobre o que', 'prazo de garantia'])) {
    return {
      intent: 'warranty',
      confidence: 'high',
      shouldStartServiceFlow: false,
      shouldContinueActiveFlow: hasActiveCollection,
    };
  }

  if (includesAny(text, ['pagamento', 'pagar', 'pix', 'cartao', 'dinheiro', 'parcel'])) {
    return {
      intent: 'payment_methods',
      confidence: 'high',
      shouldStartServiceFlow: false,
      shouldContinueActiveFlow: hasActiveCollection,
    };
  }

  if (includesAny(text, ['horario', 'abre', 'fecha', 'funciona que horas', 'atende que horas', 'expediente'])) {
    return {
      intent: 'business_hours',
      confidence: 'high',
      shouldStartServiceFlow: false,
      shouldContinueActiveFlow: hasActiveCollection,
    };
  }

  if (includesAny(text, ['rio branco', 'itaperu', 'regiao', 'cidade', 'atende onde', 'bairro'])) {
    return {
      intent: hasServiceSignal(text) ? 'new_service_order' : 'service_area',
      confidence: 'medium',
      shouldStartServiceFlow: hasServiceSignal(text),
      shouldContinueActiveFlow: hasActiveCollection,
    };
  }

  if (includesAny(text, ['endereco de voces', 'onde fica', 'levar ai', 'trazer', 'entregar equipamento', 'loja'])) {
    return {
      intent: hasServiceSignal(text) ? 'new_service_order' : 'dropoff_info',
      confidence: 'medium',
      shouldStartServiceFlow: hasServiceSignal(text),
      shouldContinueActiveFlow: hasActiveCollection,
    };
  }

  if (includesAny(text, ['quanto custa', 'valor', 'preco', 'cobram quanto', 'orcamento'])) {
    return {
      intent: 'pricing',
      confidence: 'high',
      shouldStartServiceFlow: hasServiceSignal(text),
      shouldContinueActiveFlow: hasActiveCollection || hasServiceSignal(text),
    };
  }

  if (hasServiceSignal(text)) {
    return {
      intent: 'new_service_order',
      confidence: 'high',
      shouldStartServiceFlow: true,
      shouldContinueActiveFlow: true,
    };
  }

  if (isShortGreeting(text)) {
    return {
      intent: 'greeting',
      confidence: 'high',
      shouldStartServiceFlow: false,
      shouldContinueActiveFlow: hasActiveCollection,
    };
  }

  return {
    intent: 'unknown',
    confidence: 'low',
    shouldStartServiceFlow: false,
    shouldContinueActiveFlow: hasActiveCollection,
  };
}
