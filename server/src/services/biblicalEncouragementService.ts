// ─────────────────────────────────────────────
// src/services/biblicalEncouragementService.ts
// AI-powered biblical encouragement post generator
// ─────────────────────────────────────────────

import OpenAI from 'openai';
import { env } from '../config/env';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY || 'dummy-key',
});

/**
 * Generates a short biblical encouragement message using AI
 * @returns A short, heartfelt biblical encouragement in Taglish for Gen Z (1-3 sentences)
 */
export async function generateBiblicalEncouragement(): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    console.warn('⚠️ OPENAI_API_KEY not set — using fallback message');
    return getFallbackEncouragement();
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5.4-mini',
      messages: [
        {
          role: 'system',
          content: `You are a compassionate Filipino spiritual guide who shares short, heartfelt biblical encouragements in Taglish (Tagalog-English mix) for Gen Z. 
Your messages should be:
- Brief (1-3 sentences, max 280 characters)
- Written in natural Taglish that Gen Z Filipinos use (mix of Tagalog and English in one sentence)
- Uplifting and hope-filled
- Biblically grounded (you may include a verse reference)
- Relevant to Gen Z struggles (anxiety, mental health, loneliness, self-worth, purpose, social pressure)
- Casual, warm, and relatable tone (walang masyadong formal)
- Use Gen Z expressions but keep it wholesome and encouraging

Examples:
"Feeling anxious ka ba ngayon? Remember, God didn't give you a spirit of fear, but of power, love, and sound mind. (2 Timothy 1:7) You got this, lodi! 🕊️"

"Nag-iisa ka lang? Hindi, fam. The Lord is near to the brokenhearted and saves the crushed in spirit. (Psalm 34:18) He's with you today, always. 💙"

"Your worth ay hindi based sa productivity mo or sa likes mo. You are fearfully and wonderfully made (Psalm 139:14). God loves you, walang kupas. ✨"

"Pagod na pagod ka na ba? Come to Him, all who are weary, and He will give you rest. (Matthew 11:28) It's okay to take a break, besh. You're doing great. 🙏"

"Feeling lost? For I know the plans I have for you, sabi ni Lord, plans to give you hope and a future. (Jeremiah 29:11) May purpose ka, promise! 🔥"`,
        },
        {
          role: 'user',
          content: 'Generate a short biblical encouragement in Taglish for a Gen Z Filipino who needs hope today.',
        },
      ],
      max_completion_tokens: 150,
      temperature: 0.9,
    });

    const message = completion.choices[0]?.message?.content?.trim();
    if (!message) {
      return getFallbackEncouragement();
    }

    return message;
  } catch (error) {
    console.error('❌ Error generating biblical encouragement:', error);
    return getFallbackEncouragement();
  }
}

/**
 * Fallback encouragements when AI is unavailable (Taglish for Gen Z)
 */
function getFallbackEncouragement(): string {
  const fallbacks = [
    "The Lord is close sa brokenhearted and saves those na crushed in spirit. (Psalm 34:18) Hindi ka nag-iisa today, lodi. 🙏",
    "Don't be anxious about anything, pero in every situation, pray lang and present your requests to God. (Philippians 4:6) He hears you, promise! 💙",
    "For I know the plans I have for you, sabi ni Lord, plans to give you hope and a future. (Jeremiah 29:11) May purpose ka, fam! ✨",
    "Cast all your anxiety on Him kasi He cares for you so much. (1 Peter 5:7) Your burdens are safe in His hands ngayong araw. 🕊️",
    "The Lord your God is with you, the Mighty Warrior na nagsave. He will take great delight sa'yo; in His love ay papahintayin ka niya. (Zephaniah 3:17) Loved ka niya! 🎵",
    "Kahit na you walk through the darkest valley, walang dapat katakutan, for He is with you. (Psalm 23:4) God is walking with you today, besh. 🌟",
    "Trust in the Lord with all your heart and 'wag ka mag-lean sa sarili mong understanding. (Proverbs 3:5) He's got you, bestie. 💪",
    "Be strong and courageous. 'Wag matakot, 'wag madiscourage, kasi the Lord your God will be with you kahit saan ka magpunta. (Joshua 1:9) Claim it! 🔥",
  ];

  const randomIndex = Math.floor(Math.random() * fallbacks.length);
  return fallbacks[randomIndex];
}
