## Runtime Type Validation Discovery

### Detailed Explanation
This technique involves exploring how a TypeScript codebase handles runtime type validation, which is crucial since TypeScript's type system is erased at runtime. By identifying and understanding runtime validation patterns using libraries like Zod, io-ts, or custom type guards, you can understand the boundary between compile-time safety and runtime safety, discovering how the codebase protects against invalid data from external sources.

### Why This Technique Is Valuable
- TypeScript types don't exist at runtime, but runtime validation is critical for API boundaries
- Reveals how the codebase handles untrusted data from APIs, databases, or user input
- Identifies potential security vulnerabilities where validation might be missing
- Shows the team's approach to bridging the compile-time/runtime gap

### When This Should Be Used
Use this technique when working with API endpoints, form validation, or external data sources. Key indicators: runtime errors that contradict TypeScript types, "validation failed" messages, authentication/authorization tasks, or presence of Zod/io-ts libraries. Essential for debugging data integrity issues or implementing features that process untrusted input.

### Instructions
1. **Identify validation libraries**
   - Search for packages like `zod`, `io-ts`, `yup`, `ajv`, or `class-validator` in package.json
   - Use ast-grep to find import statements: `import $_ from 'zod'`
   - Look for custom validation utilities in utils or validation directories
   - Document which validation approach the codebase uses

2. **Map validation boundaries**
   - Find all API endpoint handlers and check for validation
   - Locate form submission handlers and their validation logic
   - Search for database query results and their validation
   - Identify WebSocket message handlers and validation

3. **Analyze validation schemas**
   - For Zod: Look for `.parse()`, `.safeParse()`, and schema definitions
   - For io-ts: Find codec definitions and `decode()` calls
   - Map TypeScript types to their runtime validation counterparts
   - Check if validation schemas are kept in sync with types

4. **Trace validation flow**
   - Follow data from entry point through validation to usage
   - Identify where validated data becomes trusted
   - Look for any bypasses or gaps in validation coverage
   - Document validation error handling patterns

5. **Verify type-safety guarantees**
   - Check if validation results properly narrow types
   - Look for type assertions that bypass validation
   - Ensure validation failures are handled appropriately
   - Test edge cases where validation might fail

## Static Type System Navigation

### Detailed Explanation
This technique leverages TypeScript's type system as a navigational map through the codebase. By following type definitions, interfaces, and type aliases, you can understand data flow and component contracts without executing code. Using CLI tools and scripts, we can access the same rich metadata about code relationships that IDEs provide.

### Why This Technique Is Valuable
- Reduces cognitive load by 40-50% according to empirical studies on static analysis
- Type definitions serve as inline documentation that's always up-to-date
- Enables understanding of component contracts before reading implementation details
- Provides compile-time guarantees about code relationships

### When This Should Be Used
Primary technique for TypeScript type errors, "Property does not exist" messages, or integration tasks. Key indicators: type mismatches, missing exports, complex generics, or discriminated unions. Use when implementing features that must match existing interfaces or when refactoring while maintaining type safety. Most effective for understanding data shapes and component contracts.

### Instructions
1. **Extract and explore type definitions**
   - Use `print-typescript-types` to extract all types from entry points:
     ```bash
     print-typescript-types "src/index.ts" > types-overview.md
     print-typescript-types --type User --type Config "src/**/*.ts"
     ```
   - Use ast-grep to find type definitions:
     ```bash
     ast-grep -p 'type $NAME = $$$' -l ts
     ast-grep -p 'interface $NAME { $$$}' -l ts
     ```
   - Document core types in a structured format
   
2. **Map the type hierarchy**
   - Find all references to a type using ast-grep patterns:
     ```bash
     # Find where a type is used
     ast-grep -p '$_: UserType' -l ts
     ast-grep -p 'extends UserInterface' -l ts
     ast-grep -p 'implements $$$UserInterface$$$' -l ts
     ```
   - Use TSQuery for more complex type queries:
     ```bash
     tsquery 'TypeReference[typeName.name="User"]' src/**/*.ts
     ```
   - Create a type relationship graph using a script:
     ```bash
     for file in src/**/*.ts; do
       echo "=== $file ==="
       print-typescript-types "$file" | grep -E "interface|type|class"
     done > type-hierarchy.md
     ```
   
3. **Follow the data flow**
   - Trace type transformations with combined tools:
     ```bash
     # Find function signatures that transform types
     ast-grep -p 'function $_($$$): $RETURN_TYPE' -l ts
     
     # Extract transformation functions
     print-typescript-types --type "transform*" "src/utils/*.ts"
     ```
   - Map data flow through modules:
     ```bash
     # See what a module exports and imports
     ast-grep -p 'export type $NAME' "$file" -l ts
     ast-grep -p 'import type { $$$ } from $_' "$file" -l ts
     ```
   
