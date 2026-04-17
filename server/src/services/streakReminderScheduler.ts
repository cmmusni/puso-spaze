// ─────────────────────────────────────────────
// src/services/streakReminderScheduler.ts
// Push notification 3 hours before midnight (PHT)
// for users who haven't opened the HomeScreen today
// and have an active streak at risk of breaking.
// ─────────────────────────────────────────────

import cron from 'node-cron';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { createNotification } from './notificationService';

const STREAK_PROMPTS = [
  "Don't lose your streak! Open PUSO Spaze before the day ends 🔥",
  "Your streak is at risk! Check in now to keep it going 💪",
  "3 hours left today — visit your Feed to keep your streak alive 🙏",
  "Hey, you haven't checked in today! Your streak is about to reset ⏰",
  "Keep the fire burning! Open the app to continue your streak 🔥",
];

function getRandomPrompt(): string {
  return STREAK_PROMPTS[Math.floor(Math.random() * STREAK_PROMPTS.length)];
}

/**
 * Sends streak reminder notifications to users who:
 * 1. Have an active streak (streakCount > 0)
 * 2. Haven't visited the HomeScreen today (lastStreakDate < today)
 * 3. Have notifications enabled and a push token
 */
async function sendStreakReminders(): Promise<void> {
  try {
    const todayMidnight = new Date();
    todayMidnight.setUTCHours(0, 0, 0, 0);

    // Find users with an active streak who haven't visited today
    const users = await prisma.user.findMany({
      where: {
        streakCount: { gt: 0 },
        notificationsEnabled: true,
        OR: [
          { lastStreakDate: { lt: todayMidnight } },
          { lastStreakDate: null },
        ],
        AND: [
          {
            OR: [
              { expoPushToken: { not: null } },
              { webPushSubscription: { not: Prisma.DbNull } },
            ],
          },
        ],
      },
      select: { id: true, streakCount: true },
    });

    if (users.length === 0) {
      console.log('📭 No users at risk of losing their streak');
      return;
    }

    console.log(`🔥 Sending streak reminders to ${users.length} user(s)...`);

    const results = await Promise.allSettled(
      users.map((user) =>
        createNotification({
          userId: user.id,
          type: 'SYSTEM',
          title: `🔥 ${user.streakCount}-Day Streak at Risk!`,
          body: getRandomPrompt(),
          data: { screen: 'Home' },
        })
      )
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(`✅ Streak reminders sent: ${succeeded} succeeded, ${failed} failed`);
  } catch (error) {
    console.error('❌ Failed to send streak reminders:', error);
  }
}

/**
 * Starts the streak reminder scheduler.
 * Runs every day at 9:00 PM PHT (13:00 UTC) — 3 hours before midnight PHT.
 */
export function startStreakReminderScheduler(): void {
  const schedule = '0 13 * * *'; // Every day at 1:00 PM UTC = 9:00 PM PHT

  cron.schedule(schedule, async () => {
    await sendStreakReminders();
  });

  console.log('🔥 Streak reminder scheduler started (runs daily at 9:00 PM PHT / 1:00 PM UTC)');
}
