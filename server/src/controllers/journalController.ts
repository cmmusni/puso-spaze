// ─────────────────────────────────────────────
// src/controllers/journalController.ts
// CRUD for private user journals
// ─────────────────────────────────────────────

import { Request, Response } from 'express';
import { prisma } from '../config/db';

// ── GET /api/journals?userId=... ─────────────
export async function getJournals(req: Request, res: Response): Promise<void> {
  const userId = req.query.userId as string;
  if (!userId) {
    res.status(400).json({ error: 'userId query param is required.' });
    return;
  }

  const journals = await prisma.journal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { displayName: true, role: true } } },
  });

  res.json({ journals });
}

// ── GET /api/journals/:journalId?userId=... ──
export async function getJournalById(req: Request, res: Response): Promise<void> {
  const { journalId } = req.params;
  const userId = req.query.userId as string;

  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    include: { user: { select: { displayName: true, role: true } } },
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
  const { userId, title, content, mood, tags } = req.body as {
    userId: string;
    title: string;
    content: string;
    mood?: string;
    tags?: string[];
  };

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
    },
    include: { user: { select: { displayName: true, role: true } } },
  });

  res.status(201).json({ journal });
}

// ── PATCH /api/journals/:journalId ───────────
export async function updateJournal(req: Request, res: Response): Promise<void> {
  const { journalId } = req.params;
  const { userId, title, content, mood, tags } = req.body as {
    userId: string;
    title: string;
    content: string;
    mood?: string;
    tags?: string[];
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

  const journal = await prisma.journal.update({
    where: { id: journalId },
    data: { title, content, mood: mood ?? null, tags: tags ?? [] },
    include: { user: { select: { displayName: true, role: true } } },
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