4. **Identify type patterns**
   - Find generic types and their constraints:
     ```bash
     ast-grep -p 'type $NAME<$GENERIC> = $$$' -l ts
     ast-grep -p 'interface $NAME<$T extends $CONSTRAINT>' -l ts
     ```
   - Locate discriminated unions:
     ```bash
     ast-grep -p 'type $NAME = { kind: "$KIND1" } | { kind: "$KIND2" }' -l ts
     ```
   - Find utility type usage:
     ```bash
     grep -r "Partial<\|Required<\|Pick<\|Omit<" --include="*.ts"
     ```

## AST-Based Pattern Search

### Detailed Explanation
Abstract Syntax Tree (AST) based searching uses tools like `ast-grep` to find code patterns based on structure rather than text. This technique allows you to quickly locate specific patterns, anti-patterns, or architectural violations across large codebases by matching against the code's syntactic structure.

### Why This Technique Is Valuable
- 100x faster than text-based search for complex patterns
- Finds semantic patterns that regex cannot express
- Helps identify technical debt and refactoring opportunities
- Enables enforcement of architectural rules

### When This Should Be Used
Essential for "find all instances of X" requests, refactoring tasks, or pattern migration. Key phrases: "everywhere", "all places", "check usage". Superior to grep for semantic patterns like all try-catch blocks, Promise returns, or React components. Use for enforcing standards, finding deprecated patterns, or locating security issues like hardcoded secrets.

### Instructions

1. **Learn pattern syntax**
   - Start with literal matches: `console.log($ARG)`
   - Progress to complex patterns: `try { $$$BODY } catch { }`
   - Practice with TypeScript-specific patterns: `interface $NAME { $$$FIELDS }`
   
2. **Search for common patterns**
   - Find all React components: `const $COMP = () => { $$$BODY }`
   - Locate all API calls: `fetch($URL, $OPTIONS)`
   - Identify Promise usage: `new Promise($RESOLVER)`
   
3. **Create custom rules**
   - Discover conventions through pattern analysis by examining multiple similar files
   - Extract common patterns and document recurring structures
   - Set up rules to detect anti-patterns based on observed code
   - Configure severity levels for different violations
   - Validate patterns against existing codebase
   
4. **Create reusable search scripts**
   - Create scripts for common pattern searches
   - Save frequently used patterns for future analysis
   - Document discovered patterns for reference

## Dependency Graph Analysis

### Detailed Explanation
This technique involves mapping the dependency relationships between modules, packages, and components in your TypeScript project. Using built-in utilities like `print-dependencies` and `print-inverse-dependencies`, you can analyze import statements to understand architecture, identify potential issues, and track how changes propagate through your codebase.

### Why This Technique Is Valuable
- Reveals hidden architectural patterns and coupling
- Identifies circular dependencies that cause runtime issues
- Shows which modules are most depended upon (and thus most critical)
- Helps plan refactoring by understanding impact radius

### When This Should Be Used
Critical for circular dependency errors, "Cannot find module" issues, or impact analysis. Key indicators: import errors, build failures, or questions about "what will break if I change X". Use before refactoring, extracting utilities, or making architectural changes. Essential for understanding module relationships and identifying affected files.

### Instructions
1. **Use print-dependencies to map forward dependencies**
   - Find what a file imports: `print-dependencies "src/index.ts"`
   - Analyze multiple files: `print-dependencies "src/**/*.ts"`
   - Trace entire dependency trees excluding node_modules
   - Output is a space-separated list of all dependencies
   
2. **Use print-inverse-dependencies to find consumers**
   - Find what imports a file: `print-inverse-dependencies "src/utils/logger.ts"`
   - Analyze impact of changes: `print-inverse-dependencies "src/core/*.ts"`
   - Use with tsconfig: `print-inverse-dependencies "src/api.ts" --project tsconfig.json`
   - Identify which files would be affected by modifications
   
3. **Analyze circular dependencies**
   - Combine both tools to detect cycles:
     ```bash
     # Check if fileA depends on fileB and vice versa
     print-dependencies "src/fileA.ts" | grep fileB
     print-dependencies "src/fileB.ts" | grep fileA
     ```
   - Create a script to detect circular imports across the codebase
   - Document any circular dependencies found and their impact
   
