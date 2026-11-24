import { supabase } from '@/lib/supabase';

export async function sendNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  link?: string,
): Promise<void> {
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      body,
      link: link || null,
    });
  } catch (err) {
    console.warn('[Notifications] Failed to send:', err);
  }
}

export async function notifyMention(
  mentionedUserId: string,
  fromHandle: string,
  chatLink?: string,
): Promise<void> {
  await sendNotification(
    mentionedUserId,
    'mention',
    `You were mentioned by ${fromHandle}`,
    `${fromHandle} tagged you in General Chat.`,
    chatLink || 'chat',
  );
}

export async function notifyReply(
  repliedToUserId: string,
  fromHandle: string,
  replyPreview: string,
): Promise<void> {
  await sendNotification(
    repliedToUserId,
    'reply',
    `${fromHandle} replied to your message`,
    replyPreview.substring(0, 100),
    'chat',
  );
}

export async function notifyBan(
  bannedUserId: string,
  actorHandle: string,
  banType: string,
  reason: string,
  expiresAt?: string,
): Promise<void> {
  const expiryText = expiresAt ? ` Expires: ${new Date(expiresAt).toLocaleString()}.` : '';
  await sendNotification(
    bannedUserId,
    'ban',
    `You have been ${banType === 'permanent' ? 'permanently banned' : 'temporarily banned'}`,
    `Reason: ${reason}.${expiryText} Action by ${actorHandle}.`,
  );
}

export async function notifyTimeout(
  timedOutUserId: string,
  actorHandle: string,
  reason: string,
  expiresAt: string,
): Promise<void> {
  await sendNotification(
    timedOutUserId,
    'timeout',
    'You have been timed out in General Chat',
    `Reason: ${reason}. Expires: ${new Date(expiresAt).toLocaleString()}. Action by ${actorHandle}.`,
    'chat',
  );
}

export async function notifyUnban(
  unbannedUserId: string,
  actorHandle: string,
): Promise<void> {
  await sendNotification(
    unbannedUserId,
    'unban',
    'Your ban has been lifted',
    `Your ban was removed by ${actorHandle}. You can access community features again.`,
  );
}

export async function notifyTimeoutRemoved(
  userId: string,
  actorHandle: string,
): Promise<void> {
  await sendNotification(
    userId,
    'timeout_removed',
    'Your chat timeout has been removed',
    `Your timeout was lifted by ${actorHandle}. You can send messages again.`,
    'chat',
  );
}

export async function notifyRoleChange(
  userId: string,
  actorHandle: string,
  newRole: string,
  isGrant: boolean,
): Promise<void> {
  await sendNotification(
    userId,
    'role_change',
    isGrant ? `You received the role: ${newRole}` : `Your role was changed to ${newRole}`,
    isGrant
      ? `${actorHandle} assigned you the role of ${newRole}.`
      : `${actorHandle} changed your role to ${newRole}.`,
  );
}

