// ─────────────────────────────────────────────
// src/controllers/conversationController.ts
// Spaze Coach messaging — conversations & messages
// All coaches/admins can see ALL conversations.
// Users can only see their own conversations.
// ─────────────────────────────────────────────

import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { createNotification } from '../services/notificationService';

// ── GET /api/conversations/coaches ───────────
// Returns all users with COACH or ADMIN role
export async function getCoaches(_req: Request, res: Response): Promise<void> {
  const coaches = await prisma.user.findMany({
    where: { role: { in: ['COACH', 'ADMIN'] } },
    select: { id: true, displayName: true, role: true, avatarUrl: true },
    orderBy: { displayName: 'asc' },
  });

  res.json({ coaches });
}

// ── GET /api/conversations/all ───────────────
// Returns all conversations for the community view (Spaze Conversations).
// Only shows conversations that have at least one message.
export async function getAllConversations(_req: Request, res: Response): Promise<void> {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        messages: { some: {} }, // Only conversations with at least one message
      },
      include: {
        user: { select: { displayName: true, role: true, avatarUrl: true } },
        coach: { select: { displayName: true, role: true, avatarUrl: true } },
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { displayName: true, role: true, avatarUrl: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const result = conversations.map((c) => ({
      id: c.id,
      userId: c.userId,
      coachId: c.coachId,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      user: c.user,
      coach: c.coach,
      messageCount: c._count.messages,
      lastMessage: c.messages[0]
        ? {
            id: c.messages[0].id,
            conversationId: c.messages[0].conversationId,
            senderId: c.messages[0].senderId,
            content: c.messages[0].content,
            createdAt: c.messages[0].createdAt.toISOString(),
            sender: c.messages[0].sender,
          }
        : null,
    }));

    res.json({ conversations: result });
  } catch (err) {
    console.error('[ConversationController] getAllConversations error:', err);
    res.status(500).json({ error: 'Failed to fetch conversations.' });
  }
}

