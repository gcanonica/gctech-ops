export type DeviceType = 'celular' | 'video-game' | 'gpu' | 'notebook' | 'outro';

export type ContactSource = 'whatsapp' | 'manual' | 'gctech';

export type AttendanceMode = 'technical_visit' | 'customer_dropoff' | 'unknown';

export type ServiceCity = 'rio-branco-do-sul' | 'itaperucu' | 'unknown';

export type ConversationStatus =
  | 'open'
  | 'collecting_data'
  | 'waiting_customer'
  | 'waiting_approval'
  | 'closed';

export type ConversationIntent =
  | 'new_service_order'
  | 'schedule'
  | 'status_check'
  | 'support'
  | 'complaint'
  | 'unknown';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'edited' | 'expired';

export type ApprovalType = 'new_whatsapp_appointment';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface ContactAddress {
  raw?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city: ServiceCity;
  complement?: string;
}

export interface Contact {
  id: string;
  name?: string;
  phone: string;
  whatsappId?: string;
  source: ContactSource;
  address?: ContactAddress;
  linkedUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppConversation {
  id: string;
  contactId: string;
  phone: string;
  status: ConversationStatus;
  intent: ConversationIntent;
  collectedFields: Partial<WhatsAppIntakeFields>;
  missingFields?: string[];
  approvalTaskId?: string;
  lastSourceMessage?: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppIntakeFields {
  customerName: string;
  customerPhone: string;
  deviceType: DeviceType;
  deviceName: string;
  problemDescription: string;
  attendanceMode: AttendanceMode;
  city: ServiceCity;
  neighborhood?: string;
  address?: ContactAddress;
  preferredDate?: string;
  preferredPeriod?: 'manha' | 'tarde';
  preferredTime?: string;
  urgency?: 'normal' | 'urgente';
}

export interface ServiceOrderDraft {
  contactId: string;
  customerName: string;
  customerPhone: string;
  address?: string;
  deviceType: DeviceType;
  deviceName: string;
  description: string;
  status: 'visita-agendada';
  scheduledAt?: string;
}

export interface ScheduleDraft {
  contactId: string;
  customerName: string;
  customerPhone: string;
  startTime: string;
  endTime: string;
  status: 'draft';
}

export interface AppointmentApprovalPayload {
  contactId: string;
  conversationId: string;
  proposedServiceOrder: ServiceOrderDraft;
  proposedSchedule?: ScheduleDraft;
  suggestedReply: string;
}

export interface ApprovalTask {
  id: string;
  type: ApprovalType;
  status: ApprovalStatus;
  riskLevel: RiskLevel;
  payload: AppointmentApprovalPayload;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewerNotes?: string;
}

export interface AgentRun {
  id: string;
  agentName: string;
  conversationId?: string;
  contactId?: string;
  inputSummary: string;
  outputSummary: string;
  approvalTaskId?: string;
  status: 'success' | 'needs_approval' | 'failed';
  errorMessage?: string;
  createdAt: string;
}
