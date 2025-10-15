# Structured English

Structured English is a method for describing algorithms and processes using English language combined with programming-like syntax. It bridges the gap between natural language and formal programming languages, making complex logic understandable to both technical and non-technical audiences.

## What is Structured English?

Structured English uses:
- Plain English vocabulary from the problem domain
- Programming constructs (IF-THEN-ELSE, WHILE, etc.)
- Clear indentation to show hierarchy
- One logical element per line

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
Execute actions at least once, then repeat until condition is met.

```
REPEAT
    Display menu options
    Get user choice
    Process selection
UNTIL user selects "Exit"
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

## Converting Instructions to Structured English

### Step 1: Identify the Main Process
Break down your instructions into a clear beginning, middle, and end.

### Step 2: Recognize Patterns
- **Decisions**: Look for "if", "when", "in case of"
- **Repetition**: Look for "for each", "while", "until", "repeat"
- **Sequences**: Look for numbered steps or "then", "next", "after"

### Step 3: Use Standard Keywords
- Capitalize keywords: IF, THEN, ELSE, WHILE, DO, REPEAT, UNTIL, FOR, CASE
- End blocks explicitly: ENDIF, ENDWHILE, ENDFOR, ENDCASE
- Use EXIT to mark process completion

### Step 4: Apply Proper Indentation
Indent nested blocks to show hierarchy and scope.

## Example: Converting Instructions

**Original Instructions:**
"To process a refund, first check if the purchase was made within 30 days. If yes, verify the item condition. If the item is unopened, approve the full refund. If opened but defective, approve 80% refund. If opened and not defective, deny the refund. For purchases older than 30 days, always deny the refund."

**Structured English Version:**
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

1. **Use Problem Domain Language**: Write in terms familiar to the end user, not programming jargon
2. **Be Consistent**: Use the same terms throughout (don't switch between "customer" and "user")
3. **Keep It Simple**: One action or decision per line
4. **Be Complete**: Include all paths and edge cases
5. **Test Your Logic**: Walk through your structured English with sample data

## Common Pitfalls to Avoid

- Don't use programming-specific syntax (++, ==, !=)
- Don't assume technical knowledge
- Don't skip error handling or edge cases
- Don't make lines too complex - break them down

