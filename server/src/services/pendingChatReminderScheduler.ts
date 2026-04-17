// ─────────────────────────────────────────────
// src/services/pendingChatReminderScheduler.ts
// Reminds coaches when a member message has been
// waiting for a reply for over 1 hour.
// ─────────────────────────────────────────────

import cron from 'node-cron';
import { prisma } from '../config/db';
import { createNotification } from './notificationService';

// Track which conversation+message combos we already reminded about
// so we don't spam coaches with duplicate reminders.
const remindedSet = new Set<string>();

/**
 * Finds conversations where the last message was sent by the member
 * (not the coach) more than 1 hour ago and notifies the coach.
 */
async function checkPendingChats(): Promise<void> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Get all conversations that have at least one message
    const conversations = await prisma.conversation.findMany({
      where: {
        messages: { some: {} },
      },
      include: {
        user: { select: { displayName: true } },
        coach: { select: { displayName: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    let sent = 0;

    for (const conv of conversations) {
      const lastMsg = conv.messages[0];
      if (!lastMsg) continue;

      // Only remind if the last message is from the member (not the coach)
      if (lastMsg.senderId === conv.coachId) continue;

      // Only remind if the message is older than 1 hour
      if (lastMsg.createdAt > oneHourAgo) continue;

      // Don't send duplicate reminders for the same message
      const key = `${conv.id}:${lastMsg.id}`;
      if (remindedSet.has(key)) continue;

      const memberName = conv.user?.displayName ?? 'A member';

      await createNotification({
        userId: conv.coachId,
        type: 'MESSAGE',
        title: `💬 Pending message from ${memberName}`,
        body: `${memberName} has been waiting for your reply for over an hour. Tap to respond.`,
        data: { conversationId: conv.id },
      });

      remindedSet.add(key);
      sent++;
    }

    if (sent > 0) {
      console.log(`[PendingChatReminder] Sent ${sent} reminder(s) to coaches`);
    }
  } catch (error) {
    console.error('[PendingChatReminder] Error:', error);
  }
}

/**
 * Starts the pending chat reminder scheduler.
 * Checks every 15 minutes for conversations awaiting a coach reply.
 */
export function startPendingChatReminderScheduler(): void {
  cron.schedule('*/15 * * * *', async () => {
    await checkPendingChats();
  });

  console.log('💬 Pending chat reminder scheduler started (checks every 15 min)');
}
