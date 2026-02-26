// ─────────────────────────────────────────────
// src/services/moderationService.ts
// AI content moderation using OpenAI Moderation API
// Falls back to SAFE if API key is not configured
// ─────────────────────────────────────────────

import OpenAI from "openai";
import { env } from "../config/env";

// ── Result type ───────────────────────────────
export type ModerationResult = "SAFE" | "FLAGGED" | "REVIEW";

// ── Local keyword blocklist (first-pass, no API needed) ───────────────────────
// Catches obvious profanity and slurs before calling OpenAI.
// Add words in lowercase — matching is case-insensitive and whole-word aware.
const BLOCKED_WORDS = [
  // ── English profanity ──────────────────────────────────────────────────────
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "cunt",
  "dick",
  "piss",
  "cock",
  "pussy",
  "whore",
  "slut",
  "faggot",
  "nigger",
  "nigga",
  "retard",
  "kys",
  "kill yourself",

  // ── Filipino / Tagalog profanity & insults ─────────────────────────────────
  // Hard profanity
  "putangina",
  "puta",
  "putang ina",
  "putang ina mo",
  "tangina",
  "tang ina",
  "pakyu",
  "pak yu",
  "pakyo",
  "gago",
  "gaga",
  "gagong",
  "ulol",
  "ulul",
  "tarantado",
  "tarantadong",
  "punyeta",
  "punyetang",
  "bwisit",
  "bwisitin",
  "leche",
  "letse",
  "hunghang",
  "inutil",
  "hayop",
  "hayup",
  "peste",
  "lintik",
  "kingina",
  "kin*na",
  "kupal",
  "kupaling",
  "tanga",
  "tangahan",
  "bobo",
  "bobong",
  "tongo",
  "siraulo",
  "sira ulo",
  "walang hiya",
  "walang-hiya",
  "demonyo",
  "b0b0",
  "8080",
  "B0B0",
  "B0BO",
  "BOB0",

  // ── Gen Z self-harm / suicidal slang ──────────────────────────────────────
  // Note: `kys` already covered above
  "kms",           // "kill myself"
  "khs",           // "kill himself/herself"
  "unalive",       // Gen Z euphemism for suicide/killing
  "unaliving",
  "off yourself",  // "go off yourself"

  // ── Gen Z sexual slang ────────────────────────────────────────────────────
  "dtf",           // "down to f***"
  "thirst trap",
  "gyatt",         // exclamation about someone's body
  "gyat",

  // ── Gen Z bullying / dehumanizing slang ──────────────────────────────────
  "incel",         // misogynist subculture label
  "copium",        // dismisses someone's pain as delusion
  "l + ratio",     // compound humiliation attack

  // ── Discrimination & hate speech ──────────────────────────────────────────
  // Racial/ethnic slurs
  "chink",
  "gook",
  "spic",
  "wetback",
  "beaner",
  "towelhead",
  "sandnigger",
  "raghead",
  "paki",
  "jungle bunny",
  "coon",
  "jigaboo",
  "kike",
  "hymie",
  "kyke",
  
  // Gender discrimination
  "feminazi",
  "femoid",
  "roastie",      // incel term for women
  "becky",        // derogatory for basic women
  "karen",        // when used as slur (context matters)
  
  // Religious discrimination
  "kafir",        // derogatory for non-Muslims
  "infidel",      // when used derogatorily
  
  // Sexual orientation discrimination
  "dyke",
  "fag",
  "homo",
  "sodomite",
  "tranny",
  "shemale",
  "heshe",
  "it",           // when referring to trans people
  
  // Disability discrimination
  "spaz",
  "cripple",
  "gimp",
  "mongoloid",
  "autistic",     // when used as insult
  "autist",       // when used as insult
  
  // Class/socioeconomic discrimination
  "trailer trash",
  "white trash",
  "ghetto",       // when used derogatorily
  "peasant",      // when used derogatorily
  "welfare queen",
  
  // Filipino discrimination terms
  "indio",        // colonial-era slur for Filipinos
  "intsik",       // derogatory for Chinese-Filipinos
  "bumbay",       // derogatory for Indians
  "negro",        // racial slur
  "moro",         // derogatory for Muslims (in PH context)
  "bakla",        // when used as slur for LGBTQ+
  "tomboy",       // when used derogatorily
];

const BLOCKED_PATTERN = new RegExp(
  BLOCKED_WORDS.map(
    (w) => `\\b${w.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`,
  ).join("|"),
  "i",
);

/**
 * Normalise common leet-speak / asterisk obfuscations before keyword matching.
 * Handles substitutions like f*ck → fuck, sh!t → shit, b*tch → bitch, etc.
 */
