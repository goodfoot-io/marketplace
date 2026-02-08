import * as fs from "node:fs";
import * as ts from "typescript";
import type {
  DuplicateBlock,
  DuplicationMetrics,
  DuplicationOptions,
  NormalizedToken,
  StructuralUnit,
  StructuralUnitType,
  TokenWindow,
} from "../types.js";

// Rabin-Karp rolling hash constants
const HASH_BASE = 31;
const HASH_MOD = 1e9 + 7;

// Token kinds that should be normalized (identifiers, literals)
const NORMALIZABLE_KINDS = new Set([
  ts.SyntaxKind.Identifier,
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NumericLiteral,
  ts.SyntaxKind.BigIntLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
]);

// TypeScript keywords that should NOT be normalized even if they parse as identifiers
const KEYWORDS = new Set([
  "abstract",
  "any",
  "as",
  "asserts",
  "async",
  "await",
  "bigint",
  "boolean",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "constructor",
  "continue",
  "debugger",
  "declare",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "get",
  "if",
  "implements",
  "import",
  "in",
  "infer",
  "instanceof",
  "interface",
  "is",
  "keyof",
  "let",
  "module",
  "namespace",
  "never",
  "new",
  "null",
  "number",
  "object",
  "of",
  "override",
  "package",
  "private",
  "protected",
  "public",
  "readonly",
  "require",
  "return",
  "satisfies",
  "set",
  "static",
  "string",
  "super",
  "switch",
  "symbol",
  "this",
  "throw",
  "true",
  "try",
  "type",
  "typeof",
  "undefined",
  "unique",
  "unknown",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

// Tokens to skip (whitespace, comments, newlines)
const SKIP_KINDS = new Set([
  ts.SyntaxKind.WhitespaceTrivia,
  ts.SyntaxKind.NewLineTrivia,
  ts.SyntaxKind.SingleLineCommentTrivia,
  ts.SyntaxKind.MultiLineCommentTrivia,
  ts.SyntaxKind.EndOfFileToken,
]);

export class DuplicationDetector {
  private options: DuplicationOptions;
  private files: string[] = [];

  constructor(options: DuplicationOptions) {
    this.options = options;
  }

  setFiles(files: string[]): void {
    this.files = files;
  }

  tokenizeFile(filePath: string): NormalizedToken[] {
    const sourceText = fs.readFileSync(filePath, "utf-8");
    const tokens: NormalizedToken[] = [];

    const scanner = ts.createScanner(
      ts.ScriptTarget.Latest,
      /* skipTrivia */ false,
      ts.LanguageVariant.Standard,
      sourceText,
    );

    // Build line start offsets for line/column calculation
    const lineStarts: number[] = [0];
    for (let i = 0; i < sourceText.length; i++) {
      if (sourceText[i] === "\n") {
        lineStarts.push(i + 1);
      }
    }

    const getLineAndColumn = (pos: number): { line: number; column: number } => {
      // Binary search for the line
      let low = 0;
      let high = lineStarts.length - 1;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (lineStarts[mid] <= pos) {
          low = mid;
        } else {
          high = mid - 1;
        }
      }
      return {
        line: low + 1, // 1-based line number
        column: pos - lineStarts[low],
      };
    };

    while (true) {
      const kind = scanner.scan();
      if (kind === ts.SyntaxKind.EndOfFileToken) {
        break;
      }

      // Skip whitespace and comments
      if (SKIP_KINDS.has(kind)) {
        continue;
      }

      const text = scanner.getTokenText();
      const pos = scanner.getTokenPos();
      const { line, column } = getLineAndColumn(pos);

      tokens.push({
        kind: ts.SyntaxKind[kind],
        normalizedValue: text,
        line,
        column,
      });
    }

    return tokens;
  }

  normalizeTokens(tokens: NormalizedToken[]): NormalizedToken[] {
    return tokens.map((token) => {
      const kind = ts.SyntaxKind[token.kind as keyof typeof ts.SyntaxKind];

      if (!NORMALIZABLE_KINDS.has(kind)) {
        return token;
      }

      // Don't normalize TypeScript keywords
      if (kind === ts.SyntaxKind.Identifier) {
        return KEYWORDS.has(token.normalizedValue) ? token : { ...token, normalizedValue: "$ID" };
      }

      // Normalize numeric literals
      if (kind === ts.SyntaxKind.NumericLiteral || kind === ts.SyntaxKind.BigIntLiteral) {
        return { ...token, normalizedValue: "$NUM" };
      }

      // All other normalizable kinds are string-like literals
      return { ...token, normalizedValue: "$STR" };
    });
  }

  private computeHash(tokens: NormalizedToken[]): string {
    let hash = 0;
    for (const token of tokens) {
      const charSum = [...token.normalizedValue].reduce((acc, c) => acc + c.charCodeAt(0), 0);
      hash = (hash * HASH_BASE + charSum) % HASH_MOD;
    }
    return hash.toString();
  }

  computeRollingHash(tokens: NormalizedToken[], windowSize: number): Map<string, TokenWindow[]> {
    const hashMap = new Map<string, TokenWindow[]>();

    if (tokens.length < windowSize) {
      return hashMap;
    }

    // For each window position
    for (let i = 0; i <= tokens.length - windowSize; i++) {
      const windowTokens = tokens.slice(i, i + windowSize);
      const hash = this.computeHash(windowTokens);

      const window: TokenWindow = {
        file: "", // Will be set by caller
        startLine: windowTokens[0].line,
        endLine: windowTokens[windowTokens.length - 1].line,
        tokens: windowTokens,
        hash,
      };

      const existing = hashMap.get(hash);
      if (existing) {
        existing.push(window);
      } else {
        hashMap.set(hash, [window]);
      }
    }

    return hashMap;
  }

  verifyHashMatch(window1: TokenWindow, window2: TokenWindow): boolean {
    if (window1.tokens.length !== window2.tokens.length) {
      return false;
    }
    return window1.tokens.every((t, i) => t.normalizedValue === window2.tokens[i].normalizedValue);
  }

  /**
   * Gets a code snippet for a range in a file.
   */
  private getCodeSnippetForRange(file: string, startLine: number, endLine: number, maxLines = 8): string {
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");

    const start = Math.max(0, startLine - 1);
    const end = Math.min(lines.length, startLine - 1 + maxLines);

    const snippetLines = lines.slice(start, end);

    // Add ellipsis if we truncated
    if (endLine > startLine - 1 + maxLines) {
      snippetLines.push("// ...");
    }

    const snippet = snippetLines.join("\n");
    // Truncate if still too long
    if (snippet.length > 400) {
      return `${snippet.slice(0, 397)}...`;
    }
    return snippet;
  }

  /**
   * Gets the full code snippet for a range without truncation (for classification).
   */
  private getFullCodeSnippet(file: string, startLine: number, endLine: number): string {
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");

    const start = Math.max(0, startLine - 1);
    const end = Math.min(lines.length, endLine);

    return lines.slice(start, end).join("\n");
  }

  /**
   * Classifies the structural type of a code snippet by parsing and analyzing its AST.
   * @param codeSnippet The code snippet to classify
   * @param file The file path (for context)
   * @returns StructuralUnit with type, label, and repetition count, or undefined if unclassifiable
   */
  classifyStructure(codeSnippet: string, file: string): StructuralUnit | undefined {
    try {
      // Basic validation - check if snippet has reasonable structure
      const trimmed = codeSnippet.trim();
      if (!trimmed || trimmed.length < 3) {
        return undefined;
      }

      // Parse the code snippet as a TypeScript source file
      const sourceFile = ts.createSourceFile(file, codeSnippet, ts.ScriptTarget.Latest, true);

      // Analyze the first meaningful statement/node
      let firstNode: ts.Node | undefined;
      ts.forEachChild(sourceFile, (node) => {
        if (!firstNode && node.kind !== ts.SyntaxKind.EndOfFileToken) {
          firstNode = node;
        }
      });

      if (!firstNode) {
        return undefined;
      }

      // Classify based on node type
      const classification = this.classifyNode(firstNode);
      if (!classification) {
        return undefined;
      }

      // Count the number of duplicate instances (at least 2 for duplication)
      return {
        type: classification.type,
        label: classification.label,
        repetitionCount: 2, // Minimum for duplication
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Classifies a TypeScript AST node and returns its structural type and label.
   */
  private classifyNode(node: ts.Node): { type: StructuralUnitType; label: string } | undefined {
    // Function declarations
    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
      const name = this.getFunctionName(node);
      return {
        type: "function",
        label: name || "anonymous function",
      };
    }

    // For loops
    if (ts.isForStatement(node)) {
      return {
        type: "loop-body",
        label: "for loop",
      };
    }

    // While loops
    if (ts.isWhileStatement(node)) {
      return {
        type: "loop-body",
        label: "while loop",
      };
    }

    // Do-while loops
    if (ts.isDoStatement(node)) {
      return {
        type: "loop-body",
        label: "do-while loop",
      };
    }

    // For-of and for-in loops
    if (ts.isForOfStatement(node) || ts.isForInStatement(node)) {
      return {
        type: "loop-body",
        label: ts.isForOfStatement(node) ? "for-of loop" : "for-in loop",
      };
    }

    // Switch case clauses
    if (ts.isCaseClause(node)) {
      const caseLabel = this.getCaseLabel(node);
      return {
        type: "switch-case",
        label: `case ${caseLabel}`,
      };
    }

    // If statements
    if (ts.isIfStatement(node)) {
      return {
        type: "conditional",
        label: "if statement",
      };
    }

    // Conditional expressions (ternary)
    if (ts.isConditionalExpression(node)) {
      return {
        type: "conditional",
        label: "conditional expression",
      };
    }

    // Block statements or multiple statements
    if (ts.isBlock(node) || ts.isSourceFile(node)) {
      return {
        type: "block",
        label: "code block",
      };
    }

    // Expression statements or other top-level code
    if (ts.isExpressionStatement(node) || ts.isVariableStatement(node)) {
      return {
        type: "block",
        label: "statements",
      };
    }

    // Unknown/unclassified
    return {
      type: "unknown",
      label: "code fragment",
    };
  }

  /**
   * Extracts the name of a function from its declaration.
   */
  private getFunctionName(node: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction): string | undefined {
    if (ts.isFunctionDeclaration(node) && node.name) {
      return node.name.text;
    }
    if (ts.isFunctionExpression(node) && node.name) {
      return node.name.text;
    }
    return undefined;
  }

  /**
   * Extracts the label from a case clause.
   */
  private getCaseLabel(node: ts.CaseClause): string {
    const expression = node.expression;
    if (ts.isStringLiteral(expression) || ts.isNumericLiteral(expression)) {
      return expression.text;
    }
    if (ts.isIdentifier(expression)) {
      return expression.text;
    }
    return "value";
  }

  findDuplicates(): DuplicateBlock[] {
    const minTokens = this.options.minTokens;

    // Tokenize and normalize all files
    const fileTokens = new Map<string, NormalizedToken[]>();
    for (const file of this.files) {
      const tokens = this.tokenizeFile(file);
      const normalized = this.normalizeTokens(tokens);
      fileTokens.set(file, normalized);
    }

    // Compute rolling hashes for all files
    const globalHashMap = new Map<string, TokenWindow[]>();

    for (const [file, tokens] of fileTokens) {
      const hashMap = this.computeRollingHash(tokens, minTokens);

      for (const [hash, windows] of hashMap) {
        // Set file path for each window
        for (const window of windows) {
          window.file = file;
        }

        const existing = globalHashMap.get(hash);
        if (existing) {
          existing.push(...windows);
        } else {
          globalHashMap.set(hash, windows);
        }
      }
    }

    // Find duplicates: hash groups with multiple windows
    const duplicateBlocks: DuplicateBlock[] = [];

    for (const [hash, windows] of globalHashMap) {
      if (windows.length < 2) {
        continue;
      }

      // Group windows that actually match (verify hash collisions)
      const matchGroups: TokenWindow[][] = [];

      for (const window of windows) {
        let foundGroup = false;

        for (const group of matchGroups) {
          if (this.verifyHashMatch(group[0], window)) {
            group.push(window);
            foundGroup = true;
            break;
          }
        }

        if (!foundGroup) {
          matchGroups.push([window]);
        }
      }

      // Create duplicate blocks from groups with multiple matches
      for (const group of matchGroups) {
        if (group.length < 2) {
          continue;
        }

        // Skip if all windows are from the same file and overlapping
        const uniqueFiles = new Set(group.map((w) => w.file));
        if (uniqueFiles.size === 1) {
          const sortedWindows = [...group].sort((a, b) => a.startLine - b.startLine);
          const hasNonOverlapping = sortedWindows.some((w, i) => i > 0 && w.startLine > sortedWindows[i - 1].endLine);
          if (!hasNonOverlapping) {
            continue;
          }
        }

        // Get code snippet from first occurrence
        const firstWindow = group[0];
        const codeSnippet = this.getCodeSnippetForRange(firstWindow.file, firstWindow.startLine, firstWindow.endLine);

        // Classify the structural type of the duplicate (use full snippet for accurate parsing)
        const fullSnippet = this.getFullCodeSnippet(firstWindow.file, firstWindow.startLine, firstWindow.endLine);
        const structuralUnit = fullSnippet ? this.classifyStructure(fullSnippet, firstWindow.file) : undefined;

        duplicateBlocks.push({
          files: group.map((w) => ({
            file: w.file,
            startLine: w.startLine,
            endLine: w.endLine,
          })),
          tokenCount: minTokens,
          fingerprint: hash,
          codeSnippet,
          structuralUnit,
        });
      }
    }

    return this.mergeOverlappingBlocks(duplicateBlocks);
  }

  mergeOverlappingBlocks(blocks: DuplicateBlock[]): DuplicateBlock[] {
    if (blocks.length === 0) {
      return [];
    }

    // Create a map to group blocks by their file pair signature
    const getFilePairKey = (block: DuplicateBlock): string => {
      const files = block.files.map((f) => f.file).sort();
      return files.join("|||");
    };

    const groupedBlocks = new Map<string, DuplicateBlock[]>();

    for (const block of blocks) {
      const key = getFilePairKey(block);
      const existing = groupedBlocks.get(key);
      if (existing) {
        existing.push(block);
      } else {
        groupedBlocks.set(key, [block]);
      }
    }

    const mergedBlocks: DuplicateBlock[] = [];

    for (const [, fileBlocks] of groupedBlocks) {
      // Sort blocks by first file's start line
      const sortedBlocks = [...fileBlocks].sort((a, b) => a.files[0].startLine - b.files[0].startLine);

      let currentMerged = sortedBlocks[0];

      for (let i = 1; i < sortedBlocks.length; i++) {
        const next = sortedBlocks[i];

        // Check if blocks overlap or are adjacent
        const canMerge = this.blocksOverlapOrAdjacent(currentMerged, next);

        if (canMerge) {
          // Merge the blocks
          currentMerged = this.mergeTwo(currentMerged, next);
        } else {
          mergedBlocks.push(currentMerged);
          currentMerged = next;
        }
      }

      mergedBlocks.push(currentMerged);
    }

    return mergedBlocks;
  }

  private blocksOverlapOrAdjacent(block1: DuplicateBlock, block2: DuplicateBlock): boolean {
    // Check if all corresponding files overlap or are adjacent
    for (const file1 of block1.files) {
      const file2 = block2.files.find((f) => f.file === file1.file);
      if (!file2) {
        return false;
      }

      // Check if ranges overlap or are adjacent (endLine + 1 >= startLine)
      const overlaps = file1.startLine <= file2.endLine + 1 && file2.startLine <= file1.endLine + 1;
      if (!overlaps) {
        return false;
      }
    }

    return true;
  }

  private mergeTwo(block1: DuplicateBlock, block2: DuplicateBlock): DuplicateBlock {
    const mergedFiles = block1.files.map((file1) => {
      const file2 = block2.files.find((f) => f.file === file1.file);
      if (!file2) {
        return file1;
      }

      return {
        file: file1.file,
        startLine: Math.min(file1.startLine, file2.startLine),
        endLine: Math.max(file1.endLine, file2.endLine),
      };
    });

    // Calculate approximate token count based on merged range
    const lineRange = mergedFiles[0].endLine - mergedFiles[0].startLine + 1;
    const avgTokensPerLine = block1.tokenCount / (block1.files[0].endLine - block1.files[0].startLine + 1);
    const estimatedTokenCount = Math.round(lineRange * avgTokensPerLine);

    // Regenerate code snippet for the merged range (if file exists)
    let codeSnippet: string | undefined;
    try {
      codeSnippet = this.getCodeSnippetForRange(mergedFiles[0].file, mergedFiles[0].startLine, mergedFiles[0].endLine);
    } catch {
      // File may not exist (e.g., in tests) - use original snippet if available
      codeSnippet = block1.codeSnippet;
    }

    // Reclassify the merged block if we have a new snippet
    let structuralUnit: StructuralUnit | undefined;
    if (codeSnippet && codeSnippet !== block1.codeSnippet) {
      // New snippet was generated, reclassify
      const fullSnippet = this.getFullCodeSnippet(
        mergedFiles[0].file,
        mergedFiles[0].startLine,
        mergedFiles[0].endLine,
      );
      structuralUnit = fullSnippet ? this.classifyStructure(fullSnippet, mergedFiles[0].file) : undefined;
    } else {
      // Use original classification
      structuralUnit = block1.structuralUnit;
    }

    return {
      files: mergedFiles,
      tokenCount: Math.max(block1.tokenCount, estimatedTokenCount),
      fingerprint: block1.fingerprint,
      codeSnippet,
      structuralUnit,
    };
  }

  analyze(): DuplicationMetrics {
    // Calculate total lines across all files
    let totalLines = 0;
    const fileLOC = new Map<string, number>();

    for (const file of this.files) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n").length;
      fileLOC.set(file, lines);
      totalLines += lines;
    }

    // Find duplicates
    const blocks = this.findDuplicates();

    // Calculate duplicated lines (counting each unique line only once per file)
    const duplicatedLinesPerFile = new Map<string, Set<number>>();

    for (const block of blocks) {
      for (const fileRef of block.files) {
        let lineSet = duplicatedLinesPerFile.get(fileRef.file);
        if (!lineSet) {
          lineSet = new Set();
          duplicatedLinesPerFile.set(fileRef.file, lineSet);
        }

        for (let line = fileRef.startLine; line <= fileRef.endLine; line++) {
          lineSet.add(line);
        }
      }
    }

    let duplicatedLines = 0;
    for (const lineSet of duplicatedLinesPerFile.values()) {
      duplicatedLines += lineSet.size;
    }

    const density = totalLines > 0 ? duplicatedLines / totalLines : 0;

    return {
      totalLines,
      duplicatedLines,
      density,
      blocks,
    };
  }
}
