import * as fs from "node:fs";
import * as ts from "typescript";
import type { ClassEncapsulation, EncapsulationMetrics, EncapsulationOptions } from "../types.js";

export class EncapsulationAnalyzer {
  private options: EncapsulationOptions;

  constructor(options: EncapsulationOptions) {
    this.options = options;
  }

  analyze(files?: string[]): EncapsulationMetrics {
    // Use provided files or options.files
    const filesToAnalyze = files ?? this.options.files;
    const classes: ClassEncapsulation[] = [];

    for (const file of filesToAnalyze) {
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, "utf-8");
      const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
      this.analyzeSourceFile(sourceFile, file, classes);
    }

    return {
      classes,
      aggregateMhf: this.calculateAggregate(classes, "mhf"),
      aggregateAhf: this.calculateAggregate(classes, "ahf"),
    };
  }

  private analyzeSourceFile(sourceFile: ts.SourceFile, file: string, classes: ClassEncapsulation[]): void {
    const visit = (node: ts.Node): void => {
      if (ts.isClassDeclaration(node)) {
        // Skip abstract classes
        if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AbstractKeyword)) {
          return;
        }

        // Skip classes without names
        if (!node.name) {
          return;
        }

        const className = node.name.getText(sourceFile);
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

        let totalMethods = 0;
        let hiddenMethods = 0;
        let totalAttributes = 0;
        let hiddenAttributes = 0;

        // Analyze class members
        for (const member of node.members) {
          // Count methods (exclude constructors)
          if (ts.isMethodDeclaration(member) || ts.isGetAccessor(member) || ts.isSetAccessor(member)) {
            totalMethods++;
            if (this.isHidden(member)) {
              hiddenMethods++;
            }
          }

          // Count properties
          if (ts.isPropertyDeclaration(member)) {
            totalAttributes++;
            if (this.isHidden(member)) {
              hiddenAttributes++;
            }
          }
        }

        // Calculate MHF and AHF
        const mhf = totalMethods === 0 ? 1.0 : hiddenMethods / totalMethods;
        const ahf = totalAttributes === 0 ? 1.0 : hiddenAttributes / totalAttributes;

        classes.push({
          className,
          file,
          line,
          totalMethods,
          hiddenMethods,
          totalAttributes,
          hiddenAttributes,
          mhf,
          ahf,
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  private isHidden(node: ts.ClassElement): boolean {
    // Check for private or protected modifiers
    if (ts.canHaveModifiers(node)) {
      const modifiers = ts.getModifiers(node);
      if (modifiers) {
        const hasPrivate = modifiers.some((m: ts.Modifier) => m.kind === ts.SyntaxKind.PrivateKeyword);
        const hasProtected = modifiers.some((m: ts.Modifier) => m.kind === ts.SyntaxKind.ProtectedKeyword);
        if (hasPrivate || hasProtected) {
          return true;
        }
      }
    }

    // Check for #private name (ECMAScript private field)
    if (
      ts.isPropertyDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isGetAccessor(node) ||
      ts.isSetAccessor(node)
    ) {
      if (node.name && ts.isPrivateIdentifier(node.name)) {
        return true;
      }
    }

    return false;
  }

  private calculateAggregate(classes: ClassEncapsulation[], field: "mhf" | "ahf"): number {
    if (classes.length === 0) {
      return 1.0;
    }

    const sum = classes.reduce((acc, cls) => acc + cls[field], 0);
    return sum / classes.length;
  }
}
