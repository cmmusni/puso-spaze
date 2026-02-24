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
 * @returns A short, heartfelt biblical encouragement (1-3 sentences)
 */
export async function generateBiblicalEncouragement(): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    console.warn('⚠️ OPENAI_API_KEY not set — using fallback message');
    return getFallbackEncouragement();
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a compassionate spiritual guide who shares short, heartfelt biblical encouragements. 
Your messages should be:
- Brief (1-3 sentences, max 280 characters)
- Uplifting and hope-filled
- Biblically grounded (you may include a verse reference)
- Relevant to daily struggles (anxiety, loneliness, doubt, fear, hope, faith)
- Written in a warm, personal tone
- Appropriate for a diverse Christian community

Examples:
"When anxiety overwhelms you, remember: God has not given us a spirit of fear, but of power, love, and a sound mind. (2 Timothy 1:7) You are held in His perfect peace today. 🕊️"

"Feeling alone? You're never walking this path by yourself. The Lord is near to the brokenhearted and saves the crushed in spirit. (Psalm 34:18) Lean into His presence today."

"Your worth isn't found in your productivity or performance. You are fearfully and wonderfully made (Psalm 139:14), deeply loved, and chosen by God. Rest in that truth today."`,
        },
        {
          role: 'user',
          content: 'Generate a short biblical encouragement for someone who needs hope today.',
        },
      ],
      max_tokens: 150,
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
 * Fallback encouragements when AI is unavailable
 */
function getFallbackEncouragement(): string {
  const fallbacks = [
    "The Lord is close to the brokenhearted and saves those who are crushed in spirit. (Psalm 34:18) You are not alone today. 🙏",
    "Don't be anxious about anything, but in every situation, by prayer and petition, present your requests to God. (Philippians 4:6) He hears you. 💙",
    "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future. (Jeremiah 29:11) ✨",
    "Cast all your anxiety on Him because He cares for you. (1 Peter 5:7) Your burdens are safe in His hands today. 🕊️",
    "The Lord your God is with you, the Mighty Warrior who saves. He will take great delight in you; in His love He will quiet you; He will rejoice over you with singing. (Zephaniah 3:17) 🎵",
    "Even though I walk through the darkest valley, I will fear no evil, for you are with me. (Psalm 23:4) God is walking with you today. 🌟",
    "Trust in the Lord with all your heart and lean not on your own understanding. (Proverbs 3:5) He's got you. 💪",
    "Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go. (Joshua 1:9) 🔥",
  ];

  const randomIndex = Math.floor(Math.random() * fallbacks.length);
  return fallbacks[randomIndex];
}
