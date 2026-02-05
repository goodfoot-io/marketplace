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
        const classMetrics = this.analyzeClass(node, sourceFile, file);
        if (classMetrics) {
          classes.push(classMetrics);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  private analyzeClass(node: ts.ClassDeclaration, sourceFile: ts.SourceFile, file: string): ClassEncapsulation | null {
    // Skip abstract classes and classes without names
    if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AbstractKeyword)) {
      return null;
    }
    if (!node.name) {
      return null;
    }

    const className = node.name.getText(sourceFile);
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

    let totalMethods = 0;
    let hiddenMethods = 0;
    let totalAttributes = 0;
    let hiddenAttributes = 0;

    for (const member of node.members) {
      if (ts.isMethodDeclaration(member) || ts.isGetAccessor(member) || ts.isSetAccessor(member)) {
        totalMethods++;
        if (this.isHidden(member)) {
          hiddenMethods++;
        }
      } else if (ts.isPropertyDeclaration(member)) {
        totalAttributes++;
        if (this.isHidden(member)) {
          hiddenAttributes++;
        }
      }
    }

    const mhf = totalMethods === 0 ? 1.0 : hiddenMethods / totalMethods;
    const ahf = totalAttributes === 0 ? 1.0 : hiddenAttributes / totalAttributes;

    return {
      className,
      file,
      line,
      totalMethods,
      hiddenMethods,
      totalAttributes,
      hiddenAttributes,
      mhf,
      ahf,
    };
  }

  private isHidden(node: ts.ClassElement): boolean {
    // Check for private or protected modifiers
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    if (modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword)) {
      return true;
    }

    // Check for #private name (ECMAScript private field)
    if ("name" in node && node.name && ts.isPrivateIdentifier(node.name)) {
      return true;
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