4. **Map architectural layers**
   - Use print-dependencies to verify layer boundaries:
     ```bash
     # Ensure presentation layer doesn't import from data layer directly
     print-dependencies "src/presentation/**/*.ts" | grep "src/data"
     ```
   - Validate that dependencies only flow in allowed directions
   - Create dependency reports for each architectural layer
   
5. **Analyze dependency health**
   - Generate dependency reports for analysis:
     ```bash
     # Generate a list of all dependencies for analysis
     print-dependencies "src/**/*.ts" > dependencies.txt
     
     # Count dependencies per file
     for file in src/**/*.ts; do
       echo "$file: $(print-dependencies "$file" | wc -w) dependencies"
     done | sort -t: -k2 -rn
     ```
   - Identify modules with excessive dependencies
   - Document architectural patterns discovered

## Progressive Code Comprehension

### Detailed Explanation
Based on cognitive science research, this technique involves understanding code in layers, starting with high-level structure and progressively diving into details. This approach aligns with how human working memory processes information, limiting cognitive load to 4-7 chunks at a time.

### Why This Technique Is Valuable
- Matches natural human learning patterns proven by cognitive science
- Reduces overwhelm when facing large codebases
- Creates stronger mental models through repeated exposure
- Allows for early productivity while learning continues

### When This Should Be Used
Default starting technique for unfamiliar codebases or when feeling overwhelmed. Key situations: new projects, large codebases (>10k lines), sparse documentation, or getting lost in details. Use when the user asks "how does X work" or when implementing features touching multiple areas. Start here before applying more specific techniques.

### Instructions
1. **Map the surface structure**
   - Read only file and folder names without opening files
   - Identify naming conventions and organizational patterns
   - Create a mental map of major areas (features, utilities, tests)
   - Document your initial understanding
   
2. **Understand entry points**
   - Locate main entry files (`index.ts`, `main.ts`, `app.ts`)
   - Follow initialization code at a high level
   - Identify major configuration files
   - Note external dependencies and their purposes
   
3. **Trace one complete feature**
   - Choose a simple, well-contained feature
   - Follow it from UI to database/API and back
   - Document each layer the feature touches
   - Note patterns that seem to repeat
   
4. **Expand to adjacent features**
   - Select features that share code with your first feature
   - Compare implementation patterns
   - Identify shared utilities and abstractions
   - Update your mental model with new patterns
   
5. **Deep dive into complex areas**
   - Tackle the most complex or critical components
   - Read tests to understand edge cases
   - Review git history for context
   - Use git blame and commit history to understand past decisions
   - Extract patterns from existing tests and documentation
   - Create comprehensive notes documenting your understanding


## Compiler API Investigation

### Detailed Explanation
This advanced technique involves using TypeScript's compiler capabilities through CLI tools and scripts to programmatically analyze code structure, extract metadata, and understand complex type relationships. While we can't use ts-morph interactively, we can achieve similar analysis through available CLI tools and custom scripts.

### Why This Technique Is Valuable
- Provides deepest possible understanding of TypeScript code
- Enables custom analysis not available in standard tools
- Can process entire codebase programmatically
- Reveals implicit type relationships and inferences

### When This Should Be Used
Advanced technique for cryptic TypeScript errors or complex type inference issues. Key indicators: build errors that don't make sense, conditional types, mapped types, declaration file problems. Use when standard tools fail or when building custom analysis. Reserve for situations where simpler techniques provide insufficient insight.

### Instructions
1. **Use print-typescript-types for type extraction**
   ```bash
   # Extract all types from a module
   print-typescript-types "src/models/*.ts" > type-analysis.md
   
   # Focus on specific types
   print-typescript-types --type UserModel --type OrderModel "src/**/*.ts"
   
   # Analyze npm package types
   print-typescript-types --pwd packages/api "@types/express"
   ```
   
2. **Use print-type-analysis for comprehensive type extraction**
   ```bash
   # Analyze all types in TypeScript files
   # Output is always in YAML format
   # Always includes functions with cyclomatic complexity
   print-type-analysis "src/**/*.ts"
   
   # Analyze specific files or patterns
   print-type-analysis "src/models/*.ts" "src/types/*.ts"
   print-type-analysis "/path/to/specific/file.ts"
   
   # Output includes:
   # - Interfaces with properties and inheritance
   # - Type aliases with definitions
   # - Classes with members, inheritance, and implementations
   # - Enums with members
   # - Functions/methods with parameters, return types, and complexity
   # - Export status for all items
   
   # Example: Extract and process with yq
   print-type-analysis "src/**/*.ts" | yq '.summary'
   print-type-analysis "src/**/*.ts" | yq '.files[].items[] | select(.kind == "interface")'
   ```
   
