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
  adminReaction: string | null;
  contactReaction: string | null;
  status: MessageStatus;
  sentAt: string;
  createdAt: string;
}

export interface ConversationListItem {
  id: string;
  contact: Contact;
  unreadCount: number;
  status: 'OPEN' | 'CLOSED';
  leadTemperature: 'HOT' | 'WARM' | 'COLD';
  talkStatus: 'TALKED' | 'NOT_TALKED';
  courseDecision: 'WILL_WRITE' | 'WILL_NOT_WRITE';
  // Handover Protocol: true bo'lsa, mijoz operator so'ragan (yoki admin qo'lda to'xtatgan) —
  // AI shu suhbatda avtomatik javob bermaydi.
  aiPaused: boolean;
  aiPausedAt: string | null;
  lastMessageAt: string | null;
  lastMessage: Message | null;
}

export interface MessageUpdatedEvent {
  conversationId: string;
  message: Message;
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
