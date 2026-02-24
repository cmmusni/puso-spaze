// ─────────────────────────────────────────────
// src/controllers/coachController.ts
// PUSO Coach actions: review queue + moderation
// All routes require a valid coachId for a USER with role COACH or ADMIN
// ─────────────────────────────────────────────

import { Request, Response } from 'express';
import { prisma } from '../config/db';

// ── Helpers ───────────────────────────────────

async function verifyCoach(coachId: string): Promise<boolean> {
  if (!coachId) return false;
  const user = await prisma.user.findUnique({ where: { id: coachId } });
  return user?.role === 'COACH' || user?.role === 'ADMIN';
}

// ── Controllers ───────────────────────────────

/**
 * GET /api/coach/review?coachId=...
 *
 * Returns all REVIEW-status posts and comments for the coach dashboard.
 */
export async function getReviewQueue(req: Request, res: Response): Promise<void> {
  const coachId = req.query.coachId as string;

  if (!(await verifyCoach(coachId))) {
    res.status(403).json({ error: 'Access denied. PUSO Coach account required.' });
    return;
  }

  try {
    const [posts, comments] = await Promise.all([
      prisma.post.findMany({
        where: { moderationStatus: 'REVIEW' },
        include: { user: { select: { displayName: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.comment.findMany({
        where: { moderationStatus: 'REVIEW' },
        include: {
          user: { select: { displayName: true, role: true } },
          post: { select: { id: true, content: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    res.json({ posts, comments });
  } catch (err) {
    console.error('[CoachController] getReviewQueue error:', err);
    res.status(500).json({ error: 'Failed to fetch review queue.' });
  }
}

/**
 * PATCH /api/coach/posts/:id/moderate
 * Body: { coachId: string; action: 'approve' | 'reject' }
 *
 * approve → SAFE ; reject → FLAGGED
 */
export async function moderatePost(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { coachId, action } = req.body as { coachId: string; action: 'approve' | 'reject' };

  if (!(await verifyCoach(coachId))) {
    res.status(403).json({ error: 'Access denied. PUSO Coach account required.' });
    return;
  }

  if (action !== 'approve' && action !== 'reject') {
    res.status(400).json({ error: "action must be 'approve' or 'reject'." });
    return;
  }

  try {
    const post = await prisma.post.update({
      where: { id },
      data: { moderationStatus: action === 'approve' ? 'SAFE' : 'FLAGGED' },
    });
    res.json({ post, action });
  } catch (err) {
    console.error('[CoachController] moderatePost error:', err);
    res.status(500).json({ error: 'Failed to moderate post.' });
  }
}

/**
 * PATCH /api/coach/comments/:id/moderate
 * Body: { coachId: string; action: 'approve' | 'reject' }
 */
export async function moderateComment(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { coachId, action } = req.body as { coachId: string; action: 'approve' | 'reject' };

  if (!(await verifyCoach(coachId))) {
    res.status(403).json({ error: 'Access denied. PUSO Coach account required.' });
    return;
  }

  if (action !== 'approve' && action !== 'reject') {
    res.status(400).json({ error: "action must be 'approve' or 'reject'." });
    return;
  }

  try {
    const comment = await prisma.comment.update({
      where: { id },
      data: { moderationStatus: action === 'approve' ? 'SAFE' : 'FLAGGED' },
    });
    res.json({ comment, action });
  } catch (err) {
    console.error('[CoachController] moderateComment error:', err);
    res.status(500).json({ error: 'Failed to moderate comment.' });
  }
}