3. **Extract type information with ast-grep and jq**
   ```bash
   # Find all interfaces and their properties
   ast-grep -p 'interface $NAME { $$$BODY }' -l ts --json | \
     jq -r '.matches[] | "Interface: \(.metavariables.NAME.text)"'
   
   # Extract function signatures
   ast-grep -p 'function $NAME($$$PARAMS): $RETURN { $$$}' -l ts --json | \
     jq -r '.matches[] | "\(.metavariables.NAME.text): \(.metavariables.RETURN.text)"'
   
   # Find type aliases
   ast-grep -p 'type $NAME = $TYPE' -l ts --json | \
     jq -r '.matches[] | "Type \(.metavariables.NAME.text) = \(.metavariables.TYPE.text)"'
   ```
   
4. **Analyze relationships programmatically**
   ```bash
   # Create relationship mapper script
   cat > map-relationships.sh << 'EOF'
   #!/bin/bash
   
   echo "# Type Relationships Report"
   echo ""
   
   # Find inheritance relationships
   echo "## Inheritance"
   ast-grep -p 'interface $CHILD extends $PARENT' -l ts | while read match; do
     echo "- $match"
   done
   
   # Find implementations
   echo "## Implementations"
   ast-grep -p 'class $CLASS implements $INTERFACE' -l ts | while read match; do
     echo "- $match"
   done
   
   # Find type unions and intersections
   echo "## Complex Types"
   grep -r "type.*=.*[|&]" --include="*.ts" | head -20
   EOF
   
   chmod +x map-relationships.sh
   ./map-relationships.sh > relationships-report.md
   ```
   
5. **Generate comprehensive type reports**
   ```bash
   # Combine multiple tools for full analysis
   cat > generate-type-report.sh << 'EOF'
   #!/bin/bash
   
   echo "# TypeScript Type Analysis Report"
   echo "Generated: $(date)"
   echo ""
   
   echo "## All Exported Types"
   print-typescript-types "src/**/*.ts" | grep -E "^(export|interface|type|class)" | sort -u
   
   echo ""
   echo "## Type Complexity Metrics"
   for file in src/**/*.ts; do
     echo "### $file"
     # Count interfaces, types, and classes
     interfaces=$(grep -c "interface " "$file" || echo 0)
     types=$(grep -c "type " "$file" || echo 0)
     classes=$(grep -c "class " "$file" || echo 0)
     echo "- Interfaces: $interfaces"
     echo "- Type aliases: $types"
     echo "- Classes: $classes"
   done
   
   echo ""
   echo "## Generic Type Usage"
   ast-grep -p '$_<$$$>' -l ts | head -20
   EOF
   
   chmod +x generate-type-report.sh
   ./generate-type-report.sh > type-analysis-full.md
   ```

## Code Quality Metrics Analysis

### Detailed Explanation
This technique uses cyclomatic complexity, maintainability indices, and comprehensive code analysis to identify areas of technical debt and complexity in TypeScript codebases. Command-line tools like `fta` (Fast TypeScript Analyzer), `cyclomatic-complexity`, and `eslintcc` provide quantitative measures of code quality that guide refactoring efforts.

### Why This Technique Is Valuable
- Provides objective measures of code complexity beyond subjective assessment
- Identifies high-risk areas that are prone to bugs
- Helps prioritize refactoring efforts based on data
- Tracks code quality trends over time

### When This Should Be Used
Use for refactoring prioritization, technical debt assessment, or code quality concerns. Key phrases: "code smell", "technical debt", "frequent bugs", "hard to test". Essential for establishing quality baselines and setting CI/CD gates. Apply when files have excessive functions or deep nesting.

### Instructions
1. **Use FTA (Fast TypeScript Analyzer) for comprehensive analysis**
   ```bash
   # Analyze a TypeScript project with FTA
   fta src/
   
   # Get JSON output for programmatic processing
   fta src/ --json > fta-report.json
   
   # Output as CSV for spreadsheet analysis
   fta src/ --format csv > fta-report.csv
   
   # Set a score cap threshold (fail if score exceeds limit)
   fta src/ --score-cap 100
   
   # Include comments in the analysis
   fta src/ --include-comments true
   
   # Limit output to top 100 files
   fta src/ --output-limit 100
   ```

