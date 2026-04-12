# Defensive Patterns Reference

How to systematically find defensive code patterns and convert them into fitness-to-purpose scenarios and boundary tests.

## Why Defensive Patterns Matter

Every `try/catch`, null check, retry loop, or fallback value in production code exists because someone got burned. These patterns are archaeological evidence of past failures. Finding them tells you:

1. What went wrong before (the failure that motivated the defense)
2. What could go wrong again (the category of risk)
3. What the code considers "hostile input" (boundary conditions)

## Systematic Search Approach

### Step 1: Grep for Defensive Code

Search the codebase systematically using language-appropriate patterns. Run these searches across all source files (not tests).

#### Python
```bash
grep -rn "try:" --include="*.py" src/
grep -rn "except\s" --include="*.py" src/
grep -rn "if.*is None" --include="*.py" src/
grep -rn "if.*not\s" --include="*.py" src/
grep -rn "\.get(" --include="*.py" src/        # dict.get() with default
grep -rn "or\s\[\]" --include="*.py" src/       # fallback to empty list
grep -rn "or\s{}" --include="*.py" src/         # fallback to empty dict
grep -rn "or\s\"\"|or\s''" --include="*.py" src/ # fallback to empty string
grep -rn "retry\|retries\|backoff" --include="*.py" src/
grep -rn "timeout" --include="*.py" src/
grep -rn "logging\.\(warning\|error\|critical\)" --include="*.py" src/
```

#### TypeScript / JavaScript
```bash
grep -rn "try\s*{" --include="*.ts" --include="*.tsx" src/
grep -rn "catch\s*(" --include="*.ts" --include="*.tsx" src/
grep -rn "\?\?" --include="*.ts" --include="*.tsx" src/          # nullish coalescing
grep -rn "\?\." --include="*.ts" --include="*.tsx" src/          # optional chaining
grep -rn "if.*===\s*null\|if.*===\s*undefined" --include="*.ts" src/
grep -rn "|| \[\]\||| {}\||| ''" --include="*.ts" src/          # fallback defaults
grep -rn "retry\|retries\|backoff" --include="*.ts" src/
grep -rn "timeout\|setTimeout" --include="*.ts" src/
grep -rn "console\.\(warn\|error\)" --include="*.ts" src/
```

#### Java
```bash
grep -rn "try\s*{" --include="*.java" src/
grep -rn "catch\s*(" --include="*.java" src/
grep -rn "if.*==\s*null" --include="*.java" src/
grep -rn "Optional\." --include="*.java" src/
grep -rn "Objects\.requireNonNull" --include="*.java" src/
grep -rn "retry\|retries\|backoff" --include="*.java" src/
grep -rn "timeout" --include="*.java" src/
grep -rn "LOG\.\(warn\|error\)" --include="*.java" src/
```

#### Scala
```bash
grep -rn "Try\[" --include="*.scala" src/
grep -rn "\.recover\|\.recoverWith" --include="*.scala" src/
grep -rn "Option\[" --include="*.scala" src/
grep -rn "\.getOrElse" --include="*.scala" src/
grep -rn "match\s*{" --include="*.scala" src/    # pattern matching (check for missing cases)
grep -rn "case\s*_\s*=>" --include="*.scala" src/ # catch-all cases
grep -rn "retry\|retries\|backoff" --include="*.scala" src/
```

#### Go
```bash
grep -rn "if err != nil" --include="*.go" src/
grep -rn "recover()" --include="*.go" src/
grep -rn "if.*== nil" --include="*.go" src/     # nil checks on non-error values
grep -rn "retry\|retries\|backoff" --include="*.go" src/
grep -rn "context\.WithTimeout\|context\.WithDeadline" --include="*.go" src/
grep -rn "log\.\(Warn\|Error\|Fatal\)" --include="*.go" src/
```

#### Rust
```bash
grep -rn "unwrap()\|expect(" --include="*.rs" src/   # panicking unwraps
grep -rn "match.*{" --include="*.rs" src/
grep -rn "if let Some\|if let Ok\|if let Err" --include="*.rs" src/
grep -rn "\.unwrap_or\|\.unwrap_or_else\|\.unwrap_or_default" --include="*.rs" src/
grep -rn "anyhow\|thiserror" --include="*.rs" src/
grep -rn "retry\|retries\|backoff" --include="*.rs" src/
```

