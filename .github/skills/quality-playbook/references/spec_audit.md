# Spec Audit Reference — Council of Three

Full protocol for the multi-model specification audit.

## Why Three Models?

Each AI model has different blind spots:

- **Model A** might excel at finding logic errors but miss security issues
- **Model B** might catch race conditions but overlook edge cases
- **Model C** might find spec compliance gaps but miss performance issues

In practice, cross-referencing three independent audits catches 40–60% more defects than any single audit. The technique works because models fail differently — they don't share the same blind spots.

## The Audit Protocol

### Setup

1. Choose three AI models (e.g., Claude, GPT-4, Gemini, or three sessions of the same model with different prompts)
2. Each model works independently — do NOT share findings between models until triage
3. Each model gets the same audit prompt (below) but different scrutiny area emphasis

### The Audit Prompt

Copy-paste this prompt to each model, customizing the project-specific sections:

````markdown
# Spec Audit — [Project Name]

You are auditing this codebase against its specifications. Your goal is to find places 
where the code does NOT match what the specs say it should do.

## Read First

1. `quality/QUALITY.md` — Quality constitution
2. `AGENTS.md` — Project context
3. [List spec documents with paths]

## Your Assignment

Audit these files against the specifications:

[List source files to audit]

## Scrutiny Areas

Focus especially on:

1. [Project-specific area — e.g., "State transitions in the batch processor"]
2. [Project-specific area — e.g., "Error recovery in API client"]
3. [Project-specific area — e.g., "Validation completeness in input schemas"]

## Rules

1. **Evidence required.** For every finding, cite:
   - The spec section that defines the expected behavior
   - The code file and line number where behavior differs
   - What the spec says vs. what the code does

2. **Line numbers are mandatory.** No line number → not a finding.

3. **Read function bodies.** Do not claim a function is missing error handling 
   based only on its signature. Read the implementation.

4. **Grep before claiming missing.** Before saying "there's no X," search for it.

5. **Distinguish severity:**
   - **DEFECT** — Code clearly contradicts spec
   - **GAP** — Spec requirement with no corresponding code
   - **AMBIGUITY** — Spec could be interpreted multiple ways; code chose one
   - **ENHANCEMENT** — Code works but spec implies a higher standard

6. **Do NOT report:**
   - Style issues
   - Performance opinions without evidence
   - "Best practice" suggestions unrelated to specs

## Output Format

```
### Finding [N]: [Title]

**Severity:** DEFECT | GAP | AMBIGUITY | ENHANCEMENT

**Spec reference:** [Document § Section] — "[relevant quote]"

**Code reference:** `[file]` line [N]

**Expected behavior:** [What the spec says]

**Actual behavior:** [What the code does]

**Evidence:**
```[language]
[relevant code snippet]
```

**Impact:** [What breaks or could break]
```

Report all findings, then provide a summary count by severity.
````

### Customizing Per Model

Give each model slightly different emphasis:

| Model | Primary Focus | Secondary Focus |
|-------|--------------|-----------------|
| Auditor 1 | Core business logic, data flow correctness | State machine completeness |
| Auditor 2 | Error handling, edge cases, boundary conditions | Security and input validation |
| Auditor 3 | Spec compliance, missing features, API contracts | Integration points and external deps |

## Triage Process

After all three models complete their audits:

### Step 1: Collect All Findings

Gather all findings into a single list. Tag each with which model(s) found it.

### Step 2: Merge Duplicates

If multiple models found the same issue, merge into one finding and note the agreement:

```
### Finding 7: Missing validation on batch_size parameter

**Found by:** Auditor 1, Auditor 3 (2/3 agreement)
**Severity:** DEFECT
...
```

### Step 3: Classify by Confidence

| Confidence | Criteria | Action |
|-----------|----------|--------|
| **High** | Found by 2+ models, or by 1 model with strong evidence | Fix immediately |
| **Medium** | Found by 1 model with reasonable evidence | Investigate, then fix or dismiss |
| **Low** | Found by 1 model with weak evidence | Flag for human review |
| **Dismissed** | Contradicted by another model's evidence, or clearly wrong | Document why dismissed |

### Step 4: Prioritize

1. DEFECT (High confidence) — fix first
2. GAP (High confidence) — fix second
3. DEFECT (Medium confidence) — investigate
4. Everything else — batch for review

## Fix Execution Rules

### Small Batches by Subsystem

Do NOT create a mega-prompt with all fixes. Fix in small batches:

1. Group findings by subsystem (e.g., all API handler fixes together)
2. Fix one subsystem at a time
3. Run tests after each batch
4. Verify the fix doesn't break existing behavior

### Fix-and-Test Cycle

```
For each batch:
  1. Read the findings for this subsystem
  2. Make the fixes
  3. Run existing tests: [test command]
  4. Run functional tests: [test command]
  5. If any test breaks, diagnose before proceeding
  6. Commit with message referencing finding numbers
```

### Fix Verification

After all fixes are applied:

1. Run the full test suite
2. Re-run the audit on fixed files (one model is sufficient)
3. Verify each finding is resolved
4. Update `quality/QUALITY.md` if new scenarios were discovered

## Output Files

Save audit results to `quality/spec_audits/`:

```
quality/spec_audits/
├── audit_[model1]_[date].md
├── audit_[model2]_[date].md
├── audit_[model3]_[date].md
└── triage_[date].md
```

The triage file contains the merged, classified, prioritized findings — this is the actionable output.

## Scheduling

- **Initial:** Run the full Council of Three when setting up the quality playbook
- **After major changes:** Run on modified subsystems (one model may suffice for small changes)
- **Quarterly:** Full re-audit to catch drift between spec and code
- **New team member (AI or human):** Point them to the latest triage file
