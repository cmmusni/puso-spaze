import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteComment } from './commentController';
import { prisma } from '../config/db';

function createMockResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  return response;
}

test('deleteComment allows admin to delete another user\'s comment', async () => {
  const adminId = '11111111-1111-1111-1111-111111111111';
  const ownerId = '22222222-2222-2222-2222-222222222222';
  const postId = '33333333-3333-3333-3333-333333333333';
  const commentId = '44444444-4444-4444-4444-444444444444';

  const originalCommentFindUnique = prisma.comment.findUnique;
  const originalUserFindUnique = prisma.user.findUnique;
  const originalCommentDelete = prisma.comment.delete;

  const deletedIds: string[] = [];

  (prisma.comment.findUnique as unknown as (args: unknown) => Promise<unknown>) = async () => ({
    id: commentId,
    postId,
    userId: ownerId,
  });

  (prisma.user.findUnique as unknown as (args: unknown) => Promise<unknown>) = async () => ({
    role: 'ADMIN',
  });

  (prisma.comment.delete as unknown as (args: { where: { id: string } }) => Promise<unknown>) = async (args) => {
    deletedIds.push(args.where.id);
    return { id: args.where.id };
  };

  const req = {
    params: { postId, commentId },
    body: { userId: adminId },
    query: {},
  } as any;

  const res = createMockResponse() as any;

  try {
    await deleteComment(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true, message: 'Comment deleted successfully.' });
    assert.deepEqual(deletedIds, [commentId]);
  } finally {
    prisma.comment.findUnique = originalCommentFindUnique;
    prisma.user.findUnique = originalUserFindUnique;
    prisma.comment.delete = originalCommentDelete;
  }
});

test('deleteComment denies non-owner non-admin with 403', async () => {
  const requesterId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ownerId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const postId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const commentId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

  const originalCommentFindUnique = prisma.comment.findUnique;
  const originalUserFindUnique = prisma.user.findUnique;
  const originalCommentDelete = prisma.comment.delete;

  let deleteCalled = false;

  (prisma.comment.findUnique as unknown as (args: unknown) => Promise<unknown>) = async () => ({
    id: commentId,
    postId,
    userId: ownerId,
  });

  (prisma.user.findUnique as unknown as (args: unknown) => Promise<unknown>) = async () => ({
    role: 'USER',
  });

  (prisma.comment.delete as unknown as (args: unknown) => Promise<unknown>) = async () => {
    deleteCalled = true;
    return { id: commentId };
  };

  const req = {
    params: { postId, commentId },
    body: { userId: requesterId },
    query: {},
  } as any;

  const res = createMockResponse() as any;

  try {
    await deleteComment(req, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'You do not have permission to delete this comment.' });
    assert.equal(deleteCalled, false);
  } finally {
    prisma.comment.findUnique = originalCommentFindUnique;
    prisma.user.findUnique = originalUserFindUnique;
    prisma.comment.delete = originalCommentDelete;
  }
});
