/**
 * PostToolUse hook: TypeScript and ESLint validation.
 *
 * Runs TypeScript type checking and ESLint after Write/Edit/MultiEdit operations
 * on TypeScript files. Reports errors with detailed context including line numbers
 * and code snippets.
 *
 * @see https://code.claude.com/docs/en/hooks#posttooluse
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { postToolUseHook, postToolUseOutput, getFilePath, isTsFile } from '@goodfoot/claude-code-hooks';

// ============================================================================
// Types
// ============================================================================

interface TypeScriptError {
  type: 'typescript';
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  context: ContextLine[];
  usageRef?: string;
}

interface ESLintError {
  type: 'eslint';
  file: string;
  line: number;
  column: number;
  severity: string;
  message: string;
  rule: string;
  context: ContextLine[];
}

interface ContextLine {
  line: number;
  content: string;
  current: boolean;
}

interface SignatureInfo {
  signature: string;
  type: string;
}

type ParsedError = TypeScriptError | ESLintError;

// ============================================================================
// File Utilities
// ============================================================================

function getFileLines(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n');
  } catch {
    return [];
  }
}

function getContextLines(lines: string[], lineNum: number, contextSize = 1): ContextLine[] {
  const line = lineNum;
  const start = Math.max(0, line - contextSize - 1);
  const end = Math.min(lines.length, line + contextSize);

  const context: ContextLine[] = [];
  for (let i = start; i < end; i++) {
    context.push({
      line: i + 1,
      content: lines[i],
      current: i === line - 1
    });
  }
  return context;
}

function findPackageJson(filePath: string): string | null {
  let dir = path.dirname(filePath);
  while (dir !== '/') {
    const packagePath = path.join(dir, 'package.json');
    if (fs.existsSync(packagePath)) {
      return packagePath;
    }
    dir = path.dirname(dir);
  }
  return null;
}

function getPackageDirectory(filePath: string): string | null {
  const packageJsonPath = findPackageJson(filePath);
  return packageJsonPath ? path.dirname(packageJsonPath) : null;
}

// ============================================================================
// TypeScript Error Parsing
// ============================================================================

function parseAllTypeScriptErrors(
  output: string,
  packageDir: string
): { errors: TypeScriptError[]; signatures: Map<string, SignatureInfo> } {
  const errors: TypeScriptError[] = [];
  const signatures = new Map<string, SignatureInfo>();

  // Remove ANSI color codes from the output
  const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
  const lines = cleanOutput.split('\n');

  for (const line of lines) {
    // Match TypeScript error format for ANY file
    const match = line.match(/^(.+?)(?:\(|:)(\d+)(?:,|:)(\d+)\)?\s*[-:]?\s*error\s+(TS\d+):\s*(.+)$/);
    if (match) {
      const [, filePath, lineNum, colNum, code, message] = match;

      // Resolve to absolute path
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(packageDir, filePath);

      const fileLines = getFileLines(absolutePath);

      errors.push({
        type: 'typescript',
        file: absolutePath,
        line: parseInt(lineNum, 10),
        column: parseInt(colNum, 10),
        code: code,
        message: message.trim(),
        context: getContextLines(fileLines, parseInt(lineNum, 10))
      });
    }
  }

  return { errors, signatures };
}

// ============================================================================
// ESLint Error Parsing
// ============================================================================

function parseESLintErrors(output: string, filePath: string): ESLintError[] {
  const errors: ESLintError[] = [];
  const lines = output.split('\n');
  const fileLines = getFileLines(filePath);

  let inFileSection = false;
  for (const line of lines) {
    // Check if we're in the file section
    if (line.trim() === filePath) {
      inFileSection = true;
      continue;
    }

    // Skip empty lines and summary lines
    if (!line.trim() || line.includes('problem') || line.includes('warning')) {
      inFileSection = false;
      continue;
    }

    if (inFileSection) {
      // Match ESLint error format: line:col  severity  message  rule
      const match = line.match(/^\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)\s\s+(.+)$/);
      if (match) {
        const [, lineNum, colNum, severity, message, rule] = match;
        errors.push({
          type: 'eslint',
          file: filePath,
          line: parseInt(lineNum, 10),
          column: parseInt(colNum, 10),
          severity: severity,
          message: message.trim(),
          rule: rule.trim(),
          context: getContextLines(fileLines, parseInt(lineNum, 10))
        });
      }
    }
  }
  return errors;
}

// ============================================================================
// Dependent File Discovery
// ============================================================================

function findDependentFiles(filePath: string, packageDir: string): string[] {
  try {
    const fileName = path.basename(filePath, path.extname(filePath));
    const relativePath = path.relative(packageDir, filePath);

    // Create patterns for different import styles
    const patterns = [
      `from.*${fileName}`,
      `from.*${relativePath.replace(/\.[tj]sx?$/, '')}`,
      `import.*from.*${fileName}`,
      `require.*${fileName}`
    ];

    const dependentFiles = new Set<string>();

    for (const pattern of patterns) {
      try {
        const cmd = `/usr/bin/rg -l "${pattern}" --type-add 'tsx:*.tsx' --type-add 'jsx:*.jsx' --type ts --type tsx --type js --type jsx "${packageDir}" 2>/dev/null | head -10`;

        const result = execSync(cmd, {
          cwd: packageDir,
          stdio: 'pipe',
          encoding: 'utf8',
          shell: '/bin/bash',
          env: process.env
        });

        const files = result.split('\n').filter((f) => f.trim() && f !== filePath);
        files.forEach((f) => dependentFiles.add(f));
      } catch {
        // Ignore errors from ripgrep (e.g., no matches)
      }
    }

    return Array.from(dependentFiles).slice(0, 5); // Limit to 5 files for performance
  } catch {
    return [];
  }
}

// ============================================================================
// Validation Commands
// ============================================================================

function runProjectTypeCheck(packageDir: string): { success: boolean; errors: TypeScriptError[]; signatures: Map<string, SignatureInfo> } {
  try {
    const tsconfigPath = path.join(packageDir, 'tsconfig.json');
    if (!fs.existsSync(tsconfigPath)) {
      return { success: true, errors: [], signatures: new Map() };
    }

    const tscCommand = 'npx tsc --project tsconfig.json --noEmit --incremental --tsBuildInfoFile ./build/.tsbuildinfo-hook --pretty';

    execSync(tscCommand, {
      cwd: packageDir,
      stdio: 'pipe',
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_PATH: path.join(packageDir, 'node_modules')
      }
    });

    return { success: true, errors: [], signatures: new Map() };
  } catch (error) {
    const errorOutput = (error as { stdout?: string; stderr?: string }).stdout || (error as { stderr?: string }).stderr || '';
    const { errors, signatures } = parseAllTypeScriptErrors(errorOutput, packageDir);
    return { success: false, errors, signatures };
  }
}

function runESLint(filePath: string, packageDir: string): { success: boolean; errors: ESLintError[] } {
  const relativePath = path.relative(packageDir, filePath);

  try {
    execSync(`yarn eslint:files "${relativePath}" --cache --cache-location ./build/.eslintcache`, {
      cwd: packageDir,
      stdio: 'pipe',
      encoding: 'utf8'
    });

    return { success: true, errors: [] };
  } catch (lintError) {
    let errorOutput = '';

    const err = lintError as { stdout?: string | Buffer; stderr?: string | Buffer; output?: (string | Buffer | null)[] };
    if (err.stdout) {
      errorOutput = typeof err.stdout === 'string' ? err.stdout : err.stdout.toString('utf8');
    } else if (err.output && Array.isArray(err.output)) {
      const out = err.output[1] || err.output[2];
      errorOutput = out ? (typeof out === 'string' ? out : out.toString('utf8')) : '';
    } else if (err.stderr) {
      errorOutput = typeof err.stderr === 'string' ? err.stderr : err.stderr.toString('utf8');
    }

    const errors = parseESLintErrors(errorOutput, filePath);

    return { success: false, errors };
  }
}

// ============================================================================
// Error Filtering
// ============================================================================

function filterDependentFileErrors(allErrors: TypeScriptError[], dependentFiles: string[], _editedFile: string): TypeScriptError[] {
  const depFileSet = new Set(dependentFiles);

  return allErrors.filter((error) => {
    if (depFileSet.has(error.file)) {
      // Only include errors likely caused by changes to the edited file
      return (
        error.code === 'TS2305' || // Module has no exported member
        error.code === 'TS2339' || // Property does not exist
        error.code === 'TS2345' || // Argument type mismatch
        error.code === 'TS2322' || // Type assignment error
        error.code === 'TS2554' || // Expected arguments error
        error.code === 'TS2741' || // Missing properties
        error.message.toLowerCase().includes('import') ||
        error.message.toLowerCase().includes('export')
      );
    }
    return false;
  });
}

// ============================================================================
// Output Formatting
// ============================================================================

function formatErrorsAsYAML(
  directErrors: ParsedError[],
  externalErrors: TypeScriptError[],
  signatures: Map<string, SignatureInfo>
): string {
  let yaml = '';

  // Direct errors in the edited file
  if (directErrors.length > 0) {
    yaml += 'errors:\n';

    for (const error of directErrors) {
      yaml += `  - type: ${error.type}\n`;
      yaml += `    file: ${error.file}\n`;
      yaml += `    line: ${error.line}\n`;
      yaml += `    column: ${error.column}\n`;

      if ('code' in error && error.code) {
        yaml += `    code: ${error.code}\n`;
      }
      if ('severity' in error && error.severity) {
        yaml += `    severity: ${error.severity}\n`;
      }
      if ('rule' in error && error.rule) {
        yaml += `    rule: ${error.rule}\n`;
      }

      yaml += `    message: "${error.message.replace(/"/g, '\\"')}"\n`;

      if ('usageRef' in error && error.usageRef) {
        yaml += `    usage_ref: ${error.usageRef}\n`;
      }

      yaml += '    context:\n';

      for (const ctx of error.context) {
        const marker = ctx.current ? '>' : ' ';
        yaml += `      ${marker} ${ctx.line}: "${ctx.content.replace(/"/g, '\\"')}"\n`;
      }
    }
  }

  // External errors in dependent files
  if (externalErrors.length > 0) {
    yaml += '\nexternal:\n';

    // Group errors by file
    const errorsByFile: Record<string, TypeScriptError[]> = {};
    for (const error of externalErrors) {
      if (!errorsByFile[error.file]) {
        errorsByFile[error.file] = [];
      }
      errorsByFile[error.file].push(error);
    }

    for (const [file, fileErrors] of Object.entries(errorsByFile)) {
      yaml += `  "${file}":\n`;

      for (const error of fileErrors) {
        yaml += `    - type: ${error.type}\n`;
        yaml += `      line: ${error.line}\n`;
        yaml += `      column: ${error.column}\n`;

        if (error.code) {
          yaml += `      code: ${error.code}\n`;
        }

        yaml += `      message: "${error.message.replace(/"/g, '\\"')}"\n`;

        // Include minimal context for external errors
        if (error.context && error.context.length > 0) {
          const currentLine = error.context.find((c) => c.current);
          if (currentLine) {
            yaml += `      source: "${currentLine.content.replace(/"/g, '\\"')}"\n`;
          }
        }
      }
    }
  }

  // Add usage section if we have signatures
  if (signatures && signatures.size > 0) {
    yaml += '\nusage:\n';
    for (const [key, info] of signatures) {
      yaml += `  "${key}":\n`;
      yaml += `    signature: "${info.signature.replace(/"/g, '\\"')}"\n`;
      yaml += `    type: ${info.type}\n`;
    }
  }

  return yaml;
}

// ============================================================================
// Main Hook
// ============================================================================

export default postToolUseHook({ matcher: 'Write|Edit|MultiEdit', timeout: 60000 }, (input, { logger }) => {
  const filePath = getFilePath(input);

  if (!filePath) {
    logger.debug('No file path found in input');
    return postToolUseOutput({});
  }

  if (!isTsFile(filePath)) {
    logger.debug('Skipping non-TypeScript file', { filePath });
    return postToolUseOutput({});
  }

  if (!fs.existsSync(filePath)) {
    logger.warn('File not found', { filePath });
    return postToolUseOutput({});
  }

  logger.info('Checking TypeScript file', { filePath });

  const packageDir = getPackageDirectory(filePath);
  if (!packageDir) {
    logger.warn('Could not find package.json for file', { filePath });
    return postToolUseOutput({
      hookSpecificOutput: {
        additionalContext: `Could not find package.json for file: ${filePath}`
      }
    });
  }

  logger.debug('Package directory', { packageDir });

  // Run TypeScript check ONCE for entire project
  const typeCheckResult = runProjectTypeCheck(packageDir);

  // Run ESLint and find dependent files
  const eslintResult = runESLint(filePath, packageDir);
  const dependentFiles = findDependentFiles(filePath, packageDir);

  // Filter errors for edited file
  const directTsErrors = typeCheckResult.errors.filter((e) => e.file === filePath);
  const directErrors: ParsedError[] = [...directTsErrors, ...eslintResult.errors];

  // Filter errors for dependent files (no additional tsc runs needed!)
  const externalErrors = filterDependentFileErrors(typeCheckResult.errors, dependentFiles, filePath);

  if (directErrors.length > 0 || externalErrors.length > 0) {
    const yamlOutput = formatErrorsAsYAML(directErrors, externalErrors, typeCheckResult.signatures);
    const errorSummary = `Found ${directErrors.length} direct error(s)${externalErrors.length > 0 ? ` and ${externalErrors.length} error(s) in dependent files` : ''}`;
    const systemMessage = `TypeScript check: ${errorSummary}. Review the error details and fix type issues before proceeding.`;

    logger.info('Validation errors found', {
      directCount: directErrors.length,
      externalCount: externalErrors.length
    });

    return postToolUseOutput({
      systemMessage,
      hookSpecificOutput: {
        additionalContext: yamlOutput
      }
    });
  }

  logger.debug('No validation errors');
  return postToolUseOutput({});
});
