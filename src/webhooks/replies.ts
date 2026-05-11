import type { MissingIntakeFieldId } from '../domain/intakeFields';
import type { WhatsAppIntakeFields } from '../domain/types';

function getFirstName(name?: string) {
  return name?.trim().split(/\s+/)[0];
}

export function buildMissingFieldReply(
  missingFields: MissingIntakeFieldId[],
  fields: Partial<WhatsAppIntakeFields>
) {
  const firstName = getFirstName(fields.customerName);
  const greeting = firstName ? `Perfeito, ${firstName}. ` : '';
  const nextField = missingFields[0];

  switch (nextField) {
    case 'customerName':
      return 'Claro, eu te ajudo com isso. Qual e seu nome, por favor?';
    case 'deviceName':
      return `${greeting}Qual e o modelo do aparelho? Exemplo: iPhone 11, Samsung A32, notebook Dell, PS4.`;
    case 'problemDescription':
      return `${greeting}O que esta acontecendo com o aparelho? Pode me mandar um resumo do defeito.`;
    case 'attendanceMode':
      return `${greeting}Voce prefere visita tecnica no local ou trazer o equipamento ate nos?`;
    case 'city':
      return `${greeting}Qual e sua cidade? Atendemos Rio Branco do Sul e Itaperucu.`;
    case 'address':
      return `${greeting}Para visita tecnica, me passe o endereco completo com rua, numero e bairro. Se for apartamento ou condominio, pode incluir isso tambem.`;
    case 'addressComplement':
      return `${greeting}Como e apartamento ou condominio, me passe tambem o complemento, bloco, torre ou numero do apto.`;
    case 'preferredTime':
      return `${greeting}Tem algum dia ou horario de preferencia para o atendimento?`;
    default:
      return `${greeting}Pode me passar mais alguns detalhes para eu organizar o atendimento?`;
  }
}

export function buildInvalidPayloadReply(missingPayloadFields: string[]) {
  if (missingPayloadFields.includes('phone')) {
    return 'Nao consegui identificar o telefone do cliente nessa mensagem.';
  }

  return 'Recebi a mensagem, mas nao encontrei o texto para continuar o atendimento.';
}

export function buildApprovalCreatedReply(fields: WhatsAppIntakeFields) {
  const firstName = getFirstName(fields.customerName);
  const namePart = firstName ? `, ${firstName}` : '';
  return `Perfeito${namePart}. Separei seu atendimento para confirmacao interna e ja te retorno por aqui.`;
}
