# Spec Audit Protocol — Council of Three — PUSO Spaze

## Overview

Three independent AI models audit the PUSO Spaze codebase against its specifications. Each model works independently — do NOT share findings between models until triage.

## Bootstrap Files

Each auditor reads these files first:

1. `quality/QUALITY.md` — Quality constitution (10 scenarios, coverage targets)
2. `.github/copilot-instructions.md` — Platform constraints and design system
3. `packages/types/index.ts` — Shared TypeScript interfaces
4. `server/prisma/schema.prisma` — Data models and constraints
5. `memory-bank/systemPatterns.md` — Architecture patterns
6. `memory-bank/productContext.md` — Product context and user stories

## The Audit Prompt

Copy-paste this prompt to each model, adjusting the "Your Focus" section per model:

````markdown
# Spec Audit — PUSO Spaze

You are auditing the PUSO Spaze codebase against its specifications. Your goal is to find places where the code does NOT match what the specs say it should do.

## Read First

1. `quality/QUALITY.md`
2. `.github/copilot-instructions.md`
3. `packages/types/index.ts`
4. `server/prisma/schema.prisma`

## Files to Audit

**Server core:**
- `server/src/controllers/postController.ts`
- `server/src/controllers/commentController.ts`
- `server/src/controllers/userController.ts`
- `server/src/controllers/authController.ts`
- `server/src/controllers/adminController.ts`
- `server/src/controllers/reactionController.ts`
- `server/src/controllers/journalController.ts`
- `server/src/controllers/notificationController.ts`
- `server/src/controllers/conversationController.ts`
- `server/src/controllers/coachController.ts`

**Services:**
- `server/src/services/moderationService.ts`
- `server/src/services/encouragementScheduler.ts`
- `server/src/services/biblicalEncouragementService.ts`
- `server/src/services/notificationService.ts`
- `server/src/services/mentionService.ts`
- `server/src/services/newUserAlertService.ts`
- `server/src/services/appConfigService.ts`

**Config & middleware:**
- `server/src/config/env.ts`
- `server/src/middlewares/validate.ts`

**Client validators:**
- `apps/mobile/utils/validators.ts`

## Scrutiny Areas

[CUSTOMIZE PER MODEL — SEE BELOW]

## Rules

1. **Evidence required.** For every finding, cite:
   - The spec/type/schema that defines the expected behavior
   - The code file and line number where behavior differs
   - What the spec says vs. what the code does

2. **Line numbers are mandatory.** No line number → not a finding.

3. **Read function bodies.** Do not claim a function has a bug based only on its signature.

4. **Grep before claiming missing.** Before saying "there's no X," search for it.

5. **Distinguish severity:**
   - **DEFECT** — Code clearly contradicts spec / type / schema
   - **GAP** — Spec/type requirement with no corresponding code
   - **AMBIGUITY** — Spec could be interpreted multiple ways; code chose one
   - **ENHANCEMENT** — Code works but spec implies a higher standard

6. **Do NOT report:** Style issues, performance opinions without evidence, "best practice" suggestions unrelated to specs.

## Output Format

```
### Finding [N]: [Title]

**Severity:** DEFECT | GAP | AMBIGUITY | ENHANCEMENT

**Spec reference:** [Document / Type / Schema] — "[relevant definition]"

**Code reference:** `[file]` line [N]

**Expected behavior:** [What the spec/type says]

**Actual behavior:** [What the code does]

**Evidence:**
\`\`\`typescript
[relevant code]
\`\`\`

**Impact:** [What breaks or could break]
```

Report all findings, then provide a summary count by severity.
````

## Per-Model Focus

| Model | Primary Focus | Secondary Focus |
|-------|--------------|-----------------|
| Auditor 1 | Content moderation flow, ModerationStatus handling, anonymous mode | State machine completeness (SAFE/FLAGGED/REVIEW transitions) |
| Auditor 2 | Auth, device ownership, admin security, invite code logic | Input validation, boundary conditions, error handling |
| Auditor 3 | Type compliance (do controllers match TypeScript interfaces?), notification contracts | Prisma schema alignment, cascade deletes, unique constraints |

### Auditor 1 — Scrutiny Areas
```
Focus especially on:
1. ModerationStatus handling — does every consumer handle all three states (SAFE, FLAGGED, REVIEW)?
2. Anonymous mode — is the real displayName EVER leaked in responses, notifications, or logs?
3. Moderation fallback behavior — what happens when OpenAI is unavailable?
4. Encouragement scheduler — does system-generated content get properly moderated?
5. Post feed queries — are FLAGGED posts correctly hidden? Are REVIEW posts handled consistently?
```

### Auditor 2 — Scrutiny Areas
```
Focus especially on:
1. Device ownership check — can it be bypassed by omitting deviceId?
2. Admin secret handling — is the hardcoded default used correctly?
3. Invite code validation — race conditions, reuse prevention, case sensitivity
4. Input validation gaps — are all user inputs validated before DB operations?
5. Error handling — are errors swallowed silently or properly propagated?
```

### Auditor 3 — Scrutiny Areas
```
Focus especially on:
1. Do controller response shapes match the TypeScript interfaces in packages/types/index.ts?
2. Are all Prisma model fields used correctly (correct types, required vs optional)?
3. Do cascade deletes work correctly for all relations?
4. Notification payloads — do they match the NotificationType enum and expected data shape?
5. API endpoint contracts — do request/response types match what the client sends/expects?
```

## Triage Process

### Step 1: Collect
Gather all findings from all three models.

### Step 2: Merge Duplicates
If multiple models found the same issue:
```
### Finding N: [Title]
**Found by:** Auditor 1, Auditor 3 (2/3 agreement)
```

### Step 3: Classify by Confidence

| Confidence | Criteria | Action |
|-----------|----------|--------|
| **High** | Found by 2+ models, or by 1 with strong evidence | Fix immediately |
| **Medium** | Found by 1 model with reasonable evidence | Investigate |
| **Low** | Found by 1 model with weak evidence | Flag for human review |
| **Dismissed** | Contradicted by another model's evidence | Document why |

### Step 4: Prioritize
1. DEFECT (High confidence) — fix first
2. GAP (High confidence) — fix second
3. DEFECT (Medium confidence) — investigate
4. Everything else — batch for review

## Fix Execution Rules

### Small Batches by Subsystem
1. Group findings by module (e.g., all moderation fixes together)
2. Fix one module at a time
3. Run tests after each batch: `cd server && npm test && cd .. && npx tsx --test quality/functional.test.ts`
4. Commit with message: `fix(quality): address audit findings #N, #M in [module]`

### Fix Verification
After all fixes:
1. Run full test suite
2. Re-audit fixed files (one model sufficient)
3. Update `quality/QUALITY.md` if new scenarios discovered

## Output Files

```
quality/spec_audits/
├── audit_auditor1_YYYY-MM-DD.md
├── audit_auditor2_YYYY-MM-DD.md
├── audit_auditor3_YYYY-MM-DD.md
└── triage_YYYY-MM-DD.md
```
