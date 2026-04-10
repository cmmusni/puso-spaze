// ─────────────────────────────────────────────
// src/services/reflectionReminderScheduler.ts
// Daily push notification reminding users to reflect/journal
// ─────────────────────────────────────────────

import cron from 'node-cron';
import { prisma } from '../config/db';
import { createNotification } from './notificationService';

const REFLECTION_PROMPTS = [
  'Take a moment to reflect on your day. What are you grateful for?',
  'Your safe space is waiting. How are you feeling today?',
  'A few minutes of reflection can make all the difference. Write it down.',
  'Pause, breathe, reflect. Your journal is ready when you are.',
  "What's on your heart today? Take a moment to write it out.",
  "Growth happens in the quiet moments. Ready for today's reflection?",
  'Your feelings matter. Take a few minutes to check in with yourself.',
  'Every reflection brings you closer to peace. Start writing today.',
];

function getRandomPrompt(): string {
  return REFLECTION_PROMPTS[Math.floor(Math.random() * REFLECTION_PROMPTS.length)];
}

/**
 * Sends daily reflection reminder notifications to opted-in users
 */
async function sendReflectionReminders(): Promise<void> {
  try {
    // Get all users who have notifications enabled and a push token
    const users = await prisma.user.findMany({
      where: {
        notificationsEnabled: true,
        expoPushToken: { not: null },
        id: { not: 'system-encouragement-bot' },
      },
      select: { id: true },
    });

    if (users.length === 0) {
      console.log('📭 No users opted in for reflection reminders');
      return;
    }

    console.log(`🔔 Sending reflection reminders to ${users.length} user(s)...`);

    const prompt = getRandomPrompt();

    // Send notification to each user
    const results = await Promise.allSettled(
      users.map((user) =>
        createNotification({
          userId: user.id,
          type: 'ENCOURAGEMENT',
          title: '✨ Daily Reflection',
          body: prompt,
          data: { screen: 'Journal' },
        })
      )
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(`✅ Reflection reminders sent: ${succeeded} succeeded, ${failed} failed`);
  } catch (error) {
    console.error('❌ Failed to send reflection reminders:', error);
  }
}

/**
 * Starts the daily reflection reminder scheduler
 * Runs every day at 9:00 AM server time
 */
export function startReflectionReminderScheduler(): void {
  const schedule = '0 9 * * *'; // Every day at 9:00 AM

  cron.schedule(schedule, async () => {
    await sendReflectionReminders();
  });

  console.log('🔔 Reflection reminder scheduler started (runs daily at 9:00 AM)');
}
