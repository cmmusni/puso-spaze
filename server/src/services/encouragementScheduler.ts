// ─────────────────────────────────────────────
// src/services/encouragementScheduler.ts
// Hourly scheduler for AI-generated biblical encouragements
// ─────────────────────────────────────────────

import cron from 'node-cron';
import { prisma } from '../config/db';
import { generateBiblicalEncouragement } from './biblicalEncouragementService';
import { moderateContent } from './moderationService';
import { notifyNewEncouragement } from './notificationService';
import { getHourlyHopeConfig } from './appConfigService';

const SYSTEM_USER_ID = 'system-encouragement-bot';
const SYSTEM_USER_DISPLAY_NAME = 'Hourly Hope';

/**
 * Ensures the system user exists for posting encouragements
 */
async function ensureSystemUser(): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { id: SYSTEM_USER_ID },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        id: SYSTEM_USER_ID,
        displayName: SYSTEM_USER_DISPLAY_NAME,
        role: 'ADMIN', // Admin role so posts are clearly official
      },
    });
    console.log('✅ Created system user for encouragement posts');
  }
}

/**
 * Generates and posts a biblical encouragement
 */
async function postEncouragement(): Promise<void> {
  try {
    const { postingEnabled } = await getHourlyHopeConfig();
    if (!postingEnabled) {
      console.log('⏸️ Hourly Hope is paused; skipping scheduled encouragement post.');
      return;
    }

    console.log('🌟 Generating hourly biblical encouragement...');

    // Ensure system user exists
    await ensureSystemUser();

    // Generate the encouragement message
    const content = await generateBiblicalEncouragement();

    // Moderate the content (should always be SAFE, but just in case)
    // QUALITY.md Scenario 3: If moderation fails, default to REVIEW
    // so a human can verify before it reaches the feed.
    let moderationStatus: 'SAFE' | 'FLAGGED' | 'REVIEW';
    try {
      moderationStatus = await moderateContent(content);
    } catch {
      moderationStatus = 'REVIEW'; // Don't auto-approve on moderation failure
    }

    // Create the post
    const post = await prisma.post.create({
      data: {
        content,
        userId: SYSTEM_USER_ID,
        moderationStatus,
        tags: ['encouragement', 'daily', 'scripture'],
      },
      include: {
        user: { select: { displayName: true } },
      },
    });

    console.log('✅ Posted encouragement:', {
      id: post.id,
      preview: content.substring(0, 80) + '...',
      time: new Date().toISOString(),
    });

    // Only notify users if the encouragement was verified SAFE
    if (moderationStatus === 'SAFE') {
      notifyNewEncouragement({
        postId: post.id,
        preview: content,
      }).catch((err) => console.error('Failed to send encouragement notifications:', err));
    } else {
      console.warn(`[Encouragement] Post ${post.id} created with status ${moderationStatus} — notifications withheld until approved.`);
    }
  } catch (error) {
    console.error('❌ Failed to post encouragement:', error);
  }
}

/**
 * Starts the hourly encouragement scheduler
 * Runs at the top of every hour (e.g., 9:00, 10:00, 11:00)
 */
export function startEncouragementScheduler(): void {
  // Run at the start of every hour: '0 * * * *'
  // For testing: '*/5 * * * *' (every 5 minutes)
  const schedule = '0 * * * *'; // Every hour at :00

  cron.schedule(schedule, async () => {
    await postEncouragement();
  });

  console.log('🕐 Encouragement scheduler started (runs every hour)');

  // Optional: Post one immediately on startup
  // Uncomment the line below to post an encouragement when the server starts
  // postEncouragement().catch(console.error);
}

/**
 * Manual trigger for testing purposes
 * Can be called from an admin endpoint
 */
export async function triggerEncouragementNow(): Promise<void> {
  const { postingEnabled } = await getHourlyHopeConfig();
  if (!postingEnabled) {
    throw new Error('Hourly Hope is currently paused by admin setting.');
  }

  await postEncouragement();
}
