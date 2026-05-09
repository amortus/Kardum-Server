export type MailStatus = 'unread' | 'read' | 'claimed' | 'expired';

export type MailAttachmentType = 'card_unlock';

export interface MailAttachmentCardUnlock {
  type: 'card_unlock';
  cardId: string;
}

export type MailAttachment = MailAttachmentCardUnlock;

export interface MailMessageRow {
  id: number;
  user_id: number;
  sender_admin_id: number | null;
  campaign_id: number | null;
  subject: string;
  body: string;
  status: MailStatus;
  deliver_at: string | Date;
  delivered_at: string | Date | null;
  read_at: string | Date | null;
  created_at: string | Date;
}

