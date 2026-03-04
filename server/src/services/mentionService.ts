import { prisma } from '../config/db';
import { createNotification } from './notificationService';

function extractMentionHandles(text: string): string[] {
  const matches = text.match(/(^|\s)@([a-zA-Z0-9_-]{2,30})/g) ?? [];
  const handles = matches
    .map((match) => {
      const token = match.trim();
      return token.startsWith('@') ? token.slice(1) : token.split('@')[1] ?? '';
    })
    .filter(Boolean)
    .map((value) => value.toLowerCase());

  return [...new Set(handles)];
}

function buildHandleVariants(handle: string): string[] {
  const normalized = handle.trim();
  const variants = new Set<string>([normalized]);
  if (normalized.includes('_')) {
    variants.add(normalized.replace(/_/g, ' '));
  }
  return [...variants];
}

async function findMentionedUsersByHandles(handles: string[]) {
  if (!handles.length) return [] as Array<{ id: string; displayName: string }>;

  const variants = [...new Set(handles.flatMap(buildHandleVariants))];

  const users = await prisma.user.findMany({
    where: {
      OR: variants.map((variant) => ({
        displayName: { equals: variant, mode: 'insensitive' as const },
      })),
    },
    select: {
      id: true,
      displayName: true,
    },
  });

  return users;
}

export async function notifyMentionsInPost(params: {
  postId: string;
  authorId: string;
  authorName: string;
  content: string;
}): Promise<void> {
  const handles = extractMentionHandles(params.content);
  if (!handles.length) return;

  const users = await findMentionedUsersByHandles(handles);

  const recipients = users.filter((user) => user.id !== params.authorId);
  if (!recipients.length) return;

  await Promise.all(
    recipients.map((recipient) =>
      createNotification({
        userId: recipient.id,
        type: 'SYSTEM',
        title: 'You were mentioned',
        body: `${params.authorName} mentioned you in a post.`,
        data: {
          postId: params.postId,
          actorId: params.authorId,
          actorName: params.authorName,
          kind: 'MENTION_POST',
        },
      })
    )
  );
}

export async function notifyMentionsInComment(params: {
  postId: string;
  commentId: string;
  commentAuthorId: string;
  commentAuthorName: string;
  content: string;
}): Promise<void> {
  const handles = extractMentionHandles(params.content);
  if (!handles.length) return;

  const users = await findMentionedUsersByHandles(handles);

  const recipients = users.filter((user) => user.id !== params.commentAuthorId);
  if (!recipients.length) return;

  await Promise.all(
    recipients.map((recipient) =>
      createNotification({
        userId: recipient.id,
        type: 'SYSTEM',
        title: 'You were mentioned',
        body: `${params.commentAuthorName} mentioned you in a comment.`,
        data: {
          postId: params.postId,
          commentId: params.commentId,
          actorId: params.commentAuthorId,
          actorName: params.commentAuthorName,
          kind: 'MENTION_COMMENT',
        },
      })
    )
  );
}
