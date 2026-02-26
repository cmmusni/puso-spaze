// Fix failed migration script
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMigration() {
  console.log('🔧 Fixing failed migration...\n');

  try {
    // Step 1: Add pinned column if it doesn't exist
    console.log('1. Adding pinned column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;
    `);
    console.log('✅ Pinned column added\n');

    // Step 2: Ensure displayName is unique
    console.log('2. Adding unique constraint on displayName...');
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'users_displayName_key'
          ) THEN
              ALTER TABLE users ADD CONSTRAINT users_displayName_key UNIQUE (displayName);
          END IF;
      END $$;
    `);
    console.log('✅ Unique constraint added\n');

    // Step 3: Clean up the failed migration record
    console.log('3. Cleaning up failed migration record...');
    await prisma.$executeRawUnsafe(`
      DELETE FROM _prisma_migrations 
      WHERE migration_name = '20260226003642_add_post_pinned_field';
    `);
    console.log('✅ Failed migration record removed\n');

    // Step 4: Mark migration as successfully applied
    console.log('4. Marking migration as applied...');
    await prisma.$executeRawUnsafe(`
      INSERT INTO _prisma_migrations (
        id, 
        checksum, 
        finished_at, 
        migration_name, 
        logs, 
        rolled_back_at, 
        started_at, 
        applied_steps_count
      ) VALUES (
        gen_random_uuid(),
        'e5f8c4d3b2a1f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4',
        NOW(),
        '20260226003642_add_post_pinned_field',
        NULL,
        NULL,
        NOW(),
        1
      );
    `);
    console.log('✅ Migration marked as applied\n');

    // Verify
    console.log('5. Verifying fix...');
    const result = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'posts' AND column_name = 'pinned';
    `);
    console.log('✅ Verification:', result);

    console.log('\n🎉 Migration fixed successfully!');
  } catch (error) {
    console.error('❌ Error fixing migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixMigration()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
