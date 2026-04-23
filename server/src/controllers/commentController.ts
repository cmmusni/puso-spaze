// ─────────────────────────────────────────────
// src/controllers/commentController.ts
// POST /api/posts/:postId/comments — add comment
// GET  /api/posts/:postId/comments — list comments
// DELETE /api/posts/:postId/comments/:commentId — delete own comment (or any comment if admin)
// ─────────────────────────────────────────────

import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { moderateContent } from '../services/moderationService';
import { notifyComment, createNotification, notifyCoachesOfFlaggedContent } from '../services/notificationService';
import { notifyMentionsInComment } from '../services/mentionService';
import { generateAnonUsername } from '../utils/generateAnonUsername';
import { stripHtmlTags } from '../utils/sanitize';

// ── POST /api/posts/:postId/comments ─────────
export async function createComment(req: Request, res: Response): Promise<void> {
  const { postId } = req.params;
  const { userId, content: rawContent, parentId } = req.body as { userId: string; content: string; parentId?: string };
  // BUG-007 fix: Strip HTML tags
  const content = stripHtmlTags(rawContent ?? '');

  if (!userId || !content?.trim()) {
    res.status(400).json({ error: 'userId and content are required.' });
    return;
  }

  if (content.trim().length < 1) {
    res.status(400).json({ error: 'Comment must be at least 1 character.' });
    return;
  }

  if (content.trim().length > 500) {
    res.status(400).json({ error: 'Comment must be 500 characters or fewer.' });
    return;
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) { res.status(404).json({ error: 'Post not found.' }); return; }

  // ── Check anonymous mode ──────────────────
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAnonymous: true, avatarUrl: true, anonDisplayName: true } });
  if (!user) { res.status(404).json({ error: 'User not found.' }); return; }
  const commentIsAnonymous = user.isAnonymous;

  // Use the user's persistent anonymous name, generating one if needed
  let anonDisplayName: string | null = null;
  if (commentIsAnonymous) {
    if (user.anonDisplayName) {
      anonDisplayName = user.anonDisplayName;
    } else {
      anonDisplayName = generateAnonUsername();
      await prisma.user.update({ where: { id: userId }, data: { anonDisplayName } });
    }
  }

  // ── AI Moderation ────────────────────────
  let moderationStatus: 'SAFE' | 'FLAGGED' | 'REVIEW';
  try {
    moderationStatus = await moderateContent(content.trim());
  } catch {
    moderationStatus = 'REVIEW';
  }

  try {
    const comment = await prisma.comment.create({
      data: {
        postId,
        userId,
        content: content.trim(),
        moderationStatus,
        isAnonymous: commentIsAnonymous,
        anonDisplayName,
        ...(parentId ? { parentId } : {}),
      },
      include: { user: { select: { displayName: true } } },
    });

    // Send notification to post author (async, don't await)
    if (moderationStatus === 'SAFE') {
      // QUALITY.md Scenario 4: Use anonDisplayName for anonymous comments
      const notifyName = commentIsAnonymous
        ? (anonDisplayName ?? 'Anonymous')
        : comment.user.displayName;

      notifyComment({
        postId,
        commentId: comment.id,
        postAuthorId: post.userId,
        commenterId: userId,
        commenterName: notifyName,
        commentPreview: content.trim(),
        actorAvatarUrl: commentIsAnonymous ? null : (user.avatarUrl ?? null),
      }).catch((err) => console.error('Failed to send comment notification:', err));

      notifyMentionsInComment({
        postId,
        commentId: comment.id,
        commentAuthorId: userId,
        commentAuthorName: notifyName,
        content: content.trim(),
      }).catch((err) => console.error('Failed to send mention notifications:', err));
    }

    const flagged = moderationStatus === 'FLAGGED';
    const underReview = moderationStatus === 'REVIEW';

    if (flagged) {
      notifyCoachesOfFlaggedContent({
        contentType: 'comment',
        contentId: comment.id,
        postId,
        contentPreview: content.trim(),
        authorId: userId,
      }).catch((err) => console.error('Failed to notify coaches of flagged comment:', err));
    }

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
  const requestUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;

  const reactionInclude = {
    reactions: {
      select: { type: true, userId: true },
    },
  };

  const comments = await prisma.comment.findMany({
    where: { postId, parentId: null, moderationStatus: { not: 'FLAGGED' } },
    orderBy: { createdAt: 'asc' },
    take: 100, // QUALITY.md Scenario 10: Enforce pagination limit
    include: {
      user: { select: { displayName: true, role: true, avatarUrl: true } },
      ...reactionInclude,
      replies: {
        where: { moderationStatus: { not: 'FLAGGED' } },
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { displayName: true, role: true, avatarUrl: true } },
          ...reactionInclude,
        },
      },
    },
  });

  const mapComment = (c: any) => {
    const reactionCounts: Record<string, number> = {};
    let userReaction: string | null = null;
    for (const r of c.reactions ?? []) {
      reactionCounts[r.type] = (reactionCounts[r.type] ?? 0) + 1;
      if (requestUserId && r.userId === requestUserId) {
        userReaction = r.type;
      }
    }

    return {
      id: c.id,
      postId: c.postId,
      userId: c.userId,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      moderationStatus: c.moderationStatus,
      isAnonymous: c.isAnonymous,
      anonDisplayName: c.anonDisplayName,
      parentId: c.parentId ?? null,
      user: c.isAnonymous
        ? { displayName: c.anonDisplayName ?? 'Anonymous', role: c.user.role }
        : c.user,
      reactionCounts: Object.keys(reactionCounts).length > 0 ? reactionCounts : undefined,
      userReaction,
      replies: c.replies?.map(mapComment),
    };
  };

  res.json({ comments: comments.map(mapComment) });
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

    // Notify author if deleted by admin (not self-delete)
    if (isAdmin && !isOwner) {
      createNotification({
        userId: comment.userId,
        type: 'SYSTEM',
        title: 'Comment Removed',
        body: 'Your comment was removed by a moderator. Please ensure your messages follow community guidelines.',
        data: { postId: comment.postId },
      }).catch(() => {});
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
  const { userId, content: rawContent } = req.body as { userId: string; content: string };
  // BUG-007 fix: Strip HTML tags
  const content = stripHtmlTags(rawContent ?? '');

  if (!userId || !content?.trim()) {
    res.status(400).json({ error: 'userId and content are required.' });
    return;
  }

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { user: { select: { displayName: true, role: true, avatarUrl: true } } },
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
      include: { user: { select: { displayName: true, role: true, avatarUrl: true } } },
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

// ── POST /api/posts/:postId/comments/:commentId/reactions ──
export async function upsertCommentReaction(req: Request, res: Response): Promise<void> {
  const { commentId } = req.params;
  const { userId, type } = req.body as { userId: string; type: string };

  if (!userId || !type) {
    res.status(400).json({ error: 'userId and type are required.' });
    return;
  }

  try {
    const existing = await prisma.commentReaction.findUnique({
      where: { commentId_userId: { commentId, userId } },
    });

    if (existing && existing.type === type) {
      // Same type → remove (toggle off)
      await prisma.commentReaction.delete({ where: { id: existing.id } });
      res.json({ removed: true });
      return;
    }

    // Upsert (replace or create)
    const reaction = await prisma.commentReaction.upsert({
      where: { commentId_userId: { commentId, userId } },
      update: { type: type as any },
      create: { commentId, userId, type: type as any },
    });

    res.json({ removed: false, type: reaction.type, reaction: { id: reaction.id, type: reaction.type } });
  } catch (error) {
    console.error('Error upserting comment reaction:', error);
    res.status(500).json({ error: 'Failed to react to comment.' });
  }
}
