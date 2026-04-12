# Quality Constitution Reference

Full template and section-by-section guidance for `quality/QUALITY.md`.

## Template

```markdown
# Quality Constitution — [Project Name]

> Quality is not an act, it is a habit. — Aristotle
> Quality means fitness for use. — Joseph Juran
> Quality is free — but only for those willing to pay for it. — Philip Crosby

## 1. Purpose

[One paragraph: what quality means for THIS project specifically. Not "tests pass" — 
the actual operational requirement. What does "fitness for use" mean here?]

This constitution defines the quality bar for [project name]. Every AI session, every 
code review, and every test must meet or exceed these standards. If a change would 
lower the bar, it requires explicit human approval and a documented reason.

### Quality Philosophy

- **Deming**: Quality is built in, not inspected in. Tests are evidence of quality, 
  not the source of it.
- **Juran**: Fitness for use — does the system do what its users need under real 
  conditions?
- **Crosby**: Quality is free — preventing defects costs less than finding and fixing 
  them later.

## 2. Coverage Targets

| Subsystem | Target | Rationale |
|-----------|--------|-----------|
| [core module] | ≥ 90% | [Why — reference a specific scenario] |
| [API layer] | ≥ 85% | [Why — reference a specific risk] |
| [utilities] | ≥ 80% | [Why — lower risk, simpler logic] |
| [integration] | ≥ 75% | [Why — external dependencies make higher coverage impractical] |

**Rules:**
- Targets are floors, not ceilings
- Coverage means meaningful assertion coverage, not line-touched coverage
- A test that runs code without asserting correctness does NOT count toward coverage

## 3. Coverage Theater Prevention

These patterns inflate coverage numbers without catching real bugs. Do not write them.

### ❌ Import Tests
```
test("module imports successfully", () => {
  const mod = require("./module");
  expect(mod).toBeDefined();
});
```
Why it's theater: proves the file parses, catches zero logic bugs.

### ❌ Tautological Assertions
```
test("returns a result", () => {
  const result = process(input);
  expect(result).not.toBeNull();
});
```
Why it's theater: asserts something was returned, not that it's correct.

### ❌ Mock Echo Tests
```
test("calls the API", () => {
  mockApi.get.mockReturnValue({ data: "test" });
  const result = fetchData();
  expect(mockApi.get).toHaveBeenCalled();
});
```
Why it's theater: confirms the mock was called, not that the result is processed correctly.

### ❌ Presence-Only Assertions
```
test("has expected keys", () => {
  const result = buildConfig(input);
  expect(Object.keys(result)).toContain("name");
});
```
Why it's theater: checks structure, not values. The name could be wrong.

### ✅ What Real Tests Look Like
```
test("processes valid input correctly", () => {
  const result = process(validInput);
  expect(result.output).toBe(expectedOutput);
  expect(result.metadata.count).toBe(42);
  expect(result.errors).toHaveLength(0);
});
```

[Add 2–3 project-specific theater examples you found during exploration]

## 4. Fitness-to-Purpose Scenarios

Each scenario documents a realistic failure mode. These are not theoretical — each 
references specific code and has a concrete verification method.

### Scenario 1: [Title]

**What happened:** [Architectural vulnerability analysis with specific quantities 
and cascade consequences. Write in the voice of an incident report — concrete, 
non-negotiable.]

**Where in code:** `[file]` line ~N (`[function]`): [what the code does]

**How to verify:** [Test name in functional tests that exercises this scenario]

**Requirement tag:** [Req: tier — source]

---

### Scenario 2: [Title]

[Repeat for each scenario. Aim for 2+ per core module, typically 8–10 total.]

---

## 5. AI Session Quality Discipline

Every AI session working on this project must:

1. **Read this file first** before making any changes
2. **Run existing tests** before and after changes — `[test command]`
3. **Never reduce coverage** — check coverage impact before committing
4. **No placeholder tests** — every test must call project code and assert correctness
5. **No silent error swallowing** — if you add try/catch, log and re-throw or return error state
6. **Cite scenarios** — when fixing a bug, reference which scenario it relates to
7. **Update this file** — if you discover a new failure mode, add a scenario

### Before Committing Checklist

- [ ] All existing tests pass
- [ ] New code has tests that assert correctness (not just existence)
- [ ] No coverage theater patterns (see Section 3)
- [ ] Defensive code logs/signals failures (no silent swallowing)
- [ ] Changes don't introduce new state machine gaps

## 6. The Human Gate

These decisions require human judgment — AI sessions should flag them, not make them:

- **Changing coverage targets** — Lowering a target requires understanding the risk tradeoff
- **Removing defensive code** — Even if it looks unnecessary, it may exist for a reason
- **Architecture changes** — Modifying data flow, adding new external dependencies
- **Performance vs. correctness tradeoffs** — When faster means less safe
- **Spec ambiguities** — When the spec could be interpreted multiple ways
- **Cost-bearing operations** — Adding or modifying external API calls that incur costs
```

## Section-by-Section Guidance

### Section 1: Purpose

- Must be specific to THIS project — not generic quality advice
- Reference the project's actual domain and users
- Explain what "silently wrong" looks like for this system specifically
- Keep it to one strong paragraph

### Section 2: Coverage Targets

- Every target needs a rationale that references a specific scenario or risk
- Without rationale, future sessions will argue targets down to save effort
- Different subsystems should have different targets — uniform targets suggest no analysis
- Include the test command for measuring coverage

### Section 3: Coverage Theater Prevention

- Include at least 2 project-specific examples from exploration
- Show the bad pattern AND explain why it's theater
- Show what a real test looks like for the same code
- This section is read by AI sessions — be explicit and concrete

### Section 4: Fitness-to-Purpose Scenarios

This is the heart of the constitution. Each scenario must:

- **Reference real code** — file, line number, function name
- **Describe realistic failure** — not "input could be bad" but "if 10,000 records have field X missing, the batch silently produces empty output"
- **Include consequences** — who is affected, how many records, how long until detected
- **Map to a test** — every scenario has at least one functional test
- **Use the right voice** — architectural vulnerability analysis, not abstract specification

### Section 5: AI Session Quality Discipline

- Rules must be actionable — "run tests" with the actual command
- Include a pre-commit checklist
- Reference coverage theater patterns by section number
- Include the command to run tests

### Section 6: The Human Gate

- List decisions that AI should flag, not make
- Include examples specific to this project
- Keep it short — 5–8 items maximum
