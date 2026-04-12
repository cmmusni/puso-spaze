// ─────────────────────────────────────────────
// src/controllers/recoveryController.ts
// Self-service account recovery for locked-out users
// ─────────────────────────────────────────────

import { Request, Response } from 'express';
import { prisma } from '../config/db';

/**
 * POST /api/recovery-requests  (PUBLIC — no auth required)
 * Body: { displayName: string; reason: string }
 *
 * Creates a PENDING recovery request. The user is locked out
 * (cleared cache, lost device, no PIN) so they can't authenticate.
 */
export async function submitRecoveryRequest(req: Request, res: Response): Promise<void> {
  const { displayName, reason } = req.body as { displayName?: string; reason?: string };

  if (!displayName || displayName.trim().length < 2) {
    res.status(400).json({ error: 'A valid username is required.' });
    return;
  }
  if (!reason || reason.trim().length < 5) {
    res.status(400).json({ error: 'Please describe why you need recovery (at least 5 characters).' });
    return;
  }

  try {
    // Verify the claimed username actually exists
    const user = await prisma.user.findUnique({
      where: { displayName: displayName.trim() },
      select: { id: true },
    });
    if (!user) {
      res.status(404).json({ error: 'No account found with that username.' });
      return;
    }

    // Prevent duplicate pending requests for the same username
    const existing = await prisma.recoveryRequest.findFirst({
      where: { displayName: displayName.trim(), status: 'PENDING' },
    });
    if (existing) {
      res.status(409).json({ error: 'A recovery request for this account is already pending.' });
      return;
    }

    const request = await prisma.recoveryRequest.create({
      data: {
        displayName: displayName.trim(),
        reason: reason.trim(),
      },
    });

    res.status(201).json({ id: request.id, status: request.status });
  } catch (err) {
    console.error('[RecoveryController] submitRecoveryRequest error:', err);
    res.status(500).json({ error: 'Failed to submit recovery request.' });
  }
}

/**
 * GET /api/coach/recovery-requests?coachId=...  (requireAuth, coach/admin only)
 *
 * Returns PENDING recovery requests with the user's recent post/journal
 * history so the coach can verify identity.
 */
export async function getRecoveryRequests(req: Request, res: Response): Promise<void> {
  const coachId = req.query.coachId as string;

  if (!coachId) {
    res.status(400).json({ error: 'coachId is required.' });
    return;
  }

  // Verify the requester is a coach/admin
  const coach = await prisma.user.findUnique({ where: { id: coachId }, select: { role: true } });
  if (!coach || (coach.role !== 'COACH' && coach.role !== 'ADMIN')) {
    res.status(403).json({ error: 'Access denied. Coach account required.' });
    return;
  }

  try {
    const requests = await prisma.recoveryRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });

    // Enrich each request with the user's recent posts/journals for identity verification
    const enriched = await Promise.all(
      requests.map(async (r) => {
        const user = await prisma.user.findUnique({
          where: { displayName: r.displayName },
          select: { id: true, createdAt: true, role: true },
        });
        if (!user) {
          return { ...r, userHistory: { posts: [], journals: [], accountAge: null } };
        }

        const [recentPosts, recentJournals] = await Promise.all([
          prisma.post.findMany({
            where: { userId: user.id, moderationStatus: 'SAFE' },
            select: { content: true, createdAt: true, tags: true },
            orderBy: { createdAt: 'desc' },
            take: 5,
          }),
          prisma.journal.findMany({
            where: { userId: user.id },
            select: { title: true, mood: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 5,
          }),
        ]);

        return {
          ...r,
          userHistory: {
            posts: recentPosts,
            journals: recentJournals,
            accountAge: user.createdAt,
          },
        };
      })
    );

    res.json({ requests: enriched });
  } catch (err) {
    console.error('[RecoveryController] getRecoveryRequests error:', err);
    res.status(500).json({ error: 'Failed to load recovery requests.' });
  }
}

/**
 * PATCH /api/coach/recovery-requests/:id  (requireAuth, coach/admin only)
 * Body: { coachId: string; action: 'approve' | 'deny' }
 *
 * Approve = clear the user's device binding so they can re-login.
 * Deny   = mark the request as denied.
 */
export async function reviewRecoveryRequest(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { coachId, action } = req.body as { coachId?: string; action?: string };

  if (!coachId) {
    res.status(400).json({ error: 'coachId is required.' });
    return;
  }
  if (!action || !['approve', 'deny'].includes(action)) {
    res.status(400).json({ error: "action must be 'approve' or 'deny'." });
    return;
  }

  // Verify the requester is a coach/admin
  const coach = await prisma.user.findUnique({ where: { id: coachId }, select: { role: true } });
  if (!coach || (coach.role !== 'COACH' && coach.role !== 'ADMIN')) {
    res.status(403).json({ error: 'Access denied. Coach account required.' });
    return;
  }

  try {
    const request = await prisma.recoveryRequest.findUnique({ where: { id } });
    if (!request) {
      res.status(404).json({ error: 'Recovery request not found.' });
      return;
    }
    if (request.status !== 'PENDING') {
      res.status(409).json({ error: `Request has already been ${request.status.toLowerCase()}.` });
      return;
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'DENIED';

    // If approving, clear the user's device binding
    if (action === 'approve') {
      const user = await prisma.user.findUnique({
        where: { displayName: request.displayName },
        select: { id: true },
      });
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { deviceId: null },
        });
      }
    }

    const updated = await prisma.recoveryRequest.update({
      where: { id },
      data: {
        status: newStatus,
        reviewedBy: coachId,
        reviewedAt: new Date(),
      },
    });

    res.json({ request: updated });
  } catch (err) {
    console.error('[RecoveryController] reviewRecoveryRequest error:', err);
    res.status(500).json({ error: 'Failed to review recovery request.' });
  }
}
