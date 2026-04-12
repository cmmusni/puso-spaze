// ─────────────────────────────────────────────
// src/services/dailyReflectionService.ts
// Generates a daily biblical reflection via OpenAI
// with in-memory caching (one per calendar day).
// When a user has recent posts, the reflection is
// personalised to their emotional context.
// ─────────────────────────────────────────────

import OpenAI from 'openai';
import { env } from '../config/env';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY || 'dummy-key',
});

interface CachedReflection {
  dateKey: string;
  content: string;
}

/** Generic (non-personalised) cache — one per calendar day */
let genericCache: CachedReflection | null = null;

/** Per-user personalised cache — keyed by `userId:dateKey` */
const userCache = new Map<string, CachedReflection>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

const FALLBACKS = [
  '"The Lord is close to the brokenhearted and saves those who are crushed in spirit." — Psalm 34:18\n\nKahit gaano kabigat ang nararamdaman mo ngayon, hindi ka nag-iisa. God sees you, and He is near.',
  '"For I know the plans I have for you," declares the Lord, "plans to prosper you and not to harm you, plans to give you hope and a future." — Jeremiah 29:11\n\nMay plano ang Diyos para sa\'yo — hindi para saktan ka, kundi para bigyan ka ng pag-asa.',
  '"Come to me, all you who are weary and burdened, and I will give you rest." — Matthew 11:28\n\nPagod ka na ba? It\'s okay to pause. God invites you to rest in Him today.',
  '"Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go." — Joshua 1:9\n\nKahit saan ka man dalhin ng araw na ito, kasama mo Siya.',
  '"Cast all your anxiety on Him because He cares for you." — 1 Peter 5:7\n\nYour worries are safe in His hands. Ipasa mo sa Kanya lahat ng bumabagabag sa\'yo ngayon.',
];

function getFallback(): string {
  return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
}

/**
 * Returns a daily reflection, generated once per day via OpenAI.
 * Falls back to a curated reflection if the API is unavailable.
 */
export async function getDailyReflection(): Promise<string> {
  const key = todayKey();

  if (genericCache && genericCache.dateKey === key) {
    return genericCache.content;
  }

  if (!env.OPENAI_API_KEY) {
    const fb = getFallback();
    genericCache = { dateKey: key, content: fb };
    return fb;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5.4-mini',
      messages: [
        {
          role: 'system',
          content: `You are a compassionate Filipino spiritual guide who writes a daily biblical reflection for Gen Z Filipinos.

Your reflection should be:
- 2-4 sentences long
- Written in natural Taglish (Tagalog-English mix) that Gen Z Filipinos use
- Start with a Bible verse (include the reference)
- Follow with a brief, warm reflection connecting the verse to real Gen Z struggles (anxiety, self-worth, loneliness, purpose, pressure, mental health)
- Hopeful, gentle, and encouraging — never preachy or judgmental
- A different theme each day — cycle through hope, rest, courage, identity, trust, gratitude, peace, and purpose`,
        },
        {
          role: 'user',
          content: `Write today's daily reflection for ${key}. Make it unique and relevant.`,
        },
      ],
      max_tokens: 200,
      temperature: 0.85,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      const fb = getFallback();
      genericCache = { dateKey: key, content: fb };
      return fb;
    }

    genericCache = { dateKey: key, content };
    return content;
  } catch (error) {
    console.error('❌ Error generating daily reflection:', error);
    const fb = getFallback();
    genericCache = { dateKey: key, content: fb };
    return fb;
  }
}

/**
 * Returns a personalised daily reflection based on the user's recent posts.
 * Cached per-user per day. Falls back to generic reflection on error or
 * when OpenAI is unavailable.
 */
export async function getPersonalisedDailyReflection(
  userId: string,
  recentPostContents: string[],
): Promise<string> {
  const key = todayKey();
  const cacheKey = `${userId}:${key}`;

  const cached = userCache.get(cacheKey);
  if (cached && cached.dateKey === key) {
    return cached.content;
  }

  if (!env.OPENAI_API_KEY) {
    return getDailyReflection();
  }

  // Build a concise summary of recent posts (max ~600 chars to stay within token budget)
  const postsSummary = recentPostContents
    .slice(0, 5)
    .map((c, i) => `${i + 1}. ${c.slice(0, 120)}`)
    .join('\n');

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5.4-mini',
      messages: [
        {
          role: 'system',
          content: `You are a compassionate Filipino spiritual guide who writes a personalised daily biblical reflection for a Gen Z Filipino user.

You will receive the user's recent posts. Use them to understand what they're going through emotionally and spiritually.

Your reflection should be:
- 2-4 sentences long
- Written in natural Taglish (Tagalog-English mix) that Gen Z Filipinos use
- Start with a Bible verse that speaks to their current situation (include the reference)
- Follow with a brief, warm, personalised reflection that acknowledges what they've been sharing
- Hopeful, gentle, and encouraging — never preachy or judgmental
- NEVER quote or repeat the user's exact words back to them
- Do NOT mention that you read their posts`,
        },
        {
          role: 'user',
          content: `Here are the user's recent posts:\n${postsSummary}\n\nWrite a personalised daily reflection for ${key} that speaks to what this person seems to be going through.`,
        },
      ],
      max_tokens: 200,
      temperature: 0.85,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      return getDailyReflection();
    }

    userCache.set(cacheKey, { dateKey: key, content });
    return content;
  } catch (error) {
    console.error('❌ Error generating personalised daily reflection:', error);
    return getDailyReflection();
  }
}