2. **Use cyclomatic-complexity for detailed TypeScript analysis**
   ```bash
   # Analyze TypeScript files with cyclomatic-complexity
   cyclomatic-complexity "src/**/*.ts"
   
   # Set custom thresholds (warning at 10, error at 20)
   cyclomatic-complexity "src/**/*.ts" -tw 10 -te 20
   
   # Get JSON output for programmatic processing
   cyclomatic-complexity "src/**/*.ts" --json > complexity.json
   
   # Exclude specific patterns
   cyclomatic-complexity "src/**/*.ts" -e "**/test/**"
   ```
   
3. **Use eslintcc for comprehensive JavaScript metrics**
   ```bash
   # Analyze JavaScript/TypeScript with eslintcc (ranks A-F)
   eslintcc --show-rules "src/**/*.js"
   
   # Get JSON output for analysis
   eslintcc -f=json "src/**/*.js" > eslintcc-report.json
   
   # Show only high complexity functions (rank E or F)
   eslintcc -gt=d "src/**/*.js"
   
   # Check multiple metrics (complexity, depth, params)
   eslintcc --rules all --show-rules "src/**/*.js"
   
   # Show average complexity
   eslintcc --average "src/**/*.js"
   ```
   
4. **Analyze FTA scores and patterns**
   ```bash
   # Parse FTA JSON output for detailed analysis
   fta src/ --json | jq '{
     total_score: .score,
     file_count: .file_scores | length,
     top_complex_files: .file_scores | sort_by(.score) | reverse | .[0:10] | 
       map({file: .file_name, score: .score, assessment: .assessment})
   }'
   
   # Find files with specific assessment levels
   fta src/ --json | jq '.file_scores[] | 
     select(.assessment == "F") | 
     {file: .file_name, score: .score}'
   
   # Generate FTA report with custom threshold
   fta src/ --score-cap 500 --json > fta-quality-gate.json
   ```

5. **Analyze complexity patterns with other tools**
   ```bash
   # Parse cyclomatic-complexity JSON output
   cyclomatic-complexity "src/**/*.ts" --json | jq '.[] | {
     file: .file,
     totalComplexity: .complexitySum,
     functions: .functionComplexities | map({name: .name, complexity: .complexity, line: .line})
   }'
   
   # Find high-risk functions (complexity > 10)
   cyclomatic-complexity "src/**/*.ts" --json | \
     jq '.[] | .functionComplexities[] | select(.complexity > 10) | 
     "\(.complexity) - \(.name) at line \(.line)"'
   
   # Generate complexity summary
   cyclomatic-complexity "src/**/*.ts" --json | \
     jq '[.[] | .complexitySum] | {total: add, average: (add / length), max: max}'
   ```


## Git Archaeology and History Analysis

### Detailed Explanation
Git archaeology involves using version control history to understand how code evolved over time, why certain decisions were made, and who has expertise in different areas. This technique uses commands like `git blame`, `git log`, `git bisect`, and specialized tools to trace code lineage, find when bugs were introduced, and understand the context behind changes.

### Why This Technique Is Valuable
- Reveals the "why" behind code decisions through commit messages and pull request discussions
- Identifies subject matter experts who can answer questions about specific code areas
- Helps locate when bugs were introduced, making debugging more efficient
- Provides historical context that documentation often lacks

### When This Should Be Used
Essential for "this used to work" scenarios, understanding counterintuitive code, or debugging recent regressions. Key indicators: missing documentation, unexplained complexity, legacy code. Use to find code experts, trace feature evolution, or understand hidden constraints. Often reveals non-obvious reasons behind seemingly bad code.

### Instructions
1. **Start with git blame exploration**
   - Run `git blame <filename>` to see who last modified each line
   - Use `git blame -w` to ignore whitespace changes
   - Apply `git blame -M` to track moved or copied lines within files
   - Use `git blame -C` to detect lines moved from other files
   
2. **Trace code evolution with git log**
   - Use `git log -S "search term"` (pickaxe) to find when code was added/removed
   - Run `git log -L :<function>:<file>` to see history of a specific function
   - Apply `git log --follow <file>` to track file renames
   - Use `git log --graph` to visualize branch merges
   
3. **Find bug introduction points**
   - Use `git bisect start` to begin binary search
   - Mark known good commit: `git bisect good <commit>`
   - Mark known bad commit: `git bisect bad <commit>`
   - Test each suggested commit and mark as good/bad
   - Automate with `git bisect run <test-script>`
   - **Note**: Avoid interactive git commands (with -i flag). Use explicit file paths and sequential commands instead
   
4. **Analyze code ownership patterns**
   - Generate contribution statistics: `git shortlog -sn`
   - Find who knows specific areas: `git log --format='%ae' <path> | sort | uniq -c`
   - Identify high-churn files: `git log --format=format: --name-only | sort | uniq -c`
   - Create heat maps of recent changes


