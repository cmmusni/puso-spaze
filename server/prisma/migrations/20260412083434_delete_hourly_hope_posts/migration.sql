-- Delete all Hourly Hope / AI-generated posts (and cascade to comments & reactions)
DELETE FROM "posts" WHERE "userId" = 'system-encouragement-bot';
