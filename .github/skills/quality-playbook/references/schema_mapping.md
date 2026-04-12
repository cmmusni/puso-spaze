# Schema Mapping Reference

How to map schema types to boundary test values and ensure mutation validity.

## Why Schema Mapping Matters

The most common functional test failure is writing boundary tests with values the schema rejects. If a field is validated as `enum["A", "B", "C"]` and your test passes `"D"`, you're testing the validator — not the business logic. Boundary tests must use values the schema *accepts* that exercise edge conditions in the *processing* logic.

## The Field Mapping Format

For every field you found a defensive pattern for, create a mapping entry:

```
Field: <field_name>
Schema: <schema_class_or_file> line ~N
Type: <type_annotation>
Accepts: <range or enum of valid values>
Rejects: <what the validator blocks>
Default: <default value if any>
Defensive pattern: <what code does with this field>
Boundary values: <values to test — must be in "Accepts" range>
```

### Example Mapping

```
Field: retry_count
Schema: ConfigModel (config.py line 24)
Type: int, ge=0, le=10
Accepts: 0–10 inclusive
Rejects: negative, > 10, non-integer
Default: 3
Defensive pattern: if retry_count == 0, skip retry loop entirely
Boundary values: 0 (skip path), 1 (single attempt), 10 (max)
```

## Schema Types by Language

### Python (Pydantic)

```python
class ItemConfig(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    count: int = Field(default=10, ge=1, le=1000)
    mode: Literal["fast", "slow", "balanced"]
    tags: List[str] = []
```

**Mapping:**
- `name`: str, 1–100 chars. Boundary: 1 char, 100 chars, empty string (rejected).
- `count`: int, 1–1000. Boundary: 1, 1000, 0 (rejected).
- `mode`: enum. Boundary: each valid value. "unknown" is rejected.
- `tags`: list of str. Boundary: empty list, single item, many items.

### TypeScript (Zod / interfaces)

```typescript
const ConfigSchema = z.object({
  name: z.string().min(1).max(100),
  count: z.number().int().min(1).max(1000),
  mode: z.enum(["fast", "slow", "balanced"]),
  tags: z.array(z.string()).default([]),
});
```

**Mapping approach is identical** — read the schema, record accepts/rejects, derive boundary values from the accepts range.

### Java (Bean Validation)

```java
public class ItemConfig {
    @NotBlank @Size(max = 100)
    private String name;

    @Min(1) @Max(1000)
    private int count;

    @Pattern(regexp = "fast|slow|balanced")
    private String mode;
}
```

### Scala (case class + circe/play-json codecs)

```scala
case class ItemConfig(
  name: String,      // validated in apply()
  count: Int = 10,   // must be 1–1000
  mode: Mode,        // sealed trait enum
  tags: List[String] = Nil
)
```

For Scala, check companion objects and custom validators — validation logic often lives in `apply()` or codec definitions rather than annotations.

### Go (struct tags)

```go
type ItemConfig struct {
    Name  string   `json:"name" validate:"required,min=1,max=100"`
    Count int      `json:"count" validate:"min=1,max=1000"`
    Mode  string   `json:"mode" validate:"oneof=fast slow balanced"`
    Tags  []string `json:"tags"`
}
```

### Rust (serde + custom validation)

```rust
#[derive(Deserialize, Validate)]
struct ItemConfig {
    #[validate(length(min = 1, max = 100))]
    name: String,
    #[validate(range(min = 1, max = 1000))]
    count: u32,
    mode: Mode,  // enum
    #[serde(default)]
    tags: Vec<String>,
}
```

## Mutation Validity Rules

When writing boundary tests, every fixture mutation must use a **schema-valid value**:

### DO: Schema-Valid Mutations
```python
# Testing boundary of count field (schema accepts 1–1000)
config = base_config.copy()
config["count"] = 1       # minimum valid value
config["count"] = 1000    # maximum valid value
```

### DON'T: Schema-Invalid Mutations
```python
# These test the VALIDATOR, not the BUSINESS LOGIC
config["count"] = -1      # rejected by schema before business logic runs
config["count"] = 99999   # rejected by schema before business logic runs
config["count"] = "abc"   # type error, never reaches processing
```

### The Exception

It IS valid to test schema rejection explicitly — but label those tests as "validation tests," not "boundary tests." They verify the schema works, not the business logic:

```python
def test_schema_rejects_negative_count():
    """Validation test — schema enforcement, not business logic."""
    with pytest.raises(ValidationError):
        Config(count=-1)
```

## Building the Map

1. For every field where you found a defensive pattern (Step 5), look up its schema definition
2. Record the accepts/rejects range
3. Derive boundary values from the accepts range
4. Use ONLY boundary values from the accepts range in your functional tests
5. If a field has no schema validation, note that — the boundary is whatever the code handles

## Common Pitfalls

- **Testing rejected values as if they're boundary tests** — If the schema rejects it, it never reaches business logic. That's a validator test, not a functional test.
- **Guessing field names** — Copy field names character-by-character from the schema file. `document_id` ≠ `doc_id`.
- **Assuming types** — Read the actual type annotation. A field that looks like a number might be a string in the schema.
- **Missing defaults** — If a field has a default, test both with and without providing it.
