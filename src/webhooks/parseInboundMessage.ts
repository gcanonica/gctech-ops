import type { AttendanceMode, ContactAddress, DeviceType, ServiceCity, WhatsAppIntakeFields } from '../domain/types';

export interface InboundWhatsAppPayload {
  phone?: string;
  name?: string;
  message?: string;
  timestamp?: string;
  whatsappId?: string;
}

export interface ParsedInboundResult {
  phone: string;
  name?: string;
  message: string;
  timestamp?: string;
  whatsappId?: string;
  fields: Partial<WhatsAppIntakeFields>;
  missingPayloadFields: string[];
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function getRecord(value: unknown, key: string): UnknownRecord | undefined {
  if (!isRecord(value)) return undefined;
  const nested = value[key];
  return isRecord(nested) ? nested : undefined;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }

  return undefined;
}

function toIsoTimestamp(value: unknown) {
  if (!value) return undefined;

  if (typeof value === 'number') {
    const milliseconds = value < 10000000000 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }

  return undefined;
}

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '');
}

export function extractInboundPayload(rawPayload: unknown): InboundWhatsAppPayload {
  const body = isRecord(rawPayload) ? rawPayload : {};
  const data = getRecord(body, 'data') || body;
  const key = getRecord(data, 'key');
  const messageObject = getRecord(data, 'message') || getRecord(body, 'message');
  const extendedTextMessage = getRecord(messageObject, 'extendedTextMessage');
  const imageMessage = getRecord(messageObject, 'imageMessage');
  const videoMessage = getRecord(messageObject, 'videoMessage');

  const phone = firstString(
    body.phone,
    body.from,
    body.remoteJid,
    data.phone,
    data.from,
    data.remoteJid,
    key?.remoteJid
  );

  const message = firstString(
    body.message,
    body.text,
    body.body,
    data.message,
    data.text,
    data.body,
    messageObject?.conversation,
    extendedTextMessage?.text,
    imageMessage?.caption,
    videoMessage?.caption
  );

  return {
    phone,
    name: firstString(body.name, body.pushName, data.name, data.pushName, data.senderName),
    message,
    timestamp: toIsoTimestamp(
      body.timestamp ||
        body.date_time ||
        data.timestamp ||
        data.messageTimestamp ||
        data.messageTimestampLong
    ),
    whatsappId: firstString(body.whatsappId, data.whatsappId, key?.remoteJid, phone),
  };
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferCustomerName(message: string) {
  const match = message.match(
    /\b(?:me chamo|meu nome e|sou)\s+([\p{Letter}][\p{Letter} ]{1,48}?)(?=\s*(?:,|\.|\n|$|\b(?:tenho|estou|to|tou|meu|minha|quero|queria|preciso|gostaria)\b))/iu
  );

  return match?.[1]?.replace(/\s+/g, ' ').trim();
}

function inferDeviceType(message: string): DeviceType {
  const normalized = normalizeText(message);

  if (
    normalized.includes('cftv') ||
    normalized.includes('camera de seguranca') ||
    normalized.includes('cameras de seguranca') ||
    normalized.includes('dvr') ||
    normalized.includes('nvr')
  ) {
    return 'cftv';
  }

  if (
    normalized.includes('wifi') ||
    normalized.includes('wi-fi') ||
    normalized.includes('roteador') ||
    normalized.includes('internet sem fio')
  ) {
    return 'wifi';
  }

  if (
    normalized.includes('infra de rede') ||
    normalized.includes('infraestrutura de rede') ||
    normalized.includes('cabeamento') ||
    normalized.includes('rede cabeada')
  ) {
    return 'infra-rede';
  }

  if (
    normalized.includes('iphone') ||
    normalized.includes('android') ||
    normalized.includes('celular') ||
    normalized.includes('smartphone') ||
    normalized.includes('samsung') ||
    normalized.includes('galaxy') ||
    normalized.includes('motorola') ||
    normalized.includes('xiaomi') ||
    normalized.includes('redmi') ||
    normalized.includes('poco')
  ) {
    return 'celular';
  }

  if (
    normalized.includes('notebook') ||
    normalized.includes('laptop') ||
    normalized.includes('macbook')
  ) {
    return 'notebook';
  }

  if (normalized.includes('computador') || /\bpc\b/.test(normalized)) {
    return 'computador';
  }

  if (
    normalized.includes('playstation') ||
    normalized.includes('ps4') ||
    normalized.includes('ps5') ||
    normalized.includes('xbox') ||
    normalized.includes('video game') ||
    normalized.includes('videogame') ||
    normalized.includes('switch')
  ) {
    return 'video-game';
  }

  if (
    normalized.includes('gpu') ||
    normalized.includes('placa de video') ||
    normalized.includes('rtx') ||
    normalized.includes('gtx')
  ) {
    return 'gpu';
  }

  return 'outro';
}

function inferAttendanceMode(message: string): AttendanceMode {
  const normalized = normalizeText(message);

  if (
    normalized.includes('trazer') ||
    normalized.includes('levar') ||
    normalized.includes('levo') ||
    normalized.includes('deixar') ||
    normalized.includes('deixo') ||
    normalized.includes('entregar') ||
    normalized.includes('passar ai') ||
    normalized.includes('vou ai') ||
    normalized.includes('ir na loja') ||
    normalized.includes('ir ate voces')
  ) {
    return 'customer_dropoff';
  }

  if (
    normalized.includes('visita') ||
    normalized.includes('em casa') ||
    normalized.includes('minha casa') ||
    normalized.includes('domicilio') ||
    normalized.includes('no local') ||
    normalized.includes('tecnico') ||
    normalized.includes('vem ate') ||
    normalized.includes('ir ate') ||
    normalized.includes('buscar')
  ) {
    return 'technical_visit';
  }

  return 'unknown';
}

function inferCity(message: string): ServiceCity {
  const normalized = normalizeText(message);

  if (normalized.includes('itaperu')) return 'itaperucu';
  if (normalized.includes('rio branco')) return 'rio-branco-do-sul';

  return 'unknown';
}

function inferDeviceName(message: string) {
  const detailToken = String.raw`(?!que\b|com\b|na\b|no\b|nao\b|sem\b|esta\b|ta\b|caiu\b|agua\b|molhou\b|parou\b|liga\b|carrega\b|lento\b|travando\b|desliga\b|quebrad\w*\b|defeito\b|problema\b|tela\b|bateria\b|amanha\b|hoje\b|segunda\b|terca\b|quarta\b|quinta\b|sexta\b|sabado\b|domingo\b|as\b|para\b|quero\b|queria\b|preciso\b)[A-Za-z0-9-]+`;
  const patterns = [
    /\b(CFTV|DVR|NVR|Wi-?Fi|Roteador|Infraestrutura de rede|Cabeamento de rede)\b/i,
    /\b(iPhone\s?\d{0,2}(?:\s?(?:Pro|Plus|Max|Mini))?)\b/i,
    /\b(PS5|PS4|PlayStation\s?\d?|Xbox\s?(?:One|Series\s?[SX]?)?|Nintendo\s?Switch)\b/i,
    /\b(RTX\s?\d{3,4}|GTX\s?\d{3,4})\b/i,
    new RegExp(String.raw`\b(MacBook(?:\s?(?:Air|Pro))?|Notebook(?:\s+${detailToken}){0,4})\b`, 'i'),
    new RegExp(String.raw`\b(Samsung(?:\s+Galaxy)?(?:\s+${detailToken}){0,4}|Galaxy(?:\s+${detailToken}){1,4}|Motorola(?:\s+${detailToken}){0,4}|Moto(?:\s+${detailToken}){1,4}|Xiaomi(?:\s+${detailToken}){0,4}|Redmi(?:\s+${detailToken}){1,4}|Poco(?:\s+${detailToken}){1,4})\b`, 'i'),
    /\b(celular|smartphone|videogame|video game|notebook|computador|pc)\b/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    const deviceName = match?.[1]?.replace(/\s+/g, ' ').trim();
    if (deviceName) return canonicalizeDeviceName(deviceName);
  }

  return undefined;
}

function canonicalizeDeviceName(deviceName: string) {
  const normalized = normalizeText(deviceName);

  if (normalized === 'iphone') return 'iPhone';
  if (normalized === 'ps5') return 'PS5';
  if (normalized === 'ps4') return 'PS4';
  if (normalized === 'notebook') return 'Notebook';
  if (normalized === 'celular') return 'Celular';
  if (normalized === 'smartphone') return 'Smartphone';
  if (normalized === 'videogame' || normalized === 'video game') return 'Videogame';
  if (normalized === 'computador' || normalized === 'pc') return 'Computador';
  if (normalized === 'cftv') return 'CFTV';
  if (normalized === 'wifi' || normalized === 'wi-fi') return 'Wi-Fi';
  if (normalized === 'roteador') return 'Roteador';

  return deviceName;
}

function buildAddressRaw(address: ContactAddress) {
  return [address.street, address.number, address.neighborhood, address.complement]
    .filter(Boolean)
    .join(', ');
}

function sanitizeComplement(value?: string) {
  if (!value) return undefined;

  const normalized = normalizeText(value).trim();
  if (!normalized) return undefined;
  if (['apartamento', 'apto', 'bloco', 'torre', 'condominio'].includes(normalized)) return undefined;

  return value.trim();
}

function inferAddress(message: string, city: ServiceCity) {
  const streetMatch = message.match(
    /\b((?:rua|r\.|avenida|av\.|travessa|tv\.|alameda|rodovia)\s+[^,.;\n]+?)(?=\s+(?:numero|num\.?|n\.?|bairro|complemento|apto|apartamento|bloco|torre|condominio)\b|,\s*(?:\d+|bairro|complemento|apto|apartamento|bloco|torre|condominio)|[.;\n]|$)/i
  );
  const numberMatch = message.match(/\b(?:numero|num\.?|n\.?)\s*(\d+[A-Za-z-]*)\b/i) ||
    message.match(/,\s*(\d+[A-Za-z-]*)\b/i);
  const neighborhoodMatch = message.match(
    /\bbairro\s*[:\-]?\s*([^,.;\n]+?)(?=\s+(?:complemento|apto|apartamento|bloco|torre|condominio|numero|num\.?|n\.?)\b|[.;\n]|$)/i
  );
  const apartmentMatch = message.match(
    /\b(?:complemento|apto|apartamento|bloco|torre|condominio)\s*[:\-]?\s*([^,.;\n]+?)(?=[.;\n]|$)/i
  );
  const rawSegment = message.match(
    /(?:endereco|moro na|moro no|rua|avenida|av\.|travessa|alameda|rodovia)\s*[:\-]?\s*([^.;\n]+)/i
  )?.[1]?.trim();

  const address: ContactAddress = {
    city,
    raw: rawSegment,
    street: streetMatch?.[1]?.trim(),
    number: numberMatch?.[1]?.trim(),
    neighborhood: neighborhoodMatch?.[1]?.trim(),
    complement: sanitizeComplement(apartmentMatch?.[1]),
  };

  if (!address.raw) {
    address.raw = buildAddressRaw(address);
  }

  if (!address.raw && !address.street && !address.number && !address.neighborhood && !address.complement) {
    return undefined;
  }

  return address;
}

function getNextWeekday(base: Date, targetDay: number) {
  const date = new Date(base);
  const currentDay = date.getDay();
  const daysToAdd = (targetDay + 7 - currentDay) % 7 || 7;
  date.setDate(date.getDate() + daysToAdd);
  return date;
}

function inferPreferredTime(message: string, timestamp?: string) {
  const normalized = normalizeText(message);
  const base = timestamp ? new Date(timestamp) : new Date();
  const safeBase = Number.isNaN(base.getTime()) ? new Date() : base;
  const timeMatch =
    normalized.match(/(?:as|para|por volta de|depois das|antes das)\s*(\d{1,2})(?::?(\d{2}))?\s*h?/i) ||
    normalized.match(/\b(\d{1,2})(?:(?::|h)(\d{2})?|h)\b/i);
  const explicitDate = normalized.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);

  const hasDateHint =
    normalized.includes('hoje') ||
    normalized.includes('amanha') ||
    normalized.includes('segunda') ||
    normalized.includes('terca') ||
    normalized.includes('quarta') ||
    normalized.includes('quinta') ||
    normalized.includes('sexta') ||
    normalized.includes('sabado') ||
    normalized.includes('domingo') ||
    Boolean(explicitDate);
  const hasPeriodHint = normalized.includes('manha') || normalized.includes('tarde') || normalized.includes('noite');

  if (!timeMatch && !hasDateHint && !hasPeriodHint) return undefined;

  let date = new Date(safeBase);

  if (explicitDate) {
    const day = Number(explicitDate[1]);
    const month = Number(explicitDate[2]) - 1;
    const year = explicitDate[3]
      ? Number(explicitDate[3].length === 2 ? `20${explicitDate[3]}` : explicitDate[3])
      : safeBase.getFullYear();
    date = new Date(year, month, day);
  } else if (normalized.includes('depois de amanha')) {
    date.setDate(date.getDate() + 2);
  } else if (normalized.includes('amanha')) {
    date.setDate(date.getDate() + 1);
  } else if (normalized.includes('segunda')) {
    date = getNextWeekday(safeBase, 1);
  } else if (normalized.includes('terca')) {
    date = getNextWeekday(safeBase, 2);
  } else if (normalized.includes('quarta')) {
    date = getNextWeekday(safeBase, 3);
  } else if (normalized.includes('quinta')) {
    date = getNextWeekday(safeBase, 4);
  } else if (normalized.includes('sexta')) {
    date = getNextWeekday(safeBase, 5);
  } else if (normalized.includes('sabado')) {
    date = getNextWeekday(safeBase, 6);
  } else if (normalized.includes('domingo')) {
    date = getNextWeekday(safeBase, 0);
  }

  const hour = timeMatch
    ? Number(timeMatch[1])
    : normalized.includes('tarde')
      ? 14
      : normalized.includes('noite')
        ? 18
        : 9;
  const minute = timeMatch?.[2] ? Number(timeMatch[2]) : 0;

  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function inferPreferredPeriod(message: string): WhatsAppIntakeFields['preferredPeriod'] | undefined {
  const normalized = normalizeText(message);

  if (/\b(?:de|da|pela|periodo da)?\s*manha\b/.test(normalized)) return 'manha';
  if (/\b(?:de|da|pela|periodo da)?\s*tarde\b/.test(normalized)) return 'tarde';

  return undefined;
}

function inferProblemDescription(message: string) {
  const normalized = normalizeText(message);
  const casualMessages = ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite'];
  const problemKeywords = [
    'problema',
    'defeito',
    'quebrad',
    'parou',
    'funciona',
    'funcionar',
    'caiu',
    'agua',
    'lento',
    'lenta',
    'troca',
    'trocar',
    'manutencao',
    'limpeza',
    'formatacao',
    'display',
    'touch',
    'nao liga',
    'nao carrega',
    'sem imagem',
    'sem som',
    'tela',
    'bateria',
    'conector',
    'carregador',
    'hd',
    'ssd',
    'fonte',
    'controle',
    'molhou',
    'desliga',
    'esquentando',
    'travando',
    'formatar',
    'erro',
    'orcamento',
  ];

  if (casualMessages.includes(normalized.trim())) return undefined;
  if (!problemKeywords.some((keyword) => normalized.includes(keyword))) return undefined;

  const trimmed = message.trim();
  return trimmed.length > 260 ? `${trimmed.slice(0, 257)}...` : trimmed;
}

export function parseInboundMessage(rawPayload: unknown): ParsedInboundResult {
  const payload = extractInboundPayload(rawPayload);
  const phone = normalizePhone(payload.phone || '');
  const name = payload.name?.trim() || (payload.message ? inferCustomerName(payload.message) : undefined);
  const message = payload.message?.trim() || '';
  const missingPayloadFields: string[] = [];

  if (!phone) missingPayloadFields.push('phone');
  if (!message) missingPayloadFields.push('message');

  const city = message ? inferCity(message) : 'unknown';
  const address = message ? inferAddress(message, city) : undefined;
  const attendanceMode = message ? inferAttendanceMode(message) : 'unknown';
  const deviceName = message ? inferDeviceName(message) : undefined;
  const problemDescription = message ? inferProblemDescription(message) : undefined;
  const preferredTime = message ? inferPreferredTime(message, payload.timestamp) : undefined;
  const preferredPeriod = message ? inferPreferredPeriod(message) : undefined;
  const deviceType = message ? inferDeviceType(message) : undefined;

  return {
    phone,
    name,
    message,
    timestamp: payload.timestamp,
    whatsappId: payload.whatsappId,
    missingPayloadFields,
    fields: {
      customerPhone: phone || undefined,
      customerName: name,
      deviceType,
      deviceName,
      problemDescription,
      attendanceMode,
      city,
      neighborhood: address?.raw,
      address,
      preferredPeriod,
      preferredTime,
      urgency: message && (
        normalizeText(message).includes('urgente') ||
        normalizeText(message).includes('quanto antes') ||
        normalizeText(message).includes('hoje ainda')
      )
        ? 'urgente'
        : undefined,
    },
  };
}
