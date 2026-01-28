/**
 * SDK Type Snapshot Script
 *
 * Extracts type information from the @anthropic-ai/claude-agent-sdk package
 * and compares it against a baseline to detect changes.
 *
 * Usage:
 *   yarn snapshot:sdk-types           # Check for changes
 *   yarn snapshot:sdk-types --update  # Update baseline
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Project, SyntaxKind, type Type, type TypeAliasDeclaration } from "ts-morph";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(packageRoot, "../..");
const baselinePath = path.join(packageRoot, "sdk-types-baseline.json");

/**
 * Find the SDK types file, checking both package-local and workspace-hoisted locations.
 */
function findSdkTypesPath(): string {
  const sdkRelativePath = "@anthropic-ai/claude-agent-sdk/sdk.d.ts";
  const candidates = [
    path.resolve(packageRoot, "node_modules", sdkRelativePath),
    path.resolve(workspaceRoot, "node_modules", sdkRelativePath),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  console.error("SDK types file not found. Searched:");
  for (const candidate of candidates) {
    console.error(`  - ${candidate}`);
  }
  console.error("Make sure @anthropic-ai/claude-agent-sdk is installed.");
  process.exit(1);
}

/**
 * Find the SDK package.json, checking both package-local and workspace-hoisted locations.
 */
function findSdkPackageJsonPath(): string | null {
  const sdkRelativePath = "@anthropic-ai/claude-agent-sdk/package.json";
  const candidates = [
    path.resolve(packageRoot, "node_modules", sdkRelativePath),
    path.resolve(workspaceRoot, "node_modules", sdkRelativePath),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

// Types to extract from the SDK
const TARGET_TYPES = [
  "BaseHookInput",
  "PreToolUseHookInput",
  "PostToolUseHookInput",
  "PostToolUseFailureHookInput",
  "NotificationHookInput",
  "UserPromptSubmitHookInput",
  "SessionStartHookInput",
  "SessionEndHookInput",
  "StopHookInput",
  "SubagentStartHookInput",
  "SubagentStopHookInput",
  "PreCompactHookInput",
  "PermissionRequestHookInput",
  "HookInput",
  "PermissionMode",
  "HookEvent",
] as const;

interface PropertyInfo {
  name: string;
  type: string;
  optional: boolean;
}

interface TypeInfo {
  kind: "interface" | "type-alias" | "union" | "literal";
  properties?: PropertyInfo[];
  unionMembers?: string[];
  literalType?: string;
}

interface Baseline {
  version: string;
  sdkPackage: string;
  extractedAt: string;
  types: Record<string, TypeInfo>;
}

/**
 * Resolve the expanded type string for a type, handling intersections.
 */
function resolveTypeString(type: Type): string {
  const text = type.getText();
  // Simplify common patterns
  return text
    .replace(/import\([^)]+\)\./g, "") // Remove import() references
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Extract properties from an object-like type.
 */
function extractProperties(type: Type): PropertyInfo[] {
  const properties: PropertyInfo[] = [];

  for (const prop of type.getProperties()) {
    const declarations = prop.getDeclarations();
    const declaration = declarations[0];

    let optional = false;
    let propType = "unknown";

    if (declaration) {
      const propSymbol = prop;
      const valueDeclaration = propSymbol.getValueDeclaration();
      if (valueDeclaration && valueDeclaration.getKind() === SyntaxKind.PropertySignature) {
        const propSig = valueDeclaration.asKind(SyntaxKind.PropertySignature);
        if (propSig) {
          optional = propSig.hasQuestionToken();
          const typeNode = propSig.getTypeNode();
          if (typeNode) {
            propType = typeNode.getText();
          }
        }
      } else {
        // Fallback for other declaration types
        const propTypeFromSymbol = prop.getTypeAtLocation(declaration);
        propType = resolveTypeString(propTypeFromSymbol);
      }
    }

    properties.push({
      name: prop.getName(),
      type: propType,
      optional,
    });
  }

  // Sort by name for consistent output
  return properties.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Extract type information from a type alias declaration.
 */
function extractTypeInfo(typeAlias: TypeAliasDeclaration): TypeInfo {
  const type = typeAlias.getType();
  const typeNode = typeAlias.getTypeNode();

  // Check if it's a union type
  if (type.isUnion()) {
    const unionTypes = type.getUnionTypes();

    // Check if it's a literal union (like PermissionMode or HookEvent)
    const allLiterals = unionTypes.every((t) => t.isStringLiteral() || t.isLiteral());
    if (allLiterals) {
      return {
        kind: "literal",
        literalType: unionTypes.map((t) => t.getText()).join(" | "),
      };
    }

    // For complex unions (like HookInput), list the member type names
    return {
      kind: "union",
      unionMembers: unionTypes.map((t) => {
        const text = t.getText();
        // Extract just the type name for readability
        const match = text.match(/^(\w+HookInput)$/);
        return match ? match[1] : resolveTypeString(t);
      }),
    };
  }

  // Check if it's an intersection or object type
  if (type.isObject() || type.isIntersection()) {
    return {
      kind: "type-alias",
      properties: extractProperties(type),
    };
  }

  // Fallback for other types
  return {
    kind: "type-alias",
    literalType: typeNode?.getText() ?? type.getText(),
  };
}

/**
 * Load and parse the SDK types file.
 */
function extractSdkTypes(): Record<string, TypeInfo> {
  const sdkTypesPath = findSdkTypesPath();

  const project = new Project({
    compilerOptions: {
      strict: true,
    },
  });

  const sourceFile = project.addSourceFileAtPath(sdkTypesPath);
  const result: Record<string, TypeInfo> = {};

  for (const typeName of TARGET_TYPES) {
    const typeAlias = sourceFile.getTypeAlias(typeName);
    if (typeAlias) {
      result[typeName] = extractTypeInfo(typeAlias);
    } else {
      console.warn(`Warning: Type '${typeName}' not found in SDK`);
    }
  }

  return result;
}

/**
 * Compare two type snapshots and return differences.
 */
function compareSnapshots(
  baseline: Record<string, TypeInfo>,
  current: Record<string, TypeInfo>,
): { added: string[]; removed: string[]; changed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  const allTypes = new Set([...Object.keys(baseline), ...Object.keys(current)]);

  for (const typeName of allTypes) {
    const baselineType = baseline[typeName];
    const currentType = current[typeName];

    if (!baselineType && currentType) {
      added.push(typeName);
    } else if (baselineType && !currentType) {
      removed.push(typeName);
    } else if (JSON.stringify(baselineType) !== JSON.stringify(currentType)) {
      changed.push(typeName);
    }
  }

  return { added, removed, changed };
}

/**
 * Format a detailed diff for a changed type.
 */
function formatTypeDiff(typeName: string, baseline: TypeInfo, current: TypeInfo): string {
  const lines: string[] = [`  ${typeName}:`];

  if (baseline.kind !== current.kind) {
    lines.push(`    kind: ${baseline.kind} -> ${current.kind}`);
  }

  if (baseline.properties && current.properties) {
    const baselineProps = new Map(baseline.properties.map((p) => [p.name, p]));
    const currentProps = new Map(current.properties.map((p) => [p.name, p]));

    for (const [name, prop] of currentProps) {
      const baseProp = baselineProps.get(name);
      if (!baseProp) {
        lines.push(`    + ${name}: ${prop.type}${prop.optional ? "?" : ""}`);
      } else if (JSON.stringify(baseProp) !== JSON.stringify(prop)) {
        lines.push(
          `    ~ ${name}: ${baseProp.type}${baseProp.optional ? "?" : ""} -> ${prop.type}${prop.optional ? "?" : ""}`,
        );
      }
    }

    for (const [name, prop] of baselineProps) {
      if (!currentProps.has(name)) {
        lines.push(`    - ${name}: ${prop.type}${prop.optional ? "?" : ""}`);
      }
    }
  }

  if (baseline.literalType !== current.literalType) {
    lines.push(`    literal: ${baseline.literalType} -> ${current.literalType}`);
  }

  if (baseline.unionMembers && current.unionMembers) {
    const baselineSet = new Set(baseline.unionMembers);
    const currentSet = new Set(current.unionMembers);

    for (const member of currentSet) {
      if (!baselineSet.has(member)) {
        lines.push(`    + union member: ${member}`);
      }
    }
    for (const member of baselineSet) {
      if (!currentSet.has(member)) {
        lines.push(`    - union member: ${member}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Main entry point.
 */
function main(): void {
  const updateMode = process.argv.includes("--update");

  console.log("Extracting SDK types...");
  const currentTypes = extractSdkTypes();

  // Get SDK package version
  let sdkVersion = "unknown";
  const sdkPackageJsonPath = findSdkPackageJsonPath();
  if (sdkPackageJsonPath) {
    try {
      const sdkPackageJson = JSON.parse(fs.readFileSync(sdkPackageJsonPath, "utf-8")) as {
        version?: string;
      };
      sdkVersion = sdkPackageJson.version ?? "unknown";
    } catch {
      console.warn("Warning: Could not read SDK package.json");
    }
  }

  const currentBaseline: Baseline = {
    version: "1.0",
    sdkPackage: `@anthropic-ai/claude-agent-sdk@${sdkVersion}`,
    extractedAt: new Date().toISOString(),
    types: currentTypes,
  };

  // Check if baseline exists
  if (!fs.existsSync(baselinePath)) {
    console.log("No baseline found. Creating initial baseline...");
    fs.writeFileSync(baselinePath, `${JSON.stringify(currentBaseline, null, 2)}\n`);
    console.log(`Baseline created: ${baselinePath}`);
    console.log(`SDK version: ${sdkVersion}`);
    console.log(`Types extracted: ${Object.keys(currentTypes).length}`);
    return;
  }

  // Load existing baseline
  const existingBaseline = JSON.parse(fs.readFileSync(baselinePath, "utf-8")) as Baseline;

  // Compare
  const diff = compareSnapshots(existingBaseline.types, currentTypes);
  const hasChanges = diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0;

  if (!hasChanges) {
    console.log("SDK types unchanged.");
    console.log(`Baseline SDK: ${existingBaseline.sdkPackage}`);
    console.log(`Current SDK: @anthropic-ai/claude-agent-sdk@${sdkVersion}`);
    process.exit(0);
  }

  // Report changes
  console.log("\n=== SDK Type Changes Detected ===\n");
  console.log(`Baseline SDK: ${existingBaseline.sdkPackage}`);
  console.log(`Current SDK: @anthropic-ai/claude-agent-sdk@${sdkVersion}\n`);

  if (diff.added.length > 0) {
    console.log("Added types:");
    for (const t of diff.added) {
      console.log(`  + ${t}`);
    }
    console.log();
  }

  if (diff.removed.length > 0) {
    console.log("Removed types:");
    for (const t of diff.removed) {
      console.log(`  - ${t}`);
    }
    console.log();
  }

  if (diff.changed.length > 0) {
    console.log("Changed types:");
    for (const typeName of diff.changed) {
      console.log(formatTypeDiff(typeName, existingBaseline.types[typeName], currentTypes[typeName]));
    }
    console.log();
  }

  if (updateMode) {
    fs.writeFileSync(baselinePath, `${JSON.stringify(currentBaseline, null, 2)}\n`);
    console.log("Baseline updated.");
    process.exit(0);
  } else {
    console.log("Run with --update to update the baseline.");
    process.exit(1);
  }
}

main();
