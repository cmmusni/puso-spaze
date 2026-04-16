// ─────────────────────────────────────────────
// src/controllers/reactionController.ts
// POST   /api/posts/:postId/reactions  — toggle reaction
// GET    /api/posts/:postId/reactions  — get reaction counts
// DELETE /api/posts/:postId/reactions  — remove own reaction
// ─────────────────────────────────────────────

import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { ReactionType } from '@prisma/client';
import { notifyReaction } from '../services/notificationService';

// ── POST /api/posts/:postId/reactions ─────────
export async function upsertReaction(req: Request, res: Response): Promise<void> {
  const { postId } = req.params;
  const { userId, type } = req.body as { userId: string; type: string };

  if (!userId || !type) {
    res.status(400).json({ error: 'userId and type are required.' });
    return;
  }

  if (!Object.values(ReactionType).includes(type as ReactionType)) {
    res.status(400).json({ error: `Invalid reaction type. Must be one of: ${Object.values(ReactionType).join(', ')}` });
    return;
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) { res.status(404).json({ error: 'Post not found.' }); return; }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) { res.status(404).json({ error: 'User not found.' }); return; }

  // BUG-001 fix: Wrap in try/catch to handle race conditions from concurrent
  // reactions by the same user. Prisma unique constraint errors (P2002) and
  // record-not-found errors (P2025) are caught gracefully instead of crashing.
  try {
    // Check if user already reacted
    const existing = await prisma.reaction.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    // Toggle: same type → remove; different type → update
    if (existing?.type === (type as ReactionType)) {
      await prisma.reaction.delete({ where: { postId_userId: { postId, userId } } });
      res.json({ removed: true, type });
      return;
    }

    const reaction = await prisma.reaction.upsert({
      where: { postId_userId: { postId, userId } },
      update: { type: type as ReactionType },
      create: { postId, userId, type: type as ReactionType },
    });

    // Send notification to post author (async, don't await)
    notifyReaction({
      postId,
      postAuthorId: post.userId,
      reactorId: userId,
      reactorName: user.displayName,
      reactionType: type,
      actorAvatarUrl: user.avatarUrl ?? null,
    }).catch((err) => console.error('Failed to send reaction notification:', err));

    res.status(201).json({ removed: false, reaction: { id: reaction.id, type: reaction.type } });
  } catch (error: any) {
    // P2002 = unique constraint violation (concurrent create race)
    // P2025 = record not found (concurrent delete race)
    if (error.code === 'P2002' || error.code === 'P2025') {
      res.status(409).json({ error: 'Reaction conflict — please try again.' });
      return;
    }
    console.error('Error upserting reaction:', error);
    res.status(500).json({ error: 'Failed to react to post.' });
  }
}

// ── GET /api/posts/:postId/reactions ──────────
export async function getReactions(req: Request, res: Response): Promise<void> {
  const { postId } = req.params;
  const { userId } = req.query as { userId?: string };

  const reactions = await prisma.reaction.groupBy({
    by: ['type'],
    where: { postId },
    _count: { type: true },
  });

  const counts: Record<string, number> = {};
  for (const r of reactions) {
    counts[r.type] = r._count.type;
  }

  // If userId provided, also return what the current user reacted with
  let userReaction: string | null = null;
  if (userId) {
    const mine = await prisma.reaction.findUnique({
      where: { postId_userId: { postId, userId } },
    });
    userReaction = mine?.type ?? null;
  }

  res.json({ counts, userReaction });
}