function normalizeObfuscation(text: string): string {
  return text
    // f*ck / f-ck / f@ck etc.
    .replace(/\bf[\*\.\-\_@!]ck\b/gi, "fuck")
    // sh*t / sh!t / sh-t
    .replace(/\bsh[\*\.\_@!-]t\b/gi, "shit")
    // b*tch / b!tch
    .replace(/\bb[\*\.\_@!-]tch\b/gi, "bitch")
    // a**hole / a**
    .replace(/\ba[\*\.\_@!]{1,2}hole\b/gi, "asshole")
    // c*nt / c!nt
    .replace(/\bc[\*\.\_@!-]nt\b/gi, "cunt")
    // p*ssy / p!ssy
    .replace(/\bp[\*\.\_@!-]ssy\b/gi, "pussy")
    // d*ck / d!ck
    .replace(/\bd[\*\.\_@!-]ck\b/gi, "dick")
    // w*ore / wh*re
    .replace(/\bwh?[\*\.\_@!-]re\b/gi, "whore")
    // sl*t / sl!t
    .replace(/\bsl[\*\.\_@!-]t\b/gi, "slut")
    // k*ll
    .replace(/\bk[\*\.\_@!-]ll\b/gi, "kill")
    // n*gger / n*gga / n1gger
    .replace(/\bn[\*\.\_@!1]gg[ae]r?\b/gi, "nigger")
    // f*g / f@g
    .replace(/\bf[\*\.\_@!-]g\b/gi, "fag")
    // Tagalog: g*go / g@go
    .replace(/\bg[\*\.\_@!-]go\b/gi, "gago")
    // t*nga / t@nga
    .replace(/\bt[\*\.\_@!-]nga\b/gi, "tanga")
    // p*ta / p@ta
    .replace(/\bp[\*\.\-\_@!-]ta\b/gi, "puta")
    // Space-separated letters: f u c k, s h i t, etc.
    .replace(/\bf\s+u\s+c\s+k\b/gi, "fuck")
    .replace(/\bs\s+h\s+i\s+t\b/gi, "shit")
    .replace(/\bb\s+i\s+t\s+c\s+h\b/gi, "bitch")
    .replace(/\bc\s+u\s+n\s+t\b/gi, "cunt")
    .replace(/\bd\s+i\s+c\s+k\b/gi, "dick")
    .replace(/\bp\s+u\s+s\s+s\s*y\b/gi, "pussy")
    .replace(/\bf\s+a\s+g\b/gi, "fag");
}

/**
 * Local keyword pre-check. Returns FLAGGED immediately if a blocked word is found,
 * skipping the OpenAI API call entirely.
 * Normalises obfuscation first so leet-speak variants are caught.
 */
function localKeywordCheck(text: string): ModerationResult | null {
  const normalized = normalizeObfuscation(text);
  const matched = BLOCKED_PATTERN.test(normalized);
  if (matched) {
    console.log("[Moderation] ⚠️ Local keyword match detected");
    console.log("[Moderation] Original text (first 100 chars):", text.substring(0, 100));
    console.log("[Moderation] Normalized text (first 100 chars):", normalized.substring(0, 100));
  }
  return matched ? "FLAGGED" : null;
}

// ── OpenAI client (lazy-init) ─────────────────
let openai: OpenAI | null = null;
if (env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

/**
 * Runs AI moderation on a piece of text.
 *
 * Uses the OpenAI Moderation API:
 * https://platform.openai.com/docs/api-reference/moderations
 *
 * Categories checked:
 *  - hate / hate/threatening
 *  - harassment / harassment/threatening
 *  - self-harm / self-harm/intent / self-harm/instructions
 *  - sexual / sexual/minors
 *  - violence / violence/graphic
 *
 * @returns 'SAFE'    — no categories flagged
 *          'FLAGGED' — one or more hard categories flagged (auto-reject)
 *          'REVIEW'  — edge-case scores require human review
 */
export async function moderateContent(text: string): Promise<ModerationResult> {
  console.log("[Moderation] Checking text (length:", text.length, "chars)");
  
  // ── 1. Local keyword check (fast, no API) ────
  const localResult = localKeywordCheck(text);
  if (localResult) {
    console.log("[Moderation] FLAGGED by local keyword check");
    return localResult;
  }

  // ── 2. Placeholder mode (no API key configured) ──
  if (!openai) {
    console.warn(
      "[Moderation] OPENAI_API_KEY not set — defaulting all content to SAFE. " +
        "Set the key in .env to enable real moderation.",
    );
    return "SAFE";
  }

  try {
    console.log("[Moderation] Calling OpenAI Moderation API...");
    const response = await openai.moderations.create({ input: text });
    const result = response.results[0];

    if (!result) return "REVIEW";

    if (result.flagged) {
      console.log("[Moderation] OpenAI flagged content:", result.categories);
      // ── Hard-reject: content that is genuinely dangerous or bigoted regardless
      //    of context.
      //
      //  Routes to hard-FLAGGED:
      //    • hate                        → slurs, bigotry, dehumanisation
      //    • hate/threatening            → identity-based death / harm threats
      //    • harassment/threatening      → explicit threats to a person
      //    • self-harm/instructions      → step-by-step methods (zero tolerance)
      //
      //  Routes to REVIEW instead (human moderator sees it):
      //    • self-harm / self-harm/intent → testimonies, disclosures, shared pain
      //    • sexual / sexual/minors       → abuse disclosures by survivors
      //    • harassment (non-threatening) → may be describing victimisation

      const categories = result.categories as unknown as Record<string, boolean>;
      const isHardFlagged =
        categories["hate"] ||
        categories["hate/threatening"] ||
        categories["harassment"] ||
        categories["harassment/threatening"] ||
        categories["self-harm/instructions"];

      const verdict = isHardFlagged ? "FLAGGED" : "REVIEW";
      console.log(`[Moderation] OpenAI verdict: ${verdict}`);
      return verdict;
    }

    // ── Score-based soft threshold (REVIEW zone) ──
    // Flag for human review if any score exceeds 0.7 even if not auto-flagged
    const scores = result.category_scores as unknown as Record<string, number>;
    const reviewThreshold = 0.7;
    const needsReview = Object.values(scores).some(
      (score) => score > reviewThreshold,
    );

    if (needsReview) {
      console.log("[Moderation] Scores triggering review:", 
        Object.entries(scores).filter(([_, score]) => score > reviewThreshold)
      );
    }

    const verdict = needsReview ? "REVIEW" : "SAFE";
    console.log(`[Moderation] OpenAI verdict: ${verdict}`);
    return verdict;
  } catch (err) {
    console.error("[Moderation] OpenAI API error:", err);
    // On API failure → mark for human REVIEW rather than blocking
    return "REVIEW";
  }
}