## Call Graph and Control Flow Analysis

### Detailed Explanation
Call graph generation creates representations of how modules, functions, and methods interact throughout a codebase. Control flow analysis maps the possible execution paths through the program. For TypeScript projects, we can leverage built-in utilities for module-level analysis and supplement with specialized tools only when needed for deeper function-level inspection.

### Why This Technique Is Valuable
- Provides bird's-eye view of system architecture and component interactions
- Identifies circular dependencies and architectural violations
- Reveals performance bottlenecks through call frequency analysis
- Helps understand impact radius of changes

### When This Should Be Used
Critical for "how does X get to Y" questions, performance optimization, or architectural planning. Key scenarios: data transformation issues, async debugging, event propagation, finding side effects. Use when splitting monoliths, changing function signatures, or tracing user input flow. Excels at revealing hidden connections between components.

### Instructions
1. **Start with module-level dependency analysis**
   - Use `print-dependencies` to map module interactions:
     ```bash
     # See all modules that a component depends on
     print-dependencies "src/components/UserList.tsx"
     ```
   - Use `print-inverse-dependencies` to find call chains:
     ```bash
     # Find all modules that could call into a service
     print-inverse-dependencies "src/services/api.ts"
     ```
   - Combine both to trace complete interaction paths between modules
   
2. **Extract type information for interface analysis**
   - Use `print-typescript-types` to understand function signatures:
     ```bash
     # Extract all exported functions and their signatures
     print-typescript-types "src/utils/*.ts"
     # Filter to specific types or functions
     print-typescript-types --type UserService "src/services/user.ts"
     ```
   - Analyze function parameters and return types to understand data flow
   - Map public APIs and their contracts
   
3. **Identify architectural patterns and violations**
   - Trace module dependencies to detect layering violations:
     ```bash
     # Check if any UI components directly call database modules
     print-dependencies "src/ui/**/*.tsx" | grep "src/database"
     ```
   - Find circular dependencies at module level:
     ```bash
     # Script to detect circular imports
     for file in src/**/*.ts; do
       deps=$(print-dependencies "$file")
       for dep in $deps; do
         print-dependencies "$dep" | grep -q "$file" && echo "Circular: $file <-> $dep"
       done
     done
     ```
   
4. **Analyze complexity through dependency depth**
   - Chain print-dependencies to measure dependency depth:
     ```bash
     # Find deep dependency chains
     print-dependencies "src/index.ts" | xargs -n1 print-dependencies | sort -u
     ```
   - Identify modules with excessive dependencies (potential "god objects")
   - Find modules that are overly depended upon (high coupling)
   

## Rubber Duck Debugging for Code Comprehension

### Detailed Explanation
Rubber duck debugging involves explaining code line-by-line to an inanimate object (traditionally a rubber duck) or writing out explanations as if teaching someone unfamiliar with the code. This technique leverages metacognition and the "protégé effect" to deepen understanding and identify gaps in comprehension.

### Why This Technique Is Valuable
- Forces detailed examination of every line and assumption
- Engages different cognitive processes than silent reading
- Reveals hidden assumptions and logic errors
- Improves retention through active learning

### When This Should Be Used
Use when stuck on inexplicable bugs, behavior mismatches, or complex logic. Key situations: unit tests pass but integration fails, race conditions, off-by-one errors, recursive functions, state machines. Effective when you've stared at code too long or need to verify understanding. Reveals hidden assumptions and gaps in mental models.

### Instructions
1. **Set up your debugging session**
   - Find a quiet space free from distractions
   - Place a rubber duck or similar object on your desk
   - Open the code you want to understand
   - Have a notepad ready for insights
   
2. **Explain the code's purpose**
   - Start by explaining what the code should do at a high level
   - Describe the inputs and expected outputs
   - Explain why this code exists in the system
   - Articulate any assumptions or prerequisites
   
3. **Walk through line by line**
   - Read each line aloud and explain what it does
   - Describe why each operation is necessary
   - Explain the state changes that occur
   - Question every assumption and magic number
   
4. **Identify knowledge gaps**
   - Note when you can't explain something clearly
   - Mark areas where you're making assumptions
   - List questions that arise during explanation
   - Document unexpected behaviors or patterns
   
5. **Iterate and refine understanding**
   - Research answers to questions that arose
   - Re-explain complex sections after learning more
   - Try explaining to different "audiences" (beginner vs expert)
   - Document your understanding for future reference

## Strategic Code Review for Learning

