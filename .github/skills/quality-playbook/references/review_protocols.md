# Review Protocols Reference

Templates for `quality/RUN_CODE_REVIEW.md` and `quality/RUN_INTEGRATION_TESTS.md`.

---

## Part 1: Code Review Protocol Template

```markdown
# Code Review Protocol — [Project Name]

## Bootstrap

Before starting the review, read these files in order:

1. `quality/QUALITY.md` — Quality constitution (fitness scenarios, coverage targets)
2. `AGENTS.md` — Project context and architecture
3. `[README or other key docs]`

## Scope

Review [describe scope — specific files, modules, or the entire project].

## Focus Areas

| # | Area | Files | What to Look For |
|---|------|-------|-----------------|
| 1 | [e.g., Data validation] | `src/validators/` | [Missing validation, silent coercion] |
| 2 | [e.g., Error handling] | `src/services/` | [Silent swallowing, missing retry logic] |
| 3 | [e.g., State management] | `src/models/` | [Incomplete state transitions, missing guards] |
| ... | | | |

## Mandatory Guardrails

These guardrails prevent the most common AI code review failures:

### 1. Line Numbers Are Mandatory
Every finding MUST include a file path and line number. No line number → not a finding.

```
✅ BUG: `src/api/handler.ts` line 42 — missing null check on `user.profile`
❌ BUG: The handler doesn't check for null profiles  (WHERE?)
```

### 2. Read Function Bodies, Not Just Signatures
Before claiming a function has a bug, read the ENTIRE function body. Many "bugs" are 
actually handled deeper in the function or in a called helper.

### 3. If Unsure: QUESTION, Not BUG
```
✅ QUESTION: `src/utils/parse.ts` line 87 — is the fallback to empty string intentional 
   here? If `data.name` is undefined, downstream consumers get "" instead of an error.
