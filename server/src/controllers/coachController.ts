// ─────────────────────────────────────────────
// src/controllers/coachController.ts
// PUSO Coach actions: review queue + moderation
// All routes require a valid coachId for a USER with role COACH or ADMIN
// ─────────────────────────────────────────────

import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { createNotification } from '../services/notificationService';

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
        where: { moderationStatus: { in: ['REVIEW', 'FLAGGED'] } },
        include: { user: { select: { displayName: true, role: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.comment.findMany({
        where: { moderationStatus: { in: ['REVIEW', 'FLAGGED'] } },
        include: {
          user: { select: { displayName: true, role: true, avatarUrl: true } },
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

    // Notify the post author
    if (action === 'approve') {
      createNotification({
        userId: post.userId,
        type: 'SYSTEM',
        title: 'Post Approved',
        body: 'Your post has been reviewed and approved. It is now visible to the community.',
        data: { postId: post.id, screen: 'Home' },
      }).catch(() => {});
    } else {
      createNotification({
        userId: post.userId,
        type: 'SYSTEM',
        title: 'Post Rejected',
        body: 'Your post was not approved. Please ensure your messages follow community guidelines.',
        data: { postId: post.id, screen: 'Home' },
      }).catch(() => {});
    }

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

    // Notify the comment author
    if (action === 'approve') {
      createNotification({
        userId: comment.userId,
        type: 'SYSTEM',
        title: 'Comment Approved',
        body: 'Your comment has been reviewed and approved. It is now visible to the community.',
        data: { postId: comment.postId, commentId: comment.id },
      }).catch(() => {});
    } else {
      createNotification({
        userId: comment.userId,
        type: 'SYSTEM',
        title: 'Comment Rejected',
        body: 'Your comment was not approved. Please ensure your messages follow community guidelines.',
        data: { postId: comment.postId, commentId: comment.id },
      }).catch(() => {});
    }

    res.json({ comment, action });
  } catch (err) {
    console.error('[CoachController] moderateComment error:', err);
    res.status(500).json({ error: 'Failed to moderate comment.' });
  }
}

/**
 * PATCH /api/coach/posts/:id/flag
 * Body: { coachId: string }
 *
 * Flag a SAFE post (moves it to FLAGGED status)
 */
export async function flagPost(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { coachId } = req.body as { coachId: string };

  if (!(await verifyCoach(coachId))) {
    res.status(403).json({ error: 'Access denied. PUSO Coach account required.' });
    return;
  }

  try {
    const post = await prisma.post.findUnique({ where: { id } });
    
    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    // Update post to FLAGGED status
    const updatedPost = await prisma.post.update({
      where: { id },
      data: { moderationStatus: 'FLAGGED' },
    });

    // Notify the post author
    createNotification({
      userId: post.userId,
      type: 'SYSTEM',
      title: 'Post Flagged',
      body: 'Your post was flagged by a coach for review. Please ensure your messages follow community guidelines.',
      data: { postId: post.id, screen: 'Home' },
    }).catch(() => {});

    res.json({ post: updatedPost, message: 'Post flagged successfully.' });
  } catch (err) {
    console.error('[CoachController] flagPost error:', err);
    res.status(500).json({ error: 'Failed to flag post.' });
  }
}

/**
 * PATCH /api/coach/comments/:id/flag
 * Body: { coachId: string }
 *
 * Flag a comment (moves it to FLAGGED status)
 */
export async function flagComment(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { coachId } = req.body as { coachId: string };

  if (!(await verifyCoach(coachId))) {
    res.status(403).json({ error: 'Access denied. PUSO Coach account required.' });
    return;
  }

  try {
    const comment = await prisma.comment.findUnique({ where: { id } });

    if (!comment) {
      res.status(404).json({ error: 'Comment not found.' });
      return;
    }

    const updatedComment = await prisma.comment.update({
      where: { id },
      data: { moderationStatus: 'FLAGGED' },
    });

    // Notify the comment author
    createNotification({
      userId: comment.userId,
      type: 'SYSTEM',
      title: 'Comment Flagged',
      body: 'Your comment was flagged by a coach for review. Please ensure your messages follow community guidelines.',
      data: { postId: comment.postId, commentId: comment.id, screen: 'Home' },
    }).catch(() => {});

    res.json({ comment: updatedComment, message: 'Comment flagged successfully.' });
  } catch (err) {
    console.error('[CoachController] flagComment error:', err);
    res.status(500).json({ error: 'Failed to flag comment.' });
  }
}

/**
 * GET /api/coach/members?coachId=...
 *
 * Returns all USER-role accounts sorted newest-first.
 * Used by the Coach Dashboard members panel.
 */
export async function getMembers(req: Request, res: Response): Promise<void> {
  const coachId = req.query.coachId as string;

  if (!(await verifyCoach(coachId))) {
    res.status(403).json({ error: 'Access denied. PUSO Coach account required.' });
    return;
  }

  try {
    const members = await prisma.user.findMany({
      where: { role: 'USER' },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ members });
  } catch (err) {
    console.error('[CoachController] getMembers error:', err);
    res.status(500).json({ error: 'Failed to fetch members.' });
  }
}
