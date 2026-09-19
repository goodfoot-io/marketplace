---
name: structured-english
description: Convert instructions, procedures, or algorithms into structured
  English. Use when the user says "structured English", "convert this to
  structured English", or wants a process written with programming constructs so
  that technical and non-technical readers can both follow it.
---

<instructions>

## 1. Establish the Input

Take [INPUT] from the user's message, or from the procedure, algorithm, or instruction set under discussion.

- **No input**: **STOP** — ask which text to convert. Structured English cannot be produced from nothing.
- **Input already in structured English**: Say so and stop rather than restating it.

## 2. Convert

Apply the method below to [INPUT], then return the structured English alone. Do not also return the original, and do not narrate the conversion.

<reference>
# Structured English

Structured English describes algorithms and processes in English combined with programming-like syntax. It bridges natural language and formal programming languages, making complex logic legible to technical and non-technical readers alike.

It uses plain vocabulary from the problem domain, programming constructs (IF-THEN-ELSE, WHILE, and the rest), clear indentation showing hierarchy, and one logical element per line.

## Core Constructs

### 1. SEQUENCE

Linear progression of steps executed one after another.

```
Read customer order
Calculate subtotal
Add shipping cost
Apply discount if applicable
Display total
```

### 2. IF-THEN-ELSE (Selection)

Decision points where different paths are taken based on conditions.

```
IF order total > $100 THEN
    Apply 10% discount
    Set shipping to free
ELSE
    Calculate standard shipping
ENDIF
```

### 3. WHILE (Repetition)

Repeat actions while a condition is true.

```
WHILE inventory count > 0
    Process next item
    Update inventory count
    Check for reorder point
ENDWHILE
```

### 4. REPEAT-UNTIL

Execute actions at least once, then repeat until the condition is met.

```
REPEAT
    Display menu options
    Get user choice
    Process selection
UNTIL user selects Exit
```

### 5. FOR (Counting Loop)

Repeat actions a specific number of times.

```
FOR each item in shopping cart
    Validate item availability
    Calculate item tax
    Add to order total
ENDFOR
```

### 6. CASE (Multiple Selection)

Handle multiple specific conditions.

```
CASE payment method OF
    Credit Card: Process card payment
    PayPal: Redirect to PayPal
    Bank Transfer: Generate invoice
    Cash: Mark as pending
ENDCASE
```

## Converting Instructions

- **Identify the main process**: Break the instructions into a clear beginning, middle, and end.
- **Recognize the patterns**: Decisions show up as "if", "when", or "in case of"; repetition as "for each", "while", "until", or "repeat"; sequences as numbered steps or "then", "next", "after".
- **Use the standard keywords**: Capitalize IF, THEN, ELSE, WHILE, DO, REPEAT, UNTIL, FOR, and CASE. End blocks explicitly with ENDIF, ENDWHILE, ENDFOR, and ENDCASE. Mark completion with EXIT.
- **Indent nested blocks** to show hierarchy and scope.

### Worked example

Original instructions: "To process a refund, first check if the purchase was made within 30 days. If yes, verify the item condition. If the item is unopened, approve the full refund. If opened but defective, approve 80% refund. If opened and not defective, deny the refund. For purchases older than 30 days, always deny the refund."

Structured English version:

```
PROCESS REFUND REQUEST
    Read purchase date
    Calculate days since purchase

    IF days since purchase <= 30 THEN
        Check item condition

        CASE item condition OF
            Unopened:
                Approve 100% refund
                Update inventory
            Opened and Defective:
                Approve 80% refund
                Log defect report
            Opened and Not Defective:
                Deny refund
                Provide reason to customer
        ENDCASE
    ELSE
        Deny refund
        Inform customer of 30-day policy
    ENDIF

    Send notification to customer
EXIT
```

## Best Practices

1. **Use problem domain language**: Write in terms familiar to the end user, not programming jargon.
2. **Stay consistent**: Use the same terms throughout — do not alternate between, say, customer and user.
3. **Keep it simple**: One action or decision per line.
4. **Be complete**: Include every path and edge case.
5. **Test the logic**: Walk the structured English through sample data.

## Common Pitfalls

- Programming-specific syntax such as ++, ==, or !=.
- Assuming technical knowledge the audience lacks.
- Skipping error handling or edge cases.
- Lines too complex to read at a glance.
</reference>

</instructions>
