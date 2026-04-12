# Functional Tests Reference

Complete guide for generating the functional test file — the most important deliverable of the quality playbook.

## Test File Naming

Use the project's language and test framework conventions:

| Language | File Name | Framework |
|----------|-----------|-----------|
| Python | `quality/test_functional.py` | pytest |
| TypeScript | `quality/functional.test.ts` | Jest / Vitest |
| JavaScript | `quality/functional.test.js` | Jest / Vitest |
| Java | `quality/FunctionalTest.java` | JUnit 5 |
| Scala | `quality/FunctionalSpec.scala` | ScalaTest / MUnit |
| Go | `quality/functional_test.go` | testing |
| Rust | `quality/functional_tests.rs` | built-in #[test] |

## Import Pattern

**This is the #1 cause of test failure.** Read how existing tests import project modules and copy that pattern exactly.

### Python
```python
# Check existing tests for sys.path manipulation
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Or if using a package structure with setup.py/pyproject.toml
from myproject.module import function

# Or if tests use relative imports
from ..module import function
```

### TypeScript / JavaScript
```typescript
// Check tsconfig.json for path aliases
import { handler } from '@/handlers/main';
import { process } from '../src/process';

// Check if the project uses require vs import
const { handler } = require('../src/handlers/main');
```

### Java
```java
// Match the package declaration from existing tests
package com.example.project;

import com.example.project.core.Processor;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;
```

### Scala
```scala
// Match existing test imports — sbt vs mill vs gradle paths differ
import com.example.project.core._
import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers
```

### Go
```go
// Go tests must be in the same package or use _test suffix
package mypackage_test

import (
    "testing"
    "github.com/user/project/pkg/core"
)
```

### Rust
```rust
// Integration tests in tests/ directory
use myproject::core::process;

// Unit tests inside the module
#[cfg(test)]
mod tests {
    use super::*;
}
```

## Test Structure

Organize into three logical groups:

### Group 1: Spec Requirements

One test per testable spec section. Each test documents which spec requirement it verifies.

```typescript
describe('Spec Requirements', () => {
  /**
   * Spec §3.1: "The system must accept JSON input with fields X, Y, Z"
   * [Req: formal — README §3.1]
   */
  test('accepts valid JSON input with required fields', () => {
    const result = process(validInput);
    expect(result.success).toBe(true);
  });
});
```

### Group 2: Fitness Scenarios

One test per QUALITY.md scenario. 1:1 mapping, named to match.

```typescript
describe('Fitness Scenarios', () => {
  /**
   * QUALITY.md Scenario 3: API Failure Returns Empty Data Without Signaling Error
   * Verifies that API failures are distinguishable from empty results.
   */
  test('scenario_3_api_failure_distinguishable_from_empty', () => {
    // ...exercise the defended code path...
  });
});
```

### Group 3: Boundaries and Edge Cases

One test per defensive pattern from Step 5.

```typescript
describe('Boundaries and Edge Cases', () => {
  /**
   * Defensive pattern: null check on user.profile (UserService.ts line ~42)
   * Boundary: user exists but profile is null
   */
  test('handles user with null profile', () => {
    // ...
  });
});
```

## Anti-Patterns

### ❌ Placeholder Tests
```python
def test_module_exists():
    """Don't do this."""
    import mymodule  # proves nothing
    assert True
```

### ❌ Trivial Assertions
```python
def test_returns_something():
    result = process(data)
    assert result is not None  # what IS the result?
```

### ❌ Testing Mocks Instead of Code
```python
def test_calls_api(mock_api):
    mock_api.get.return_value = {"key": "value"}
    result = fetch(mock_api)
    assert result == {"key": "value"}  # testing the mock's return value
```

### ❌ Guessing Function Signatures
```python
def test_process():
    # WRONG: didn't read the actual signature
    result = process("input", mode="fast")
    # ACTUAL signature: process(data: dict, config: Config)
```

### ✅ Real Functional Tests
```python
def test_process_generates_correct_output():
    config = Config(mode="fast", chunk_size=10)
    data = {"items": [{"id": 1, "name": "test"}]}
    result = process(data, config)
    assert result.output_count == 1
    assert result.items[0].processed_name == "TEST"
    assert result.metadata.duration_ms > 0
```

## Cross-Variant Strategy

If the project handles multiple input types, variants, or providers:

- **~30% of tests should be parametrized across all variants**
- These test cross-cutting properties that should hold regardless of variant
- Use the test framework's parametrization feature

### Python (pytest)
```python
@pytest.mark.parametrize("provider", ["openai", "anthropic", "local"])
def test_output_has_required_fields(provider):
    result = generate(prompt, provider=provider)
    assert "content" in result
    assert "model" in result
```

### TypeScript (Jest)
```typescript
test.each(["openai", "anthropic", "local"])(
  'output has required fields for %s provider',
  (provider) => {
    const result = generate(prompt, { provider });
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('model');
  }
);
```

### Java (JUnit 5)
```java
@ParameterizedTest
@ValueSource(strings = {"openai", "anthropic", "local"})
void outputHasRequiredFields(String provider) {
    Result result = generate(prompt, provider);
    assertNotNull(result.getContent());
    assertNotNull(result.getModel());
}
```

## Library Version Awareness

Check the project's dependency manifest before using test features. If a dependency might be missing, use conditional skips:

### Python
```python
pytest.importorskip("pandas")  # skip if pandas not installed
```

### TypeScript
```typescript
// Check if module is available
let myLib: typeof import('my-lib') | undefined;
try { myLib = require('my-lib'); } catch { /* not installed */ }

test('feature requiring my-lib', () => {
  if (!myLib) return; // or use jest skip
  // ...
});
```

### Java
```java
@EnabledIf("isLibraryAvailable")
@Test void featureRequiringLib() { /* ... */ }

static boolean isLibraryAvailable() {
    try { Class.forName("com.lib.Feature"); return true; }
    catch (ClassNotFoundException e) { return false; }
}
```

## Test Count Heuristic

Target = (testable spec sections) + (QUALITY.md scenarios) + (defensive patterns)

| Project Size | Source Files | Typical Test Count |
|-------------|-------------|-------------------|
| Small | 1–5 | 15–25 |
| Medium | 5–15 | 35–50 |
| Large | 15–50 | 50–80+ |

Significantly fewer suggests missed requirements or shallow exploration. Significantly more is fine if every test is meaningful — don't pad to hit a number.

## Key Rules Summary

1. Match the existing import pattern exactly
2. Read every function's signature before calling it
3. No placeholder tests — every test imports and calls real project code
4. Test outcomes (what spec says), not mechanisms (how code implements)
5. Use schema-valid mutations for boundary tests (from schema mapping)
6. Cross-variant coverage: ~30% parametrized across all variants
7. Every fitness scenario test maps 1:1 to a QUALITY.md scenario
