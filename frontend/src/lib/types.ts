export interface Admin {
  id: string;
  email: string;
  createdAt?: string;
}

export interface InstagramAccount {
  id: string;
  instagramAccountId: string;
  username: string;
  name: string | null;
  profilePictureUrl: string | null;
  accountType: string | null;
  isConnected: boolean;
  hasToken: boolean;
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AcademySettings {
  id: string;
  instagramAccountId: string;
  academyName: string;
  coursesAndPrices: string;
  address: string;
  phoneNumbers: string;
  promotions: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  instagramScopedId: string;
  username: string | null;
  name: string | null;
  profilePictureUrl: string | null;
  // AI suhbatdan aniqlab olgan aloqa raqami (mijoz o'zi qoldirgan bo'lsa).
  phoneNumber: string | null;
  lastMessageAt: string | null;
}

export type SenderType = 'CONTACT' | 'ADMIN';
export type MessageStatus = 'RECEIVED' | 'SENDING' | 'SENT' | 'FAILED';

export interface Message {
  id: string;
  instagramMessageId: string | null;
  conversationId: string;
  senderType: SenderType;
  text: string | null;
  attachmentType: string | null;
  attachmentUrl: string | null;
  attachmentThumbnailUrl: string | null;
  adminReaction: string | null;
  contactReaction: string | null;
  status: MessageStatus;
  sentAt: string;
  createdAt: string;
}

export type CallStatus = 'NEW' | 'TALKED' | 'NOT_ANSWERED';

export interface ConversationListItem {
  id: string;
  contact: Contact;
  unreadCount: number;
  status: 'OPEN' | 'CLOSED';
  leadTemperature: 'HOT' | 'WARM' | 'COLD';
  talkStatus: 'TALKED' | 'NOT_TALKED';
  courseDecision: 'WILL_WRITE' | 'WILL_NOT_WRITE';
  // Qo'ng'iroqlar bo'limi uchun: telefon orqali bog'lanish holati.
  callStatus: CallStatus;
  // AI suhbatdan aniqlagan, mijoz qiziqish bildirgan fan/kurs nomi.
  interestedCourse: string | null;
  // Handover Protocol: true bo'lsa, mijoz operator so'ragan (yoki admin qo'lda to'xtatgan) —
  // AI shu suhbatda avtomatik javob bermaydi.
  aiPaused: boolean;
  aiPausedAt: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  lastMessage: Message | null;
}

export interface StatsResponse {
  totals: {
    totalConversations: number;
    totalWithPhone: number;
    totalMessages: number;
    talkedCount: number;
  };
  monthlyLeads: { month: string; count: number }[];
  monthlyMessages: { month: string; contact: number; admin: number }[];
  leadTemperature: { HOT: number; WARM: number; COLD: number };
  callStatus: { NEW: number; TALKED: number; NOT_ANSWERED: number };
  topCourses: { course: string; count: number }[];
}

export interface MessageUpdatedEvent {
  conversationId: string;
  message: Message;
}

export interface MessageDeletedEvent {
  conversationId: string;
  messageId: string;
}

export interface NewMessageEvent {
  conversationId: string;
  message: Message;
  conversation: {
    id: string;
    unreadCount: number;
    lastMessageAt: string | null;
    contact: Contact;
  };
}
