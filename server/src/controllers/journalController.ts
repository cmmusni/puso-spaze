// ─────────────────────────────────────────────
// src/controllers/journalController.ts
// CRUD for private user journals
// ─────────────────────────────────────────────

import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { stripHtmlTags } from '../utils/sanitize';

// ── GET /api/journals?userId=... ─────────────
export async function getJournals(req: Request, res: Response): Promise<void> {
  const userId = req.query.userId as string;
  if (!userId) {
    res.status(400).json({ error: 'userId query param is required.' });
    return;
  }

  // BUG-008 fix: Verify JWT userId matches query param — journals are private
  if (req.user?.userId !== userId) {
    res.status(403).json({ error: 'You can only view your own journal entries.' });
    return;
  }

  const journals = await prisma.journal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50, // QUALITY.md Scenario 10: Enforce pagination limit
    include: { user: { select: { displayName: true, role: true, avatarUrl: true } } },
  });

  res.json({ journals });
}

// ── GET /api/journals/:journalId?userId=... ──
export async function getJournalById(req: Request, res: Response): Promise<void> {
  const { journalId } = req.params;
  const userId = req.query.userId as string;

  // BUG-008 fix: Verify JWT userId matches query param — journals are private
  if (req.user?.userId !== userId) {
    res.status(403).json({ error: 'You can only view your own journal entries.' });
    return;
  }

  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    include: { user: { select: { displayName: true, role: true, avatarUrl: true } } },
  });

  if (!journal) {
    res.status(404).json({ error: 'Journal entry not found.' });
    return;
  }

  if (journal.userId !== userId) {
    res.status(403).json({ error: 'You can only view your own journal entries.' });
    return;
  }

  res.json({ journal });
}

// ── POST /api/journals ───────────────────────
export async function createJournal(req: Request, res: Response): Promise<void> {
  const { userId, title: rawTitle, content: rawContent, mood, tags, isPublic } = req.body as {
    userId: string;
    title: string;
    content: string;
    mood?: string;
    tags?: string[];
    isPublic?: boolean;
  };
  // BUG-006 fix: Strip HTML tags from journal title and content
  const title = stripHtmlTags(rawTitle ?? '');
  const content = stripHtmlTags(rawContent ?? '');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const journal = await prisma.journal.create({
    data: {
      userId,
      title,
      content,
      mood: mood ?? null,
      tags: tags ?? [],
      isPublic: isPublic === true,
    },
    include: { user: { select: { displayName: true, role: true, avatarUrl: true } } },
  });

  res.status(201).json({ journal });
}

// ── PATCH /api/journals/:journalId ───────────
export async function updateJournal(req: Request, res: Response): Promise<void> {
  const { journalId } = req.params;
  const { userId, title, content, mood, tags, isPublic } = req.body as {
    userId: string;
    title?: string;
    content?: string;
    mood?: string;
    tags?: string[];
    isPublic?: boolean;
  };

  const existing = await prisma.journal.findUnique({ where: { id: journalId } });
  if (!existing) {
    res.status(404).json({ error: 'Journal entry not found.' });
    return;
  }
  if (existing.userId !== userId) {
    res.status(403).json({ error: 'You can only edit your own journal entries.' });
    return;
  }

  // BUG-005 fix: Only update provided fields (partial update)
  // BUG-006 fix: Strip HTML tags from journal title and content
  const data: Record<string, any> = {};
  if (title !== undefined) data.title = stripHtmlTags(title);
  if (content !== undefined) data.content = stripHtmlTags(content);
  if (mood !== undefined) data.mood = mood ?? null;
  if (tags !== undefined) data.tags = tags ?? [];
  if (isPublic !== undefined) data.isPublic = isPublic === true;

  const journal = await prisma.journal.update({
    where: { id: journalId },
    data,
    include: { user: { select: { displayName: true, role: true, avatarUrl: true } } },
  });

  res.json({ journal });
}

// ── DELETE /api/journals/:journalId ──────────
export async function deleteJournal(req: Request, res: Response): Promise<void> {
  const { journalId } = req.params;
  const userId = req.body.userId as string;

  const existing = await prisma.journal.findUnique({ where: { id: journalId } });
  if (!existing) {
    res.status(404).json({ error: 'Journal entry not found.' });
    return;
  }
  if (existing.userId !== userId) {
    res.status(403).json({ error: 'You can only delete your own journal entries.' });
    return;
  }

  await prisma.journal.delete({ where: { id: journalId } });

  res.json({ success: true, message: 'Journal entry deleted.' });
}

// ── GET /api/journals/public ─────────────────
export async function getPublicJournals(req: Request, res: Response): Promise<void> {
  const { userId } = req.query as { userId?: string };
  const journals = await prisma.journal.findMany({
    where: { isPublic: true, ...(userId ? { userId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { user: { select: { displayName: true, role: true, avatarUrl: true } } },
  });

  res.json({ journals });
}
