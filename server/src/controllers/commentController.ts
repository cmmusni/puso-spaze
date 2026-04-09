// ─────────────────────────────────────────────
// src/controllers/commentController.ts
// POST /api/posts/:postId/comments — add comment
// GET  /api/posts/:postId/comments — list comments
// DELETE /api/posts/:postId/comments/:commentId — delete own comment (or any comment if admin)
// ─────────────────────────────────────────────

import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { moderateContent } from '../services/moderationService';
import { notifyComment } from '../services/notificationService';
import { notifyMentionsInComment } from '../services/mentionService';
import { generateAnonUsername } from '../utils/generateAnonUsername';

// ── POST /api/posts/:postId/comments ─────────
export async function createComment(req: Request, res: Response): Promise<void> {
  const { postId } = req.params;
  const { userId, content } = req.body as { userId: string; content: string };

  if (!userId || !content?.trim()) {
    res.status(400).json({ error: 'userId and content are required.' });
    return;
  }

  if (content.trim().length > 500) {
    res.status(400).json({ error: 'Comment must be 500 characters or fewer.' });
    return;
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) { res.status(404).json({ error: 'Post not found.' }); return; }

  // ── Check anonymous mode ──────────────────
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAnonymous: true } });
  if (!user) { res.status(404).json({ error: 'User not found.' }); return; }
  const commentIsAnonymous = user.isAnonymous;
  const anonDisplayName = commentIsAnonymous ? generateAnonUsername() : null;

  // ── AI Moderation ────────────────────────
  let moderationStatus: 'SAFE' | 'FLAGGED' | 'REVIEW';
  try {
    moderationStatus = await moderateContent(content.trim());
  } catch {
    moderationStatus = 'REVIEW';
  }

  try {
    const comment = await prisma.comment.create({
      data: { postId, userId, content: content.trim(), moderationStatus, isAnonymous: commentIsAnonymous, anonDisplayName },
      include: { user: { select: { displayName: true } } },
    });

    // Send notification to post author (async, don't await)
    if (moderationStatus === 'SAFE') {
      notifyComment({
        postId,
        postAuthorId: post.userId,
        commenterId: userId,
        commenterName: comment.user.displayName,
        commentPreview: content.trim(),
      }).catch((err) => console.error('Failed to send comment notification:', err));

      notifyMentionsInComment({
        postId,
        commentId: comment.id,
        commentAuthorId: userId,
        commentAuthorName: comment.user.displayName,
        content: content.trim(),
      }).catch((err) => console.error('Failed to send mention notifications:', err));
    }

    const flagged = moderationStatus === 'FLAGGED';
    const underReview = moderationStatus === 'REVIEW';

    res.status(201).json({
      comment: {
        id: comment.id,
        postId: comment.postId,
        userId: comment.userId,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        moderationStatus: comment.moderationStatus,
        isAnonymous: comment.isAnonymous,
        anonDisplayName: comment.anonDisplayName,
        user: comment.isAnonymous
          ? { displayName: comment.anonDisplayName ?? 'Anonymous' }
          : comment.user,
      },
      flagged,
      underReview,
    });
  } catch (error: any) {
    // Handle foreign key constraint error (user doesn't exist)
    if (error.code === 'P2003') {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment.' });
  }
}

// ── GET /api/posts/:postId/comments ──────────
export async function getComments(req: Request, res: Response): Promise<void> {
  const { postId } = req.params;

  const comments = await prisma.comment.findMany({
    where: { postId, moderationStatus: { not: 'FLAGGED' } },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { displayName: true, role: true } } },
  });

  res.json({
    comments: comments.map((c) => ({
      id: c.id,
      postId: c.postId,
      userId: c.userId,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      moderationStatus: c.moderationStatus,
      isAnonymous: c.isAnonymous,
      anonDisplayName: c.anonDisplayName,
      user: c.isAnonymous
        ? { displayName: c.anonDisplayName ?? 'Anonymous', role: c.user.role }
        : c.user,
    })),
  });
}

// ── DELETE /api/posts/:postId/comments/:commentId ──────────
export async function deleteComment(req: Request, res: Response): Promise<void> {
  const { postId, commentId } = req.params;
  const bodyUserId = (req.body as { userId?: string })?.userId;
  const queryUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  const userId = bodyUserId ?? queryUserId;

  if (!userId || !/^[0-9a-fA-F-]{36}$/.test(userId)) {
    res.status(400).json({ error: 'A valid userId is required.' });
    return;
  }

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, postId: true, userId: true },
    });

    if (!comment || comment.postId !== postId) {
      res.status(404).json({ error: 'Comment not found.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const isOwner = comment.userId === userId;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'You do not have permission to delete this comment.' });
      return;
    }

    await prisma.comment.delete({ where: { id: commentId } });

    res.json({ success: true, message: 'Comment deleted successfully.' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment.' });
  }
}

export async function updateComment(req: Request, res: Response): Promise<void> {
  const { postId, commentId } = req.params;
  const { userId, content } = req.body as { userId: string; content: string };

  if (!userId || !content?.trim()) {
    res.status(400).json({ error: 'userId and content are required.' });
    return;
  }

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { user: { select: { displayName: true, role: true } } },
    });

    if (!comment || comment.postId !== postId) {
      res.status(404).json({ error: 'Comment not found.' });
      return;
    }

    if (comment.userId !== userId) {
      res.status(403).json({ error: 'You can only edit your own comment.' });
      return;
    }

    let moderationStatus: 'SAFE' | 'FLAGGED' | 'REVIEW';
    try {
      moderationStatus = await moderateContent(content.trim());
    } catch {
      moderationStatus = 'REVIEW';
    }

    if (moderationStatus === 'FLAGGED') {
      res.status(400).json({
        error: 'Your updated comment was flagged by our safety system. Please revise it.',
        flagged: true,
      });
      return;
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content: content.trim(),
        moderationStatus,
      },
      include: { user: { select: { displayName: true, role: true } } },
    });

    if (moderationStatus === 'SAFE') {
      notifyMentionsInComment({
        postId,
        commentId: updated.id,
        commentAuthorId: updated.userId,
        commentAuthorName: updated.user.displayName,
        content: updated.content,
      }).catch((err) => console.error('Failed to send mention notifications:', err));
    }

    res.json({
      comment: {
        id: updated.id,
        postId: updated.postId,
        userId: updated.userId,
        content: updated.content,
        createdAt: updated.createdAt.toISOString(),
        moderationStatus: updated.moderationStatus,
        isAnonymous: updated.isAnonymous,
        anonDisplayName: updated.anonDisplayName,
        user: updated.isAnonymous
          ? { displayName: updated.anonDisplayName ?? 'Anonymous', role: updated.user.role }
          : updated.user,
      },
      flagged: false,
      underReview: moderationStatus === 'REVIEW',
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ error: 'Failed to update comment.' });
  }
}
