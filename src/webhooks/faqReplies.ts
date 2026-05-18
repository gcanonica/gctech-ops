import type { WhatsAppIntent } from './intentDetection';
import type { WhatsAppIntakeFields } from '../domain/types';

function getFirstName(name?: string) {
  return name?.trim().split(/\s+/)[0];
}

function withNextStep(reply: string, fields?: Partial<WhatsAppIntakeFields>) {
  const firstName = getFirstName(fields?.customerName);
  const prefix = firstName ? `${firstName}, se quiser agendar` : 'Se quiser agendar';
  return `${reply}\n\n${prefix}, me diga o aparelho, o defeito e se prefere visita tecnica ou trazer o equipamento.`;
}

export function buildFaqReply(intent: WhatsAppIntent, fields?: Partial<WhatsAppIntakeFields>) {
  switch (intent) {
    case 'greeting':
      return 'Ola! Atendemos por agendamento. O tecnico pode ir ate o local ou voce pode trazer o equipamento, como preferir. Como posso ajudar?';
    case 'business_hours':
      return withNextStep(
        'Nosso atendimento e organizado por agendamento para evitar espera e garantir que o tecnico consiga te atender melhor.',
        fields
      );
    case 'service_area':
      return withNextStep(
        'Atendemos principalmente Rio Branco do Sul e Itaperucu. Para outras regioes, precisamos confirmar disponibilidade antes.',
        fields
      );
    case 'dropoff_info':
      return withNextStep(
        'Voce pode trazer o equipamento, mas tambem fazemos visita tecnica no local. O ideal e agendar antes para confirmarmos o melhor horario.',
        fields
      );
    case 'pricing':
      return withNextStep(
        'Para valores, precisamos avaliar o aparelho e o defeito. Nao enviamos orcamento fechado sem diagnostico, para evitar passar preco errado.',
        fields
      );
    case 'payment_methods':
      return withNextStep(
        'A forma de pagamento pode ser combinada no atendimento. Quando houver orcamento, voce revisa antes de aprovar qualquer servico.',
        fields
      );
    case 'warranty':
      return withNextStep(
        'A garantia depende do servico realizado e fica registrada na OS. Antes de qualquer reparo, voce recebe as condicoes para revisar.',
        fields
      );
    case 'status_check':
      return 'Para consultar o andamento, me envie o numero da OS, seu nome ou o telefone usado no atendimento. Vou separar essa consulta para verificacao.';
    case 'complaint':
      return 'Sinto muito por isso. Reclamacoes precisam ser vistas com cuidado pelo responsavel. Vou encaminhar para atendimento humano antes de responder qualquer coisa por aqui.';
    case 'human_help':
      return 'Sem problema. Vou separar sua mensagem para atendimento humano. Se puder, me envie um resumo do que precisa para agilizar.';
    case 'unknown':
      return withNextStep(
        'Consigo te ajudar com agendamento, duvidas sobre atendimento, garantia, regiao atendida e acompanhamento de OS.',
        fields
      );
    default:
      return undefined;
  }
}
