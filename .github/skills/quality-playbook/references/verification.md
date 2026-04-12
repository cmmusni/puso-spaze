# Verification Reference

Complete self-check checklist for the quality playbook. Run every benchmark before declaring done.

## The 13 Benchmarks

### 1. Test Count Near Heuristic Target

**Formula:** (testable spec sections) + (QUALITY.md scenarios) + (defensive patterns)

| Project Size | Typical Range |
|-------------|---------------|
| Small (1–5 files) | 15–25 tests |
| Medium (5–15 files) | 35–50 tests |
| Large (15–50 files) | 50–80+ tests |

**Check:** Count your tests. If significantly below the heuristic, you missed requirements or explored too shallowly. If significantly above, verify every test is meaningful (no padding).

### 2. Scenario Coverage

**Check:** Count scenarios in QUALITY.md (Section 4). Count scenario tests in the functional test file (Group 2). These numbers must match.

```
QUALITY.md scenarios: N
Scenario tests: N
Match: YES / NO
```

If they don't match, either a scenario is missing a test or a test doesn't map to a scenario.

### 3. Cross-Variant Coverage (~30%)

**Check:** If the project handles multiple input types/variants/providers, count:

```
Total tests: N
Parametrized across all variants: M
Percentage: M/N × 100 = X%
Target: ~30%
```

If below 20%, add more cross-variant tests. If above 50%, some might be redundant.

### 4. Boundary Test Count

**Check:** Count defensive patterns found in Step 5. Count boundary tests in Group 3. These should be approximately equal.

```
Defensive patterns found: N
Boundary tests written: M
Ratio: M/N
Target: ≥ 1.0
```

### 5. Assertion Depth

**Check:** Sample 10 random tests. For each, classify the assertion:

| Assertion Type | Quality |
|---------------|---------|
| `assert result is not None` | **Shallow** — presence only |
| `assert isinstance(result, list)` | **Shallow** — type only |
| `assert len(result) > 0` | **Medium** — non-empty |
| `assert result[0].name == "expected"` | **Deep** — specific value |
| `assert result.total == 42.5` | **Deep** — exact value |

**Target:** Majority (>60%) of assertions should be Deep. If most are Shallow, the tests won't catch real bugs.

### 6. Layer Correctness

**Check:** For each test, verify it asserts OUTCOMES (what the spec says should happen), not MECHANISMS (how the code implements it).

```
✅ Outcome: assert output.contains("expected_text")
✅ Outcome: assert response.status == 200
❌ Mechanism: assert mock_db.save.called_once()
❌ Mechanism: assert len(internal_cache) == 5
```

**Target:** Zero mechanism assertions in functional tests. Mechanism assertions belong in unit tests.

### 7. Mutation Validity

**Check:** For every boundary test that mutates a fixture value, verify the mutated value is in the schema's "Accepts" range (from the schema mapping in Step 5b).

```
Test: test_boundary_count_minimum
Mutation: config.count = 1
Schema accepts: 1–1000
Valid: YES

Test: test_boundary_negative_count
Mutation: config.count = -1
Schema accepts: 1–1000
Valid: NO — this tests the validator, not business logic
```

**Target:** 100% of boundary test mutations use schema-valid values.

### 8. All Tests Pass (Zero Failures AND Zero Errors)

**Check:** Run the test suite with the project's test runner:

| Language | Command |
|----------|---------|
| Python | `pytest quality/ -v` |
| TypeScript | `npx jest quality/` or `npx vitest quality/` |
| Java | `mvn test -Dtest=FunctionalTest` or `gradle test --tests FunctionalTest` |
| Scala | `sbt "testOnly *FunctionalSpec"` |
| Go | `go test ./quality/ -v` |
| Rust | `cargo test --test functional_tests` |

**Critical:** Check BOTH the failure count AND the error count. `0 failures, 16 errors` is NOT passing — it means 16 tests couldn't even run (missing fixtures, import errors, etc.).

```
Test results:
  Passed: N
  Failed: 0    ← must be zero
  Errors: 0    ← must ALSO be zero
```

If errors exist, the most common causes are:
- Wrong import pattern (didn't match existing tests)
- Missing fixture/setup file
- Referenced undefined test helpers
- Wrong function signature (didn't read the `def` line)

### 9. Existing Tests Unbroken

**Check:** Run the project's existing test suite — not just the new quality tests:

```bash
[project's existing test command]
```

**Target:** Same pass rate as before adding the quality playbook. If any existing test now fails, the new files broke something (likely an import conflict or name collision).

### 10. Integration Test Quality Gates from Field Reference Table

**Check:** Did you build a Field Reference Table (in RUN_INTEGRATION_TESTS.md) by re-reading each schema file before writing quality gates?

Verify:
- [ ] Field Reference Table exists in the protocol
- [ ] Every field name in quality gates appears in the Field Reference Table
- [ ] Field names are character-for-character matches to schema definitions
- [ ] ALL fields from each schema are included (not just some)

### 11. QUALITY.md Scenarios Are Grounded

**Check:** For each scenario in QUALITY.md Section 4:

- [ ] References a specific file and function
- [ ] Includes specific quantities (not "could fail" but "will corrupt N records")
- [ ] Has a "How to verify" that maps to a real test
- [ ] Uses the correct requirement tag format: `[Req: tier — source]`

### 12. Code Review Guardrails Present

**Check:** RUN_CODE_REVIEW.md includes all five mandatory guardrails:

- [ ] Line numbers mandatory
- [ ] Read function bodies, not just signatures
- [ ] QUESTION vs BUG distinction
- [ ] Grep before claiming missing
- [ ] No style suggestions

### 13. AGENTS.md Updated

**Check:** AGENTS.md (new or updated) includes pointers to:

- [ ] `quality/QUALITY.md`
- [ ] Functional test file
- [ ] `quality/RUN_CODE_REVIEW.md`
- [ ] `quality/RUN_INTEGRATION_TESTS.md`
- [ ] `quality/RUN_SPEC_AUDIT.md`

## Verification Workflow

```
1. Run tests → Check benchmarks 8 and 9
2. Count tests → Check benchmarks 1, 2, 3, 4
3. Sample assertions → Check benchmarks 5, 6, 7
4. Read QUALITY.md → Check benchmark 11
5. Read RUN_CODE_REVIEW.md → Check benchmark 12
6. Read RUN_INTEGRATION_TESTS.md → Check benchmark 10
7. Read AGENTS.md → Check benchmark 13
```

If any benchmark fails, fix it before proceeding to Phase 4.

## Common Failures and Fixes

| Benchmark | Common Failure | Fix |
|-----------|---------------|-----|
| 1 | Too few tests | Re-explore: missed spec sections or defensive patterns |
| 2 | Scenario count mismatch | Add missing tests or remove orphaned scenarios |
| 5 | Shallow assertions | Replace `is not None` with specific value checks |
| 7 | Invalid mutations | Re-read schema, use values in Accepts range |
| 8 | Import errors | Match existing test import pattern exactly |
| 8 | Missing fixtures | Create conftest.py / setup file with required fixtures |
| 10 | Wrong field names | Re-read schema files, rebuild Field Reference Table |