### Detailed Explanation
This technique uses self-directed code review as a learning tool by analyzing code changes, patterns, and design decisions in an unfamiliar codebase. By reviewing code systematically using automated tools and documenting your understanding, you can learn conventions, best practices, and architectural patterns without team collaboration.

### Why This Technique Is Valuable
- Helps understand code evolution and design decisions
- Exposes you to different coding patterns and practices
- Builds understanding through systematic analysis
- Creates documentation of your learning process
- Enables objective review through time-delayed analysis

### When This Should Be Used
Ideal for onboarding, learning conventions, or understanding coding patterns. Key scenarios: self-review after completing features, establishing personal guidelines, learning unwritten rules through pattern analysis. Use when joining mid-project or understanding domain-specific practices. Reveals thinking patterns, testing strategies, and architectural preferences through code archaeology.

### Instructions
1. **Review unfamiliar code actively**
   - Focus on understanding logic flow first
   - Document design questions and search for answers through git commit messages, code comments, ADRs, and PR descriptions
   - Compare patterns to familiar languages/frameworks
   - Create a 'Design Decisions Log' documenting your findings and understanding
   
2. **Analyze code changes systematically**
   - Review recent commits and their changes
   - Study how features were implemented
   - Examine bug fixes to understand common issues
   - Look for patterns in how problems are solved
   
3. **Implement systematic self-review**
   - Conduct time-delayed review (review your code after 24 hours for fresh perspective)
   - Use diff-based analysis tools to review changes objectively
   - Run static analyzers and linters to identify issues
   - Create and follow documented review checklists based on common patterns in the codebase
   - Document findings and improvements for future reference
   
4. **Automate testing and validation**
   - Generate comprehensive test suites based on existing patterns
   - Use coverage tools to identify gaps in testing
   - Document test scenarios in markdown for future reference
   - Create automated validation scripts for common patterns
   - Build regression test suites from bug fix history
   
5. **Document review learnings**
   - Create a knowledge base from your analysis
   - Extract recurring patterns into guidelines
   - Build glossary of domain terms
   - Map different code areas to their purposes

## Contextual Understanding Through Documentation

### Detailed Explanation
This technique focuses on understanding the "why" behind code by exploring all available documentation and context within the repository. It emphasizes understanding the business domain, design decisions, and historical context before diving into implementation details.

### Why This Technique Is Valuable
- Provides crucial context that code alone cannot convey
- Reveals requirements and constraints that shaped the implementation
- Helps avoid repeating past mistakes
- Accelerates understanding by starting with high-level concepts

### When This Should Be Used
Essential when code purpose isn't clear, dealing with domain-specific terms, or understanding business constraints. Key situations: regulated industries, complex business rules, legacy modernization, determining bug vs. feature. Use when code seems unnecessarily complex or when planning features requiring business logic integration. Documentation often explains hidden constraints.

### Instructions
1. **Gather all available documentation**
   - Read README files and wikis
   - Review architecture decision records (ADRs)
   - Study API documentation and contracts
   - Examine test scenarios and specifications
   
2. **Understand the business domain**
   - Learn domain-specific terminology from code and docs
   - Understand user workflows and use cases
   - Map business rules to code structures
   - Identify core domain concepts vs supporting code
   
3. **Trace requirements to implementation**
   - Analyze git commit messages for context
   - Read pull request descriptions in git history
   - Review design documents and proposals in the repo
   - Understand acceptance criteria from tests
   
4. **Analyze historical context**
   - Study git history for decision evolution
   - Review old issues and PRs in git log
   - Identify patterns in how problems were solved
   - Learn from past refactoring efforts
   
5. **Create missing documentation**
   - Document your understanding as you learn
   - Create diagrams of system interactions
   - Write up undocumented conventions
   - Build onboarding guides for future developers

## Knowledge Graph Construction

### Detailed Explanation
This technique involves building a comprehensive map of the codebase's concepts, relationships, and metadata in a human-readable Markdown format. The `create-knowledge-graph` utility automates this process using ts-morph to analyze TypeScript code structure, dependencies, and relationships, creating an immediately understandable view of the entire system.

### Why This Technique Is Valuable
- Creates immediately readable documentation of codebase structure
- Reveals hidden connections and dependencies at a glance
- Provides accurate cyclomatic complexity metrics
- Identifies type hierarchies, interfaces, and implementations
- Version control friendly and requires no infrastructure
- Extremely fast analysis (100x faster than manual approaches)

### When This Should Be Used
Best for documenting complex systems, onboarding team members, or planning architectural changes. Key scenarios: microservices, event-driven architectures, system documentation. Use when asked "how does everything connect" or when identifying architectural patterns. Creates persistent artifacts for reference and makes implicit relationships explicit.

