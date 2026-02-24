// ─────────────────────────────────────────────
// prisma/seed.ts
// Seed data: Users, Posts, and Comments
// Run: npx prisma db seed
// ─────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ── Clear existing data ────────────────────
  console.log('🗑️  Clearing existing data...');
  try {
    await prisma.reaction.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();
    await prisma.inviteCode.deleteMany();
  } catch (error) {
    console.log('⚠️  Note: Some tables may not exist yet (this is okay for first run)');
  }

  // ── Create Users ───────────────────────────
  console.log('👥 Creating users...');
  const users = await Promise.all([
    prisma.user.create({
      data: {
        id: uuidv4(),
        displayName: 'sarah-coach',
        role: 'COACH',
      },
    }),
    prisma.user.create({
      data: {
        id: uuidv4(),
        displayName: 'alex-admin',
        role: 'ADMIN',
      },
    }),
    // Gen Z Users
    prisma.user.create({
      data: {
        id: uuidv4(),
        displayName: 'marcus',
        role: 'USER',
      },
    }),
    prisma.user.create({
      data: {
        id: uuidv4(),
        displayName: 'emma-wellness',
        role: 'USER',
      },
    }),
    prisma.user.create({
      data: {
        id: uuidv4(),
        displayName: 'jordan-seeker',
        role: 'USER',
      },
    }),
    prisma.user.create({
      data: {
        id: uuidv4(),
        displayName: 'rachel-reflecting',
        role: 'USER',
      },
    }),
    prisma.user.create({
      data: {
        id: uuidv4(),
        displayName: 'maya-vibes',
        role: 'USER',
      },
    }),
    prisma.user.create({
      data: {
        id: uuidv4(),
        displayName: 'kai-authentic',
        role: 'USER',
      },
    }),
    prisma.user.create({
      data: {
        id: uuidv4(),
        displayName: 'zara-creative',
        role: 'USER',
      },
    }),
    prisma.user.create({
      data: {
        id: uuidv4(),
        displayName: 'sienna-brave',
        role: 'USER',
      },
    }),
    prisma.user.create({
      data: {
        id: uuidv4(),
        displayName: 'leo-growth',
        role: 'USER',
      },
    }),
    prisma.user.create({
      data: {
        id: uuidv4(),
        displayName: 'nova-starlight',
        role: 'USER',
      },
    }),
    prisma.user.create({
      data: {
        id: uuidv4(),
        displayName: 'ash-honest',
        role: 'USER',
      },
    }),
    prisma.user.create({
      data: {
        id: uuidv4(),
        displayName: 'sky-free',
        role: 'USER',
      },
    }),
    prisma.user.create({
      data: {
        id: uuidv4(),
        displayName: 'river-flow',
        role: 'USER',
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users\n`);

  const [
    sarahCoach,
    alexAdmin,
    marcus,
    emmaWellness,
    jordanSeeker,
    rachelReflecting,
    mayaVibes,
    kaiAuthentic,
    zaraCreative,
    siennaBrave,
    leoGrowth,
    novaStarlight,
    ashHonest,
    skyFree,
    riverFlow,
  ] = users;

  // ── Create Posts ───────────────────────────
  console.log('📝 Creating posts...');
  const posts = await Promise.all([
    prisma.post.create({
      data: {
        id: uuidv4(),
        content:
          'Struggling with work-life balance lately. Does anyone have tips for managing stress after long days?',
        userId: marcus.id,
        moderationStatus: 'SAFE',
        tags: ['wellness', 'stress-management'],
      },
    }),
    prisma.post.create({
      data: {
        id: uuidv4(),
        content:
          'Just finished my first week of meditation practice. Feeling more centered already! 🙏',
        userId: emmaWellness.id,
        moderationStatus: 'SAFE',
        tags: ['meditation', 'mindfulness'],
      },
    }),
    prisma.post.create({
      data: {
        id: uuidv4(),
        content:
          'Grateful for the support from this community. It helps knowing I\'m not alone in my journey.',
        userId: jordanSeeker.id,
        moderationStatus: 'SAFE',
        tags: ['gratitude', 'community'],
      },
    }),
    prisma.post.create({
      data: {
        id: uuidv4(),
        content:
          'Starting therapy today. Nervous but hopeful about taking this step for my mental health.',
        userId: rachelReflecting.id,
        moderationStatus: 'SAFE',
        tags: ['mental-health', 'courage'],
      },
    }),
    prisma.post.create({
      data: {
        id: uuidv4(),
        content:
          'As a coach, I believe small daily habits compound into big life changes. What\'s one habit you\'re proud of?',
        userId: sarahCoach.id,
        moderationStatus: 'SAFE',
        tags: ['coaching', 'habits', 'growth'],
      },
    }),
    prisma.post.create({
      data: {
        id: uuidv4(),
        content: 'Happy to announce we\'ve reached 100 community members! Thank you all for being here.',
        userId: alexAdmin.id,
        moderationStatus: 'SAFE',
        tags: ['community', 'milestone'],
      },
    }),
    // Gen Z Posts
    prisma.post.create({
      data: {
        id: uuidv4(),
        content:
          'ngl the pressure to have it all figured out at 22 is insane 😭 like why are we expected to know our whole life plan already?',
        userId: mayaVibes.id,
        moderationStatus: 'SAFE',
        tags: ['gen-z', 'mental-health', 'anxiety'],
      },
    }),
    prisma.post.create({
      data: {
        id: uuidv4(),
        content:
          'been working on being more authentically myself instead of who i think people want me to be. it\'s scary but healing ✨',
        userId: kaiAuthentic.id,
        moderationStatus: 'SAFE',
        tags: ['authenticity', 'self-discovery', 'boundaries'],
      },
    }),
    prisma.post.create({
      data: {
        id: uuidv4(),
        content:
          'anyone else struggle with comparing their behind-the-scenes to other people\'s highlight reel? social media hits different lately',
        userId: zaraCreative.id,
        moderationStatus: 'SAFE',
        tags: ['social-media', 'self-worth', 'comparison'],
      },
    }),
    prisma.post.create({
      data: {
        id: uuidv4(),
        content:
          'facing my trauma in therapy has been the most humbling and empowering thing i\'ve done. healing is not linear and that\'s okay 💜',
        userId: siennaBrave.id,
        moderationStatus: 'SAFE',
        tags: ['therapy', 'trauma', 'healing'],
      },
    }),
    prisma.post.create({
      data: {
        id: uuidv4(),
        content:
          'why is it so hard to ask for help??? like we\'re all struggling but we pretend we\'re fine. let\'s normalize vulnerability fr',
        userId: leoGrowth.id,
        moderationStatus: 'SAFE',
        tags: ['vulnerability', 'help', 'community'],
      },
    }),
    prisma.post.create({
      data: {
        id: uuidv4(),
        content:
          'found this space and honestly it\'s the first time i\'ve felt like i can be 100% real without judgment. grateful for y\'all 🤍',
        userId: novaStarlight.id,
        moderationStatus: 'SAFE',
        tags: ['safe-space', 'community', 'belonging'],
      },
    }),
    prisma.post.create({
      data: {
        id: uuidv4(),
        content:
          'manifesting better mental health days for everyone reading this. you\'re stronger than you think and your feelings are valid 💫',
        userId: ashHonest.id,
        moderationStatus: 'SAFE',
        tags: ['affirmation', 'mental-health', 'support'],
      },
    }),
    prisma.post.create({
      data: {
        id: uuidv4(),
        content:
          'learning that boundaries aren\'t selfish, they\'re necessary. setting them for the first time and it feels so liberating',
        userId: skyFree.id,
        moderationStatus: 'SAFE',
        tags: ['boundaries', 'self-care', 'growth'],
      },
    }),
    prisma.post.create({
      data: {
        id: uuidv4(),
        content:
          'dealing with anxiety about the future but trying to stay present. some days are harder than others and that\'s valid 🌊',
        userId: riverFlow.id,
        moderationStatus: 'SAFE',
        tags: ['anxiety', 'presence', 'mental-health'],
      },
    }),
    prisma.post.create({
      data: {
        id: uuidv4(),
        content:
          'broke up with someone who didn\'t appreciate me and i\'m actually thriving?? self-love looks different than i expected',
        userId: mayaVibes.id,
        moderationStatus: 'SAFE',
        tags: ['breakup', 'self-love', 'growth'],
      },
    }),
    prisma.post.create({
      data: {
        id: uuidv4(),
        content:
          'if you\'re going through something heavy right now, this is your sign that it won\'t last forever. better days are coming i promise 🌟',
        userId: emmaWellness.id,
        moderationStatus: 'SAFE',
        tags: ['hope', 'encouragement', 'faith'],
      },
    }),
  ]);

  console.log(`✅ Created ${posts.length} posts\n`);

  const [
    post1,
    post2,
    post3,
    post4,
    post5,
    post6,
    post7,
    post8,
    post9,
    post10,
    post11,
    post12,
    post13,
    post14,
    post15,
    post16,
    post17,
  ] = posts;

  // ── Create Comments ───────────────────────
  console.log('💬 Creating comments...');
  const comments = await Promise.all([
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'I find that taking short walks really helps me manage stress.',
        postId: post1.id,
        userId: emmaWellness.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'That\'s amazing progress! Keep it up 🌟',
        postId: post2.id,
        userId: sarahCoach.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'You\'re never alone here. We\'re all in this together.',
        postId: post3.id,
        userId: marcus.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'That\'s a brave decision! Wishing you all the best with your journey.',
        postId: post4.id,
        userId: emmaWellness.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'My habit is journaling for 10 minutes each morning. Really helps with clarity.',
        postId: post5.id,
        userId: jordanSeeker.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content:
          'Consistency is key! Even small commitments lead to big changes over time.',
        postId: post5.id,
        userId: rachelReflecting.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'Congratulations team! Grateful to be part of this amazing community.',
        postId: post6.id,
        userId: marcus.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'This space has been transformative. Thank you for creating it.',
        postId: post6.id,
        userId: sarahCoach.id,
        moderationStatus: 'SAFE',
      },
    }),
    // Gen Z Comments
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'fr fr no one talks about this enough. like what\'s the timeline supposed to be??',
        postId: post7.id,
        userId: zaraCreative.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'the pressure is so real. i\'m learning to let go of expectations too',
        postId: post7.id,
        userId: riverFlow.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'this is so inspiring!! proud of you for doing the work 💚',
        postId: post8.id,
        userId: novaStarlight.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'same journey fr. it\'s scary but like worth it ya know',
        postId: post8.id,
        userId: kaiAuthentic.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'social media really does that to us. comparing apples to oranges constantly 😭',
        postId: post9.id,
        userId: mayaVibes.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'i stopped posting as much lately and honestly my mental health improved',
        postId: post9.id,
        userId: ashHonest.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'therapy changed my life too. so glad you\'re being brave 💝',
        postId: post10.id,
        userId: leoGrowth.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'healing is a journey not a destination. you got this 💪',
        postId: post10.id,
        userId: jordanSeeker.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'this!!! like why do we pretend everything is fine when we\'re literally struggling',
        postId: post11.id,
        userId: mayaVibes.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'asking for help is actually strength not weakness. took me a while to get that',
        postId: post11.id,
        userId: skyFree.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'this community really is different. so thankful 🖤',
        postId: post12.id,
        userId: zaraCreative.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'me too!! finally a space where i don\'t have to mask',
        postId: post12.id,
        userId: riverFlow.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'needed this today so bad. thank you 💫',
        postId: post13.id,
        userId: siennaBrave.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'big mood. sending good energy back to you too 🌈',
        postId: post13.id,
        userId: kaiAuthentic.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'boundaries save lives fr. learning this late but better late than never',
        postId: post14.id,
        userId: novaStarlight.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'the relief i felt after setting boundaries?? unmatched 🙌',
        postId: post14.id,
        userId: leoGrowth.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'some days be like that. presence is an act of resistance for sure',
        postId: post15.id,
        userId: ashHonest.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'the future is scary but like we\'ll figure it out together maybe ✨',
        postId: post15.id,
        userId: rachelReflecting.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'yes queen!! self-love era hits different 👑',
        postId: post16.id,
        userId: novaStarlight.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'so happy for you. you deserve someone who gets it',
        postId: post16.id,
        userId: siennaBrave.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'holding onto this hope. thank you for the reminder 💙',
        postId: post17.id,
        userId: leoGrowth.id,
        moderationStatus: 'SAFE',
      },
    }),
    prisma.comment.create({
      data: {
        id: uuidv4(),
        content: 'seasons change and pain doesn\'t last. this resonates with me so much',
        postId: post17.id,
        userId: kaiAuthentic.id,
        moderationStatus: 'SAFE',
      },
    }),
  ]);

  console.log(`✅ Created ${comments.length} comments\n`);

  // ── Summary ────────────────────────────────
  console.log('✨ Seed complete!');
  console.log(`📊 Summary:`);
  console.log(`   • Users: ${users.length}`);
  console.log(`   • Posts: ${posts.length}`);
  console.log(`   • Comments: ${comments.length}`);
  console.log();
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
