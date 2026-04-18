-- CreateIndex
CREATE INDEX "comments_postId_idx" ON "comments"("postId");

-- CreateIndex
CREATE INDEX "comments_moderationStatus_idx" ON "comments"("moderationStatus");

-- CreateIndex
CREATE INDEX "invite_codes_used_idx" ON "invite_codes"("used");

-- CreateIndex
CREATE INDEX "posts_createdAt_idx" ON "posts"("createdAt");

-- CreateIndex
CREATE INDEX "posts_moderationStatus_idx" ON "posts"("moderationStatus");

-- CreateIndex
CREATE INDEX "posts_moderationStatus_createdAt_idx" ON "posts"("moderationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "reactions_postId_idx" ON "reactions"("postId");

-- CreateIndex
CREATE INDEX "users_lastActiveAt_idx" ON "users"("lastActiveAt");