### Instructions
1. **Use the create-knowledge-graph utility**
   ```bash
   # Generate knowledge graph for auto-detected source directory
   create-knowledge-graph
   
   # Generate for a specific directory
   create-knowledge-graph packages/api
   
   # Use the -s flag for explicit source path
   create-knowledge-graph -s src/components
   
   # Save output to a file
   create-knowledge-graph packages/myapp > KNOWLEDGE-GRAPH.md
   
   # Get help
   create-knowledge-graph -h
   ```

2. **Understanding the output sections**
   The utility generates a comprehensive Markdown document with:
   - **Modules and Their Dependencies**: Lists all TypeScript files with their imports and inverse dependencies
   - **Type Hierarchy**: Shows all classes, interfaces, type aliases, and enums with their relationships
   - **Relationship Summary**: Table showing dependency counts and complexity metrics for each module
   - **Module Tree**: ASCII visualization of the directory structure
   - **Key Insights**: Automatically identifies:
     - Most depended upon modules (critical components)
     - Modules with most dependencies (potential refactoring targets)
     - Isolated modules (unused or standalone utilities)
     - Statistical summary of the codebase

3. **Analyze the generated graph**
   ```bash
   # Generate and analyze specific patterns
   create-knowledge-graph src | grep "extends:" | sort -u
   
   # Find circular dependencies by examining the output
   create-knowledge-graph src | grep -A5 -B5 "moduleA"
   
   # Extract just the statistics
   create-knowledge-graph src | grep -A10 "### Statistics"
   ```

4. **Use for architectural analysis**
   ```bash
   # Check layer violations
   create-knowledge-graph src/ui | grep "src/database"
   
   # Identify god objects (high complexity scores)
   create-knowledge-graph src | grep "| [0-9][0-9][0-9] |"
   
   # Find unused modules
   create-knowledge-graph src | grep -B1 "Imported by: \*None\*"
   ```

5. **Integrate into documentation workflow**
   ```bash
   # Add to your build process
   create-knowledge-graph src > docs/KNOWLEDGE-GRAPH.md
   git add docs/KNOWLEDGE-GRAPH.md
   git commit -m "Update knowledge graph"
   
   # Use in CI/CD for tracking complexity
   create-knowledge-graph src | grep "Total modules analyzed"
   ```

The `create-knowledge-graph` utility uses ts-morph for accurate TypeScript analysis, providing:
- Real dependency resolution (handles relative imports, index files, extensions)
- Accurate type hierarchy extraction
- Cyclomatic complexity calculation
- Automatic exclusion of node_modules
- Sub-second performance even on large codebases

The resulting knowledge graph serves as living documentation that can be regenerated as the codebase evolves, providing immediate insights into code structure and relationships.

## Incremental Layer Exploration

### Detailed Explanation
Based on cognitive load theory, this technique involves understanding a codebase in progressive layers, starting with the highest-level structure and gradually diving into details. Each layer builds on the previous one, preventing cognitive overload while building a comprehensive mental model.

### Why This Technique Is Valuable
- Aligns with how human memory processes information
- Prevents overwhelming detail at the start
- Creates strong foundational understanding
- Allows for early productivity while learning continues

### When This Should Be Used
Default for exploring new areas with limited time or unclear scope. Key situations: vague tasks like "understand authentication", unfamiliar bug investigation, tight deadlines. Use when balancing immediate productivity with learning needs. Provides clear learning paths for mentoring and systematic documentation layers. Pairs well with Progressive Code Comprehension.

### Instructions
1. **Map the surface structure**
   - Explore directory structure without opening files
   - Identify naming conventions and patterns
   - Note major components and boundaries
   - Create high-level architecture diagram
   
2. **Understand entry points**
   - Locate main() or equivalent starting points
   - Follow initialization sequences
   - Identify configuration loading
   - Map external interfaces (APIs, CLI, GUI)
   
3. **Trace one complete feature**
   - Choose a simple, well-defined feature
   - Follow it from input to output
   - Document each layer it touches
   - Note patterns and conventions used
   
4. **Expand to related features**
   - Select features sharing code with the first
   - Compare implementation approaches
   - Identify shared abstractions
   - Update mental model with patterns
   
5. **Deep dive into complexity**
   - Tackle most complex components
   - Read tests for edge cases
   - Review historical changes
   - Analyze git history to identify primary contributors using `git shortlog -sn <path>`
   - Review commit messages and PR descriptions for expertise insights
   - Cross-reference with existing documentation and test cases