❌ BUG: Missing null check on data.name  (maybe it's intentional)
```

### 4. Grep Before Claiming Missing
Before saying "there's no validation for X," search the codebase:
```bash
grep -rn "validate.*fieldName" src/
grep -rn "fieldName.*check\|fieldName.*valid" src/
```
If you find it elsewhere, adjust your finding. If you still can't find it, include your 
search command in the finding.

### 5. No Style Suggestions
Do NOT flag: naming conventions, comment style, import ordering, formatting, whitespace.
Only flag things that are **incorrect** — wrong behavior, missing validation, logic errors,
security issues.

## Finding Format

```
[SEVERITY]: `[file]` line [N] — [one-line description]

Detail: [2-3 sentences explaining the issue, including what happens and why it matters]

Evidence: [the actual code, or the grep command that found/didn't find something]

Suggested fix: [concrete suggestion, not "add validation"]
```

Severity levels:
- **BUG** — Confirmed incorrect behavior
- **RISK** — Code that could fail under specific conditions
- **QUESTION** — Potentially intentional, needs human judgment

## Phase 2: Regression Tests

After the review produces BUG findings, write regression tests:

1. For each BUG finding, write a test in `quality/test_regression.*` that reproduces the bug
2. Each test should FAIL on the current implementation (confirming the bug is real)
3. If the test passes, the "bug" might be a false positive — investigate

### Regression Test Template

```typescript
describe('Regression Tests from Code Review', () => {
  /**
   * Review Finding #3 (BUG): handler.ts line 42
   * Missing null check on user.profile causes TypeError
   */
  test('regression_review_3_null_profile_handling', () => {
    const userWithoutProfile = { id: 1, name: 'Test', profile: null };
    // This should not throw — currently it does (TypeError)
    expect(() => handler(userWithoutProfile)).not.toThrow();
    // Or: should return a meaningful error
    const result = handler(userWithoutProfile);
    expect(result.error).toBeDefined();
  });
});
```

### Confirmation Table

After running regression tests, report results:

| Finding | Severity | Regression Test | Result |
|---------|----------|----------------|--------|
| #1 | BUG | `test_regression_1_...` | BUG CONFIRMED — test fails as expected |
| #2 | BUG | `test_regression_2_...` | FALSE POSITIVE — test passes, behavior is correct |
| #3 | BUG | `test_regression_3_...` | NEEDS INVESTIGATION — test errors on setup |
| #4 | RISK | (not testable without external service) | DEFERRED |
```

---

## Part 2: Integration Test Protocol Template

```markdown
# Integration Test Protocol — [Project Name]

## Working Directory

All commands run from the project root using relative paths.
```bash
cd /path/to/project  # Only shown for reference; use relative paths below
```

## Safety Constraints

- [ ] Never run against production databases or services
- [ ] Use test/staging API keys only
- [ ] Set rate limits appropriate for test runs
- [ ] Clean up test data after each run
- [ ] Maximum cost per test run: $[amount] (estimate)

## Pre-Flight Checks

Before running any tests:

```bash
# 1. Verify environment
[command to check env vars / config]

# 2. Verify dependencies
[command to check required services are running]

# 3. Verify test data exists
[command to check fixture files / seed data]

# 4. Verify clean state
[command to check no leftover test artifacts]
```

## Test Matrix

| # | Test Group | What It Exercises | Pass Criteria | Estimated Duration |
|---|-----------|-------------------|---------------|-------------------|
| 1 | Happy path | [Normal flow end-to-end] | [Specific criteria] | ~Ns |
| 2 | Cross-variant | [All input types/providers] | [Consistent output shape] | ~Ns |
| 3 | Error handling | [Failure scenarios] | [Graceful degradation] | ~Ns |
| 4 | Component boundary | [Service-to-service] | [Contract compliance] | ~Ns |

## Execution UX

When an AI agent runs this protocol, it should follow these three phases:

### Phase 1: Show the Plan

Before running anything, display:

```
Integration Test Plan:

| # | Test | Status |
|---|------|--------|
| 1 | Happy path — basic flow | ⧖ pending |
| 2 | Happy path — with options | ⧖ pending |
| 3 | Cross-variant — provider A | ⧖ pending |
| 4 | Cross-variant — provider B | ⧖ pending |
| ... | | |
```

### Phase 2: Progress Updates

As each test runs, report one line:

```
✓ Test 1: Happy path — basic flow (2.3s)
✓ Test 2: Happy path — with options (1.8s)
✗ Test 3: Cross-variant — provider A (FAILED: timeout after 30s)
⧗ Test 4: Cross-variant — provider B (running...)
```

### Phase 3: Summary

After all tests complete:

```
Integration Test Results:

| # | Test | Result | Duration |
|---|------|--------|----------|
| 1 | Happy path — basic flow | ✓ PASS | 2.3s |
| 2 | Happy path — with options | ✓ PASS | 1.8s |
| 3 | Cross-variant — provider A | ✗ FAIL | 30.0s |
| 4 | Cross-variant — provider B | ✓ PASS | 3.1s |

Passed: 3/4 (75%)
Failed: 1/4

Recommendation: INVESTIGATE — Test 3 timeout suggests [provider A] connectivity issue.
Run `[diagnostic command]` to verify.
```

## Quality Gates

### The Field Reference Table

**Build this table BEFORE writing any quality gate checks.** Re-read each schema file 
immediately before writing each row. Do not rely on memory — copy field names 
character-by-character from the source files.

| Schema File | Field Name | Type | Valid Range | Notes |
|-------------|-----------|------|-------------|-------|
| `[schema file]` | `[exact_field_name]` | `[type]` | `[range/enum]` | `[from schema]` |
| | | | | |

### Per-Component Quality Checks

For each component in the test matrix:

```bash
# Component: [name]
# Schema: [file path]
# Fields to verify:

# 1. [field_name] — [type] — [valid range]
[command to extract and check this field]

# 2. [field_name] — [type] — [valid range]
[command to extract and check this field]
```

## Parallel Execution

Group independent tests for concurrent execution:

```bash
# Group 1: Independent provider tests (run in parallel)
./scripts/test_provider_a.sh &
PID_A=$!

./scripts/test_provider_b.sh &
PID_B=$!

wait $PID_A $PID_B

# Group 2: Depends on Group 1 results
./scripts/test_cross_provider.sh
```

## Post-Run Verification

After each test completes, verify:

1. **Log files exist** and contain expected entries
2. **Output data exists** in expected location
3. **Sample records** have correct field values (check 3–5 records)
4. **State is clean** — no orphaned processes, temp files, or connections
5. **Existing quality scripts** pass:
```bash
[command to run existing verification tools]
```

## Cleanup

```bash
# Remove test data
[cleanup commands]

# Verify cleanup
[verification commands]
```

## Structured Report

Save results to `quality/results/integration_[date].md`:

```markdown
# Integration Test Results — [date]

## Environment
- [Runtime version]
- [Service versions]
- [Config used]

## Results
[Summary table from Execution UX Phase 3]

## Failures
[Detail for each failed test]

## Recommendations
[Action items]
```
```

## The Field Reference Table

This is the most important step for integration test accuracy. AI models confidently write wrong field names even after reading schemas.

### The Problem

After reading a schema with fields like `document_id`, `sentiment_score`, `created_at`, an AI model writing quality gates 2,000 tokens later will drift to `doc_id`, `sentiment`, `createdAt`. This happens consistently across all models.

### The Fix

1. **For each schema in the project**, re-read the file immediately before writing the table row
2. **Copy field names character-by-character** from the file contents displayed by the tool
3. **Include ALL fields** from each schema — if the schema has 8 fields, the table has 8 rows
4. **Include the type and valid range** from the schema definition
5. **Build the table first**, then write quality gate checks that reference it

### Process

```
For each schema file:
  1. Read the file (read_file tool)
  2. For each field in the schema:
     a. Copy the exact field name
     b. Record the type
     c. Record constraints (min/max, enum values, required/optional)
  3. Write one row in the Field Reference Table
  4. THEN write the quality gate check for that field
```

Do not batch-write quality gates from memory. Write each gate immediately after reading its schema field.
