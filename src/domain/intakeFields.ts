import type { WhatsAppIntakeFields } from './types';

export type IntakeFieldId = keyof WhatsAppIntakeFields;
export type MissingIntakeFieldId =
  | 'customerName'
  | 'deviceName'
  | 'problemDescription'
  | 'attendanceMode'
  | 'city'
  | 'address'
  | 'addressComplement'
  | 'preferredTime';

export interface IntakeFieldDefinition {
  id: IntakeFieldId;
  label: string;
  required: boolean;
  askWhenMissing: string;
}

export const WHATSAPP_INTAKE_FIELDS: IntakeFieldDefinition[] = [
  {
    id: 'customerName',
    label: 'Nome do cliente',
    required: true,
    askWhenMissing: 'Pode me informar seu nome, por favor?'
  },
  {
    id: 'deviceName',
    label: 'Modelo do aparelho',
    required: true,
    askWhenMissing: 'Qual e o modelo do aparelho?'
  },
  {
    id: 'problemDescription',
    label: 'Problema relatado',
    required: true,
    askWhenMissing: 'O que esta acontecendo com o aparelho?'
  },
  {
    id: 'attendanceMode',
    label: 'Tipo de atendimento',
    required: true,
    askWhenMissing: 'Voce prefere visita tecnica no local ou trazer o equipamento ate nos?'
  },
  {
    id: 'city',
    label: 'Cidade',
    required: true,
    askWhenMissing: 'Qual e sua cidade? Atendemos Rio Branco do Sul e Itaperucu.'
  },
  {
    id: 'preferredDate',
    label: 'Dia desejado',
    required: false,
    askWhenMissing: 'Tem algum dia de preferencia para o atendimento?'
  },
  {
    id: 'preferredTime',
    label: 'Horario desejado',
    required: false,
    askWhenMissing: 'Tem algum dia ou horario de preferencia?'
  },
  {
    id: 'address',
    label: 'Endereco',
    required: false,
    askWhenMissing: 'Pode me enviar o endereco ou bairro para a visita tecnica?'
  }
];

export function getMissingRequiredFields(fields: Partial<WhatsAppIntakeFields>) {
  const missingIds = getMissingRequiredFieldIds(fields);
  return WHATSAPP_INTAKE_FIELDS.filter((field) => missingIds.includes(field.id as MissingIntakeFieldId));
}

export function getMissingRequiredFieldIds(fields: Partial<WhatsAppIntakeFields>): MissingIntakeFieldId[] {
  const missing: MissingIntakeFieldId[] = [];
  const address = fields.address;
  const requiresAddressDetails = fields.attendanceMode === 'technical_visit';
  const hasFullVisitAddress = Boolean(address?.street && address?.number && address?.neighborhood);
  const needsApartmentComplement =
    Boolean(address?.raw && /(apartamento|apto|bloco|torre|condominio)/i.test(address.raw)) &&
    !address?.complement;

  if (!fields.customerName) missing.push('customerName');
  if (!fields.deviceName) missing.push('deviceName');
  if (!fields.problemDescription) missing.push('problemDescription');
  if (!fields.attendanceMode || fields.attendanceMode === 'unknown') missing.push('attendanceMode');
  if (!fields.city || fields.city === 'unknown') missing.push('city');
  if (requiresAddressDetails && !hasFullVisitAddress) missing.push('address');
  if (requiresAddressDetails && needsApartmentComplement) missing.push('addressComplement');
  if (!fields.preferredTime) missing.push('preferredTime');

  return missing;
}

export function isCompleteWhatsAppIntake(
  fields: Partial<WhatsAppIntakeFields>
): fields is WhatsAppIntakeFields {
  return getMissingRequiredFieldIds(fields).length === 0 && Boolean(fields.customerPhone);
}