### Step 2: Read the Context (Not Just the Match)

For each grep hit, read 10–20 lines of surrounding context. You need to understand:

1. **What operation is being defended?** (API call, file parse, database query, user input)
2. **What's the failure mode?** (missing data, malformed input, timeout, permission error)
3. **What's the recovery strategy?** (retry, fallback, skip, abort, log-and-continue)
4. **Is the recovery correct?** (Does silently returning `[]` when data is missing mask a real problem?)

### Step 3: Classify Each Pattern

| Category | Example | Risk Level |
|----------|---------|------------|
| **Silent swallow** | `except: pass` or `catch(e) {}` | Critical — hides failures |
| **Fallback default** | `value = data.get("key", [])` | Medium — may mask missing data |
| **Retry logic** | `for attempt in range(3)` | Medium — may mask persistent failures |
| **Null guard** | `if result is not None` | Low-Medium — depends on what happens when null |
| **Type coercion** | `int(value) if value else 0` | Medium — may produce wrong results silently |
| **Timeout** | `timeout=30` | Low — but what happens AFTER timeout? |
| **Logging without action** | `logger.error(f"Failed: {e}")` | Medium — someone monitors logs, right? |

## Converting Findings to Scenarios

Each defensive pattern becomes a fitness-to-purpose scenario in QUALITY.md using this template:

### Scenario Template

```markdown
### Scenario N: [Descriptive Name]

**What happened:** [Architectural vulnerability analysis — what failure mode does this 
code permit? Use specific quantities and consequences.]

**Where in code:** `module.py` line ~N (`function_name`): [what the defensive code does]

**How to verify:** [Specific test or verification method — must map to a test in functional tests]

**Requirement tag:** [Req: inferred — from try/except in parse_response()]
```

### Example Conversion

**Grep finding:**
```python
# api_client.py line 142
try:
    response = requests.get(url, timeout=30)
    data = response.json()
except (requests.Timeout, json.JSONDecodeError) as e:
    logger.warning(f"API call failed: {e}")
    return []
```

**Becomes scenario:**
```markdown
### Scenario 3: API Failure Returns Empty Data Without Signaling Error

**What happened:** Because `fetch_items()` catches Timeout and JSONDecodeError and 
returns `[]`, a downstream consumer cannot distinguish between "the API returned zero 
items" and "the API is down." If the API is down for 6 hours during a batch run processing 
50,000 records, the system silently produces empty results for every batch — and reports 
success. The operator has no signal that anything went wrong until end users report 
missing data.

**Where in code:** `api_client.py` line ~142 (`fetch_items`): catches timeout/parse errors 
and returns empty list

**How to verify:** Test that API failures propagate distinguishably from empty results — 
either via exception, return type, or status flag.
```

## Converting Findings to Boundary Tests

Each defensive pattern also produces one or more boundary tests:

1. **Test the defended path** — Trigger the exact condition the code defends against. Does the defense work correctly?
2. **Test the boundary** — What's the value just inside/outside the defense threshold?
3. **Test the cascade** — What happens downstream when the defense activates?

### Example Boundary Tests

From the API failure pattern above:

```
Test 1: fetch_items returns empty list on timeout (defended path)
Test 2: fetch_items returns empty list on malformed JSON (defended path)
Test 3: downstream consumer handles empty results correctly (cascade)
Test 4: distinguish between "API returned 0 items" vs "API failed" (cascade gap)
```

## Minimum Bar

- At least 2–3 defensive patterns per core source file
- If you find fewer, you're skimming — read function bodies, not just signatures
- Every pattern should produce at least one scenario OR one boundary test (usually both)
- Critical patterns (silent swallows, fallback defaults) should produce both

## What to Ignore

- Standard library error handling that's genuinely boilerplate (e.g., file-not-found on config load at startup)
- Test code defensive patterns (tests are supposed to handle errors)
- Comments that describe hypothetical defenses but aren't implemented