// ── GET /api/conversations?userId=... ────────
// Users see their own conversations.
// Coaches/Admins see ALL conversations.
export async function getConversations(req: Request, res: Response): Promise<void> {
  const userId = req.query.userId as string;
  if (!userId) {
    res.status(400).json({ error: 'userId query param is required.' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const isCoach = user.role === 'COACH' || user.role === 'ADMIN';

  // Coaches see ALL conversations; users see only theirs
  const where = isCoach ? {} : { userId };

  const conversations = await prisma.conversation.findMany({
    where,
    include: {
      user: { select: { displayName: true, role: true, avatarUrl: true } },
      coach: { select: { displayName: true, role: true, avatarUrl: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { sender: { select: { displayName: true, role: true, avatarUrl: true } } },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const result = conversations.map((c) => ({
    id: c.id,
    userId: c.userId,
    coachId: c.coachId,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    user: c.user,
    coach: c.coach,
    lastMessage: c.messages[0]
      ? {
          id: c.messages[0].id,
          conversationId: c.messages[0].conversationId,
          senderId: c.messages[0].senderId,
          content: c.messages[0].content,
          createdAt: c.messages[0].createdAt.toISOString(),
          sender: c.messages[0].sender,
        }
      : null,
  }));

  res.json({ conversations: result });
}

// ── POST /api/conversations ──────────────────
// Get or create a conversation between a user and a coach.
export async function getOrCreateConversation(req: Request, res: Response): Promise<void> {
  const { userId, coachId } = req.body as { userId: string; coachId: string };

  // Verify both users exist
  const [user, coach] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.user.findUnique({ where: { id: coachId } }),
  ]);

  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  if (!coach) {
    res.status(404).json({ error: 'Coach not found.' });
    return;
  }
  if (coach.role !== 'COACH' && coach.role !== 'ADMIN') {
    res.status(400).json({ error: 'Target user is not a coach.' });
    return;
  }

  // Upsert: find existing or create new
  const conversation = await prisma.conversation.upsert({
    where: { userId_coachId: { userId, coachId } },
    update: {},
    create: { userId, coachId },
    include: {
      user: { select: { displayName: true, role: true, avatarUrl: true } },
      coach: { select: { displayName: true, role: true, avatarUrl: true } },
    },
  });

  res.json({
    conversation: {
      id: conversation.id,
      userId: conversation.userId,
      coachId: conversation.coachId,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      user: conversation.user,
      coach: conversation.coach,
      lastMessage: null,
    },
  });
}

// ── GET /api/conversations/:conversationId/messages?userId=... ──
export async function getMessages(req: Request, res: Response): Promise<void> {
  const { conversationId } = req.params;
  const userId = req.query.userId as string;

  if (!userId) {
    res.status(400).json({ error: 'userId query param is required.' });
    return;
  }

  // Verify conversation exists
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found.' });
    return;
  }

  // Verify user has access: participant or any coach/admin
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  const isCoach = user.role === 'COACH' || user.role === 'ADMIN';
  const isParticipant = conversation.userId === userId || conversation.coachId === userId;

  if (!isCoach && !isParticipant) {
    res.status(403).json({ error: 'You do not have access to this conversation.' });
    return;
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    include: { sender: { select: { displayName: true, role: true, avatarUrl: true } } },
  });

  res.json({
    messages: messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      sender: m.sender,
    })),
  });
}

// ── POST /api/conversations/:conversationId/messages ──
export async function sendMessage(req: Request, res: Response): Promise<void> {
  const { conversationId } = req.params;
  const { senderId, content } = req.body as { senderId: string; content: string };

  // Verify conversation exists
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found.' });
    return;
  }

  // Verify sender has access: participant or any coach/admin
  const sender = await prisma.user.findUnique({ where: { id: senderId } });
  if (!sender) {
    res.status(404).json({ error: 'Sender not found.' });
    return;
  }
  const isCoach = sender.role === 'COACH' || sender.role === 'ADMIN';
  const isParticipant = conversation.userId === senderId || conversation.coachId === senderId;

  if (!isCoach && !isParticipant) {
    res.status(403).json({ error: 'You do not have access to this conversation.' });
    return;
  }

  // Create message + update conversation timestamp
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, senderId, content },
      include: { sender: { select: { displayName: true, role: true, avatarUrl: true } } },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);

  res.status(201).json({
    message: {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      sender: message.sender,
    },
  });

  // Notify the other participant (non-blocking)
  const recipientId =
    conversation.userId === senderId ? conversation.coachId : conversation.userId;
  if (recipientId && recipientId !== senderId) {
    createNotification({
      userId: recipientId,
      type: 'MESSAGE',
      title: `New message from ${sender.displayName}`,
      body: message.content.length > 100
        ? message.content.slice(0, 100) + '…'
        : message.content,
      data: { conversationId, senderId },
    }).catch((err) => console.error('[sendMessage] notification error:', err));
  }
}

// ── In-memory typing store ───────────────────
// key: `${conversationId}:${userId}` → expiry timestamp (ms)
const typingStore = new Map<string, number>();
const TYPING_TTL_MS = 4000; // expire after 4 s of silence

// ── POST /api/conversations/:conversationId/typing ──
// Body: { userId: string }
// Sets the caller as "typing". Clears itself after TYPING_TTL_MS.
export async function setTyping(req: Request, res: Response): Promise<void> {
  const { conversationId } = req.params;
  const { userId } = req.body as { userId: string };
  if (!userId) {
    res.status(400).json({ error: 'userId is required.' });
    return;
  }
  typingStore.set(`${conversationId}:${userId}`, Date.now() + TYPING_TTL_MS);
  res.json({ ok: true });
}

// ── GET /api/conversations/:conversationId/typing?userId=me ──
// Returns { typing: boolean, typingUserId: string | null }
// where typing = true when the *other* participant is currently typing.
export async function getTyping(req: Request, res: Response): Promise<void> {
  const { conversationId } = req.params;
  const myId = req.query.userId as string;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { userId: true, coachId: true },
  });
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found.' });
    return;
  }

  const otherId = conversation.userId === myId ? conversation.coachId : conversation.userId;
  const expiry = typingStore.get(`${conversationId}:${otherId}`);
  const isTyping = !!expiry && expiry > Date.now();

  // Prune expired entry
  if (expiry && expiry <= Date.now()) {
    typingStore.delete(`${conversationId}:${otherId}`);
  }

  res.json({ typing: isTyping, typingUserId: isTyping ? otherId : null });
}
