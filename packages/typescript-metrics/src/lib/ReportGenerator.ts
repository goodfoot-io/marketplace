import * as path from "node:path";
import type {
  ChurnHotspotMetrics,
  ComplexityMetrics,
  CouplingMetrics,
  CycleMetrics,
  DuplicationMetrics,
  EncapsulationMetrics,
  HubNode,
  MetricsResult,
} from "../types.js";

// Thresholds
const COMPLEXITY_THRESHOLD_CYCLOMATIC = 10;
const COMPLEXITY_THRESHOLD_COGNITIVE = 15;
const DUPLICATION_THRESHOLD_PERCENT = 10;
const COUPLING_HUB_THRESHOLD = 10;

// Score thresholds: 0-49 = Critical, 50-74 = Warning, 75-100 = Healthy
const SCORE_CRITICAL = 50;
const SCORE_WARNING = 75;

interface CategoryScore {
  name: string;
  score: number;
  weight: number;
  reason: string;
}

interface Issue {
  severity: "critical" | "warning";
  category: string;
  title: string;
  details: string[];
  recommendation: string;
}

export interface ReportOptions {
  rootDir: string;
  fileCount: number;
  packageCount?: number;
  timestamp: string;
  minTokens?: number;
}

export class ReportGenerator {
  private rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  private formatEncapsulationSection(metrics: EncapsulationMetrics): string[] {
    const lines: string[] = [];

    lines.push("## Encapsulation Overview");
    lines.push("");

    // Aggregate metrics table with color coding
    const mhfStatus =
      metrics.aggregateMhf >= 0.5 ? "🟢 Healthy" : metrics.aggregateMhf >= 0.3 ? "🟡 Review" : "🔴 Poor";
    const ahfStatus =
      metrics.aggregateAhf >= 0.8 ? "🟢 Healthy" : metrics.aggregateAhf >= 0.5 ? "🟡 Review" : "🔴 Poor";

    lines.push("| Metric | Score | Status |");
    lines.push("|--------|-------|--------|");
    lines.push(`| Method Hiding Factor | ${metrics.aggregateMhf.toFixed(2)} | ${mhfStatus} |`);
    lines.push(`| Attribute Hiding Factor | ${metrics.aggregateAhf.toFixed(2)} | ${ahfStatus} |`);
    lines.push("");
    lines.push("*MHF measures the ratio of hidden methods. AHF measures the ratio of hidden attributes.*");
    lines.push("");

    // Classes with poor encapsulation
    const poorEncapsulation = metrics.classes.filter((c) => c.mhf < 0.5 || c.ahf < 0.5);

    if (poorEncapsulation.length > 0) {
      lines.push("**Classes with low encapsulation:**");
      lines.push("");
      lines.push("| Class | File | MHF | AHF |");
      lines.push("|-------|------|-----|-----|");

      for (const cls of poorEncapsulation.slice(0, 10)) {
        const location = `${this.relativePath(cls.file)}:${cls.line}`;
        lines.push(`| ${cls.className} | ${location} | ${cls.mhf.toFixed(2)} | ${cls.ahf.toFixed(2)} |`);
      }
      lines.push("");
    }

    return lines;
  }

  private formatChurnHotspotsSection(metrics: ChurnHotspotMetrics): string[] {
    const lines: string[] = [];

    lines.push("## Churn Hotspots");
    lines.push("");

    if (!metrics.isGitRepo) {
      lines.push("*Not a git repository — churn analysis skipped.*");
      lines.push("");
      return lines;
    }

    lines.push("Files with high churn and complexity are maintenance risks.");
    lines.push("");

    if (metrics.hotspots.length > 0) {
      lines.push("| File | Commits | Lines Δ | Avg/Commit | Complexity | Combined |");
      lines.push("|------|---------|---------|------------|------------|----------|");

      const topHotspots = metrics.hotspots.slice(0, 10);
      for (const hotspot of topHotspots) {
        const relPath = this.relativePath(hotspot.file);
        // Find the file churn data to get detailed breakdown
        const fileChurn = metrics.files.find((f) => f.file === hotspot.file);
        const commits = fileChurn?.commits ?? 0;
        const linesChanged = fileChurn ? fileChurn.linesAdded + fileChurn.linesDeleted : 0;
        const avgPerCommit = fileChurn?.avgLinesPerCommit ?? 0;
        const avgLabel =
          avgPerCommit > 100 ? `${Math.round(avgPerCommit)} (refactor?)` : Math.round(avgPerCommit).toString();
        lines.push(
          `| ${relPath} | ${commits} | ${linesChanged} | ${avgLabel} | ${hotspot.complexityScore} | ${hotspot.combinedScore.toFixed(2)} |`,
        );
      }
      lines.push("");
      lines.push(
        "*Commits and lines changed in last 90 days. High avg/commit suggests refactors; low suggests incremental changes.*",
      );
      lines.push("");
    } else {
      lines.push("*No churn hotspots detected in the analyzed time window.*");
      lines.push("");
    }

    return lines;
  }

  generate(result: MetricsResult, options: ReportOptions): string {
    const scores = this.calculateScores(result);
    const healthScore = this.calculateHealthScore(scores);
    const issues = this.identifyIssues(result);

    const lines: string[] = [];

    // Header
    lines.push("# Codebase Health Report");
    lines.push("");
    lines.push(
      `**Analyzed:** ${options.fileCount} files${options.packageCount ? ` across ${options.packageCount} packages` : ""}`,
    );
    lines.push(`**Generated:** ${options.timestamp}`);
    lines.push("");

    // Health Score
    lines.push(`## Health: ${healthScore}/100 — ${this.getHealthLabel(healthScore)}`);
    lines.push("");
    // Show the actual calculation
    const calcParts = scores.map((s) => `${s.score}×${(s.weight * 100).toFixed(0)}%`);
    lines.push(`*Weighted average: ${calcParts.join(" + ")} = ${healthScore}*`);
    lines.push("");

    // Score table
    lines.push("| Category | Score | Status | Reason |");
    lines.push("|----------|-------|--------|--------|");
    for (const score of scores) {
      lines.push(
        `| ${score.name} | ${score.score} | ${this.getStatusEmoji(score.score)} ${this.getStatusLabel(score.score)} | ${score.reason} |`,
      );
    }
    lines.push("");

    // Issues by severity
    const criticalIssues = issues.filter((i) => i.severity === "critical");
    const warningIssues = issues.filter((i) => i.severity === "warning");

    if (criticalIssues.length > 0) {
      lines.push("---");
      lines.push("");
      lines.push("## 🔴 Critical Issues");
      lines.push("");
      for (let i = 0; i < criticalIssues.length; i++) {
        lines.push(...this.formatIssue(criticalIssues[i], i + 1));
      }
    }

    if (warningIssues.length > 0) {
      lines.push("---");
      lines.push("");
      lines.push("## 🟡 Warnings");
      lines.push("");
      const startNum = criticalIssues.length + 1;
      for (let i = 0; i < warningIssues.length; i++) {
        lines.push(...this.formatIssue(warningIssues[i], startNum + i));
      }
    }

    if (criticalIssues.length === 0 && warningIssues.length === 0) {
      lines.push("---");
      lines.push("");
      lines.push("## ✅ No Issues Found");
      lines.push("");
      lines.push("All metrics are within healthy thresholds.");
      lines.push("");
    }

    // Complexity Hotspots (only if there are hotspots not already shown in issues)
    if (result.complexity && result.complexity.hotspots.length > 0) {
      const shownInIssues = criticalIssues.filter((i) => i.category === "Complexity").length;
      const additionalHotspots = result.complexity.hotspots.slice(shownInIssues, shownInIssues + 5);

      if (additionalHotspots.length > 0 || shownInIssues > 0) {
        lines.push("---");
        lines.push("");
        lines.push("## Complexity Hotspots");
        lines.push("");
        const totalFunctions = result.complexity.functions.length;
        const hotspotsCount = result.complexity.hotspots.length;
        lines.push(
          `${hotspotsCount} of ${totalFunctions.toLocaleString()} functions exceed thresholds (CC>${COMPLEXITY_THRESHOLD_CYCLOMATIC} or Cognitive>${COMPLEXITY_THRESHOLD_COGNITIVE}):`,
        );

        // Add severity distribution
        const mild = result.complexity.hotspots.filter(
          (fn) =>
            (fn.cyclomatic > COMPLEXITY_THRESHOLD_CYCLOMATIC && fn.cyclomatic <= COMPLEXITY_THRESHOLD_CYCLOMATIC * 2) ||
            (fn.cognitive > COMPLEXITY_THRESHOLD_COGNITIVE && fn.cognitive <= COMPLEXITY_THRESHOLD_COGNITIVE * 2),
        ).length;
        const moderate = result.complexity.hotspots.filter(
          (fn) =>
            (fn.cyclomatic > COMPLEXITY_THRESHOLD_CYCLOMATIC * 2 &&
              fn.cyclomatic <= COMPLEXITY_THRESHOLD_CYCLOMATIC * 3) ||
            (fn.cognitive > COMPLEXITY_THRESHOLD_COGNITIVE * 2 && fn.cognitive <= COMPLEXITY_THRESHOLD_COGNITIVE * 3),
        ).length;
        const severe = result.complexity.hotspots.filter(
          (fn) =>
            fn.cyclomatic > COMPLEXITY_THRESHOLD_CYCLOMATIC * 3 || fn.cognitive > COMPLEXITY_THRESHOLD_COGNITIVE * 3,
        ).length;

        if (hotspotsCount > 0) {
          const ccT = COMPLEXITY_THRESHOLD_CYCLOMATIC;
          const cogT = COMPLEXITY_THRESHOLD_COGNITIVE;
          lines.push(
            `*Severity: ${mild} mild (CC ${ccT + 1}-${ccT * 2} or Cog ${cogT + 1}-${cogT * 2}), ${moderate} moderate (CC ${ccT * 2 + 1}-${ccT * 3} or Cog ${cogT * 2 + 1}-${cogT * 3}), ${severe} severe (CC >${ccT * 3} or Cog >${cogT * 3})*`,
          );
        }
        lines.push("");
        lines.push("| File | Line | Function | LOC | CC | Cognitive | Pattern |");
        lines.push("|------|------|----------|-----|-----|-----------|---------|");

        const toShow = result.complexity.hotspots.slice(0, 10);
        for (const fn of toShow) {
          const relPath = this.relativePath(fn.file);
          const loc = fn.endLine - fn.line + 1;
          const ccStatus = fn.cyclomatic > COMPLEXITY_THRESHOLD_CYCLOMATIC ? " 🔴" : "";
          const cogStatus = fn.cognitive > COMPLEXITY_THRESHOLD_COGNITIVE ? " 🔴" : "";
          const pattern = fn.complexityPattern ? this.getComplexityPatternLabel(fn.complexityPattern) : "-";
          lines.push(
            `| ${relPath} | ${fn.line} | ${fn.name} | ${loc} | ${fn.cyclomatic}${ccStatus} | ${fn.cognitive}${cogStatus} | ${pattern} |`,
          );
        }
        lines.push("");

        // Show code snippet for the worst hotspot
        const worst = toShow[0];
        if (worst?.codeSnippet) {
          lines.push("**Worst hotspot preview:**");
          lines.push("");
          lines.push("```typescript");
          lines.push(worst.codeSnippet);
          lines.push("```");
          lines.push("");
        }
      }
    }

    // Coupling Overview (only if there are issues or notable hubs)
    if (result.coupling && result.cycles) {
      const couplingScore = this.calculateCouplingScore(result.coupling, result.cycles);
      if (couplingScore < SCORE_WARNING || result.coupling.hubs.length > 0) {
        lines.push("---");
        lines.push("");
        lines.push("## Coupling Overview");
        lines.push("");
        lines.push("| Metric | Value | Assessment |");
        lines.push("|--------|-------|------------|");
        lines.push(
          `| Graph Density | ${(result.coupling.graphDensity * 100).toFixed(2)}% | ${result.coupling.graphDensity < 0.1 ? "Sparse (healthy)" : "Dense (review)"} |`,
        );
        lines.push(
          `| Circular Dependencies | ${result.cycles.count} | ${result.cycles.count === 0 ? "None ✓" : result.cycles.count === 1 ? "1 (review below)" : `${result.cycles.count} 🔴`} |`,
        );
        lines.push("");
        lines.push("*Density measures import relationships across all analyzed files.*");
        lines.push("");

        if (result.coupling.hubs.length > 0) {
          lines.push("**Hub nodes** (files with most connections):");
          lines.push("");
          lines.push("| File | Fan-In | Fan-Out | Total | Instability |");
          lines.push("|------|--------|---------|-------|-------------|");
          for (const hub of result.coupling.hubs.slice(0, 5)) {
            const relPath = this.relativePath(hub.file);
            const isBarrel = this.isBarrelFile(hub.file);
            const instability = hub.fanIn + hub.fanOut > 0 ? hub.fanOut / (hub.fanIn + hub.fanOut) : 0;
            const instabilityLabel = this.getInstabilityLabel(instability);
            const barrelNote = isBarrel ? " *(barrel)*" : "";
            const fanInFormatted = this.formatFanIn(hub);
            lines.push(
              `| ${relPath}${barrelNote} | ${fanInFormatted} | ${hub.fanOut} | ${hub.totalDegree} | ${instability.toFixed(2)} (${instabilityLabel}) |`,
            );
          }
          lines.push("");

          // Show connection details for the top hub
          const topHub = result.coupling.hubs[0];
          if (topHub && (topHub.fanInFiles?.length || topHub.fanOutFiles?.length)) {
            lines.push(`**${this.relativePath(topHub.file)} connections:**`);
            lines.push("");
            if (topHub.fanInFiles && topHub.fanInFiles.length > 0) {
              const fanInList = topHub.fanInFiles
                .slice(0, 3)
                .map((f) => `\`${this.relativePath(f)}\``)
                .join(", ");
              const more = topHub.fanIn > 3 ? ` (+${topHub.fanIn - 3} more)` : "";
              lines.push(`- **Depended on by:** ${fanInList}${more}`);
            }
            if (topHub.fanOutFiles && topHub.fanOutFiles.length > 0) {
              const fanOutList = topHub.fanOutFiles
                .slice(0, 3)
                .map((f) => `\`${this.relativePath(f)}\``)
                .join(", ");
              const more = topHub.fanOut > 3 ? ` (+${topHub.fanOut - 3} more)` : "";
              lines.push(`- **Depends on:** ${fanOutList}${more}`);
            }
            lines.push("");
          }
        }

        if (result.cycles.count > 0 && result.cycles.sccs.length > 0) {
          const isTestFixture = (file: string) =>
            file.includes("/test/fixtures/") || file.includes("/tests/fixtures/") || file.includes("/__fixtures__/");
          const typeOnlyIndices = new Set(result.cycles.typeOnlySccIndices ?? []);

          lines.push("**Circular dependencies:**");
          lines.push("");
          for (let i = 0; i < Math.min(result.cycles.sccs.length, 3); i++) {
            const scc = result.cycles.sccs[i];
            const files = scc.map((f) => `\`${this.relativePath(f)}\``).join(" → ");
            const inFixtures = scc.every((f) => isTestFixture(f));
            const isTypeOnly = typeOnlyIndices.has(i);

            let annotation = "";
            if (inFixtures) {
              annotation = " *(test fixture — likely intentional)*";
            } else if (isTypeOnly) {
              annotation = " *(type-only — no runtime impact)*";
            }
            lines.push(`- ${files}${annotation}`);
          }
          lines.push("");
        }
      }
    }

    // Duplication details (top blocks)
    if (
      result.duplication &&
      result.duplication.blocks.length > 0 &&
      result.duplication.density > DUPLICATION_THRESHOLD_PERCENT / 100
    ) {
      lines.push("---");
      lines.push("");
      lines.push("## Top Duplicate Blocks");
      lines.push("");
      const minTokens = options.minTokens ?? 100;
      const totalLines = result.duplication.totalLines;
      const duplicatedLines = result.duplication.duplicatedLines;
      const density = (result.duplication.density * 100).toFixed(1);
      lines.push(
        `*Density: ${duplicatedLines.toLocaleString()} of ${totalLines.toLocaleString()} lines duplicated (${density}%)*`,
      );
      lines.push("");
      lines.push(`Largest duplicates worth extracting (minimum ${minTokens} tokens):`);
      lines.push("");
      lines.push("| Location A | Location B | Tokens | Structure |");
      lines.push("|------------|------------|--------|-----------|");

      const topBlocks = result.duplication.blocks
        .filter((b) => b.files.length >= 2)
        .sort((a, b) => b.tokenCount - a.tokenCount)
        .slice(0, 5);

      for (const block of topBlocks) {
        let locA = `${this.relativePath(block.files[0].file)}:${block.files[0].startLine}`;
        let locB = `${this.relativePath(block.files[1].file)}:${block.files[1].startLine}`;

        // Annotate orphaned packages
        if (
          this.isInOrphanedPackage(block.files[0].file, result.monorepo?.packageLifecycles, result.monorepo?.packages)
        ) {
          locA += " *(orphaned — consider deletion)*";
        }
        if (
          this.isInOrphanedPackage(block.files[1].file, result.monorepo?.packageLifecycles, result.monorepo?.packages)
        ) {
          locB += " *(orphaned — consider deletion)*";
        }

        const structure = block.structuralUnit?.label ?? "-";
        lines.push(`| ${locA} | ${locB} | ${block.tokenCount} | ${structure} |`);
      }
      lines.push("");

      // Show code snippet for the largest duplicate
      const largest = topBlocks[0];
      if (largest?.codeSnippet) {
        lines.push("**Largest duplicate preview:**");
        lines.push("");
        lines.push("```typescript");
        lines.push(largest.codeSnippet);
        lines.push("```");
        lines.push("");
      }
    }

    // Data Flow Issues
    if (result.dataFlow) {
      const hasIssues =
        result.dataFlow.unusedParameters.length > 0 ||
        result.dataFlow.ignoredReturns.length > 0 ||
        result.dataFlow.unreadWrites.length > 0;

      if (hasIssues) {
        lines.push("---");
        lines.push("");
        lines.push("## Data Flow Issues");
        lines.push("");
        lines.push("Potential broken data flow patterns detected:");
        lines.push("");

        // Unused parameters (most actionable)
        if (result.dataFlow.unusedParameters.length > 0) {
          lines.push("### Unused Parameters");
          lines.push("");
          lines.push("Optional/default parameters that no caller ever provides:");
          lines.push("");
          lines.push("| File | Function | Parameter | Default | Total Calls | Exported |");
          lines.push("|------|----------|-----------|---------|-------------|----------|");
          for (const param of result.dataFlow.unusedParameters.slice(0, 10)) {
            const defaultVal = param.defaultValue ? `\`${param.defaultValue}\`` : "-";
            const exportedIndicator = param.isExported ? "yes" : "no";
            lines.push(
              `| ${this.relativePath(param.file)}:${param.line} | ${param.functionName} | ${param.parameterName} | ${defaultVal} | ${param.totalCallSites} | ${exportedIndicator} |`,
            );
          }
          // Show sample call sites for first few
          const withCallSites = result.dataFlow.unusedParameters
            .filter((p) => p.sampleCallSites.length > 0)
            .slice(0, 3);
          if (withCallSites.length > 0) {
            lines.push("");
            lines.push("**Sample call sites:**");
            for (const param of withCallSites) {
              const sites = param.sampleCallSites.join(", ");
              const more = param.totalCallSites > 2 ? ` (+${param.totalCallSites - 2} more)` : "";
              lines.push(`- \`${param.functionName}(${param.parameterName})\`: ${sites}${more}`);
            }
          }
          lines.push("");
        }

        // Ignored returns (actionable)
        const highConfidenceReturns = result.dataFlow.ignoredReturns.filter((r) => r.confidence === "high");
        if (highConfidenceReturns.length > 0) {
          lines.push("### Ignored Return Values");
          lines.push("");
          lines.push("Function calls whose return values are discarded:");
          lines.push("");
          lines.push("| File | Function | Return Type |");
          lines.push("|------|----------|-------------|");
          for (const ret of highConfidenceReturns.slice(0, 10)) {
            lines.push(`| ${this.relativePath(ret.file)}:${ret.line} | ${ret.functionName} | ${ret.returnType} |`);
          }
          lines.push("");
        }
      }
    }

    // Swallowed Errors
    if (result.swallowedErrors && result.swallowedErrors.summary.total > 0) {
      lines.push("---");
      lines.push("");
      lines.push("## Swallowed Errors");
      lines.push("");
      lines.push("Patterns that hide errors from callers, developers, or operators:");
      lines.push("");

      const { summary, findings } = result.swallowedErrors;

      // Summary table
      lines.push("| Pattern | Count | Description |");
      lines.push("|---------|-------|-------------|");
      if (summary.byPattern["empty-catch"] > 0) {
        lines.push(
          `| Empty catch | ${summary.byPattern["empty-catch"]} | \`catch {}\` blocks that silently discard errors |`,
        );
      }
      if (summary.byPattern["comment-only-catch"] > 0) {
        lines.push(
          `| Comment-only catch | ${summary.byPattern["comment-only-catch"]} | Catch blocks with only comments |`,
        );
      }
      if (summary.byPattern["empty-promise-catch"] > 0) {
        lines.push(
          `| Empty .catch() | ${summary.byPattern["empty-promise-catch"]} | \`.catch(() => {})\` that swallows rejections |`,
        );
      }
      if (summary.byPattern["catch-returns-success"] > 0) {
        lines.push(
          `| Catch returns success | ${summary.byPattern["catch-returns-success"]} | Catch returning \`[]\`, \`null\`, etc. |`,
        );
      }
      if (summary.byPattern["catch-log-only"] > 0) {
        lines.push(`| Catch log-only | ${summary.byPattern["catch-log-only"]} | Logs error but doesn't rethrow |`);
      }
      if (summary.byPattern["error-param-unused"] > 0) {
        lines.push(
          `| Error param unused | ${summary.byPattern["error-param-unused"]} | Error variable declared but not used |`,
        );
      }
      if (summary.byPattern["void-promise"] > 0) {
        lines.push(
          `| Fire-and-forget | ${summary.byPattern["void-promise"]} | \`void asyncOp()\` discards rejections |`,
        );
      }
      lines.push("");

      // High confidence findings
      const highConfidence = findings.filter((f) => f.confidence === "high");
      const mediumConfidence = findings.filter((f) => f.confidence === "medium");
      if (highConfidence.length > 0) {
        lines.push("### High Confidence Findings");
        lines.push("");
        const displayCount = Math.min(highConfidence.length, 10);
        lines.push(
          `*Showing ${displayCount} of ${highConfidence.length} high-confidence findings (${mediumConfidence.length} medium-confidence omitted)*`,
        );
        lines.push("");
        lines.push("| File | Line | Pattern | Context |");
        lines.push("|------|------|---------|---------|");
        for (const finding of highConfidence.slice(0, 10)) {
          const patternLabel = this.getSwallowedErrorPatternLabel(finding.pattern);
          // Show comment text for comment-only catches, otherwise show suggestion
          const context =
            finding.pattern === "comment-only-catch" && finding.commentText
              ? `"${finding.commentText.slice(0, 60)}${finding.commentText.length > 60 ? "..." : ""}"`
              : finding.suggestion.slice(0, 60);
          lines.push(`| ${this.relativePath(finding.file)} | ${finding.line} | ${patternLabel} | ${context} |`);
        }
        lines.push("");
      }

      // Medium confidence findings (show fewer)
      if (mediumConfidence.length > 0 && highConfidence.length < 10) {
        lines.push("### Medium Confidence Findings");
        lines.push("");
        lines.push("*These may be intentional — review context before fixing.*");
        lines.push("");
        lines.push("| File | Line | Pattern |");
        lines.push("|------|------|---------|");
        for (const finding of mediumConfidence.slice(0, 5)) {
          const patternLabel = this.getSwallowedErrorPatternLabel(finding.pattern);
          lines.push(`| ${this.relativePath(finding.file)} | ${finding.line} | ${patternLabel} |`);
        }
        lines.push("");
      }
    }

    // Encapsulation section (informational)
    if (result.encapsulation && result.encapsulation.classes.length > 0) {
      lines.push("---");
      lines.push("");
      lines.push(...this.formatEncapsulationSection(result.encapsulation));
    }

    // Churn Hotspots section (informational)
    if (result.churnHotspots) {
      lines.push("---");
      lines.push("");
      lines.push(...this.formatChurnHotspotsSection(result.churnHotspots));
    }

    // Recommended Actions
    const actions = this.generateActions(issues, result);
    if (actions.length > 0) {
      lines.push("---");
      lines.push("");
      lines.push("## Recommended Actions");
      lines.push("");
      for (const action of actions) {
        lines.push(`- [ ] ${action}`);
      }
      lines.push("");
    }

    // Metric Reference (collapsible)
    lines.push("---");
    lines.push("");
    lines.push("<details>");
    lines.push("<summary><strong>📖 Metric Reference</strong></summary>");
    lines.push("");
    lines.push("### Score Bands");
    lines.push("");
    lines.push("| Score | Status | Meaning |");
    lines.push("|-------|--------|---------|");
    lines.push("| 75–100 | 🟢 Healthy | Within acceptable thresholds |");
    lines.push("| 50–74 | 🟡 Review | Some issues worth addressing |");
    lines.push("| 0–49 | 🔴 Critical | Significant issues requiring attention |");
    lines.push("");
    lines.push("### Category Weights");
    lines.push("");
    lines.push("| Category | Weight | Rationale |");
    lines.push("|----------|--------|-----------|");
    lines.push("| Complexity | 35% | Primary maintainability driver; complex code is hard to modify safely |");
    lines.push("| Duplication | 25% | Increases bug surface and maintenance burden |");
    lines.push("| Coupling | 25% | Affects change propagation and testability |");
    lines.push("| Cycles | 15% | Less common but severe when present; blocks incremental refactoring |");
    lines.push("");
    lines.push("### Scoring Formulas");
    lines.push("");
    lines.push("**Complexity Score:** Based on % of functions exceeding thresholds");
    lines.push("- 0% hotspots → 100, ≤2% → 90, ≤5% → 75, ≤10% → 50, ≤20% → 25, >20% → 0");
    lines.push("");
    lines.push("**Duplication Score:** Based on duplication density");
    lines.push("- ≤2% → 100, ≤5% → 85, ≤10% → 70, ≤15% → 55, ≤20% → 40, ≤30% → 20, >30% → 0");
    lines.push("");
    lines.push("**Coupling Score:** Starts at 100, penalized for:");
    lines.push("- Each hub with >10 connections: -5 points");
    lines.push("- Each circular dependency: -15 points");
    lines.push("- Graph density >10%: -10 points");
    lines.push("");
    lines.push("**Cycles Score:** Based on cycle count");
    lines.push("- 0 cycles → 100, 1 cycle → 70, 2-3 cycles → 40, >3 cycles → 0");
    lines.push("");
    lines.push("### Complexity Thresholds");
    lines.push("");
    lines.push("| Metric | Description | Threshold |");
    lines.push("|--------|-------------|-----------|");
    lines.push(
      `| Cyclomatic (CC) | Independent paths through code. Each \`if\`, \`for\`, \`while\`, \`&&\`, \`\\|\\|\` adds 1. | ≤ ${COMPLEXITY_THRESHOLD_CYCLOMATIC} |`,
    );
    lines.push(
      `| Cognitive | Mental effort to understand. Penalizes nesting and breaks in linear flow. | ≤ ${COMPLEXITY_THRESHOLD_COGNITIVE} |`,
    );
    lines.push("");
    lines.push("*Thresholds based on SonarSource recommendations.*");
    lines.push("");
    lines.push("### Coupling & Instability");
    lines.push("");
    lines.push("| Metric | Description |");
    lines.push("|--------|-------------|");
    lines.push("| Fan-in | Files that import this module (dependents) |");
    lines.push("| Fan-out | Files this module imports (dependencies) |");
    lines.push("| Instability | `Fan-out / (Fan-in + Fan-out)` — 0 = stable, 1 = unstable |");
    lines.push("| Graph Density | `edges / (nodes × (nodes-1))` — <5% sparse, 5-10% moderate, >10% dense |");
    lines.push("");
    lines.push("**Instability interpretation:**");
    lines.push("- **0.0–0.3 (Stable):** Core types, interfaces. Many dependents, few dependencies.");
    lines.push("- **0.7–1.0 (Unstable):** Entry points, barrel files (`index.ts`). Expected for app code.");
    lines.push("- **0.3–0.7 (Balanced):** May indicate mixed responsibilities — review for SRP.");
    lines.push("");
    lines.push("### Duplication Detection");
    lines.push("");
    lines.push("Token-based detection using Rabin-Karp rolling hash with identifier normalization.");
    lines.push("");
    lines.push(`- **Minimum tokens:** ${options.minTokens ?? 100} (configurable via \`--min-tokens\`)`);
    lines.push(`- **Density threshold:** ${DUPLICATION_THRESHOLD_PERCENT}%`);
    lines.push("- **Block:** A sequence of tokens appearing in 2+ locations");
    lines.push("");
    lines.push("### Data Flow Analysis");
    lines.push("");
    lines.push("Detects broken data flow patterns:");
    lines.push("");
    lines.push("| Pattern | Description |");
    lines.push("|---------|-------------|");
    lines.push("| Unused Parameters | Optional/default params that no caller provides |");
    lines.push("| Ignored Returns | Non-void return values that are discarded |");
    lines.push("| Unread Writes | Properties written but never read (low confidence) |");
    lines.push("");
    lines.push("### Swallowed Error Detection");
    lines.push("");
    lines.push("Detects patterns that hide errors from callers, developers, or operators:");
    lines.push("");
    lines.push("| Pattern | Description | Confidence |");
    lines.push("|---------|-------------|------------|");
    lines.push("| Empty catch | `catch {}` blocks with no error handling | High |");
    lines.push("| Comment-only catch | Catch blocks with only comments | High |");
    lines.push("| Empty .catch() | `.catch(() => {})` on promises | High |");
    lines.push("| Returns success | Catch returning `[]`, `null`, `0`, etc. | Medium |");
    lines.push("| Log-only catch | Logs error but doesn't rethrow | Medium |");
    lines.push("| Error param unused | Error variable declared but never used | Medium |");
    lines.push("| Fire-and-forget | `void asyncOp()` discards rejections | Medium |");
    lines.push("");
    lines.push("**Confidence adjustments:**");
    lines.push("- Lowered in test files, finally blocks, or functions named `try*`/`maybe*`");
    lines.push("- Lowered when nearby comments contain `intentional`, `expected`, `ignore`");
    lines.push("");
    lines.push("### Notes");
    lines.push("");
    lines.push("- Cycles in `test/fixtures/` directories are typically intentional test fixtures");
    lines.push("- High instability on `index.ts` files is expected (barrel/entry point pattern)");
    lines.push("- Test files are included in analysis; use negation patterns (e.g., `!**/*.test.ts`) to filter");
    lines.push("- Data flow analysis requires ≥2 call sites for confidence");
    lines.push("");
    lines.push("</details>");
    lines.push("");

    return lines.join("\n");
  }

  private calculateScores(result: MetricsResult): CategoryScore[] {
    const scores: CategoryScore[] = [];

    if (result.complexity) {
      const { score, reason } = this.calculateComplexityScoreWithReason(result.complexity);
      scores.push({
        name: "Complexity",
        score,
        weight: 0.35,
        reason,
      });
    }

    if (result.duplication) {
      const { score, reason } = this.calculateDuplicationScoreWithReason(result.duplication);
      scores.push({
        name: "Duplication",
        score,
        weight: 0.25,
        reason,
      });
    }

    if (result.coupling) {
      const { score: couplingScore, reason: couplingReason } = this.calculateCouplingScoreWithReason(
        result.coupling,
        result.cycles,
      );
      const { score: cycleScore, reason: cycleReason } = result.cycles
        ? this.calculateCycleScoreWithReason(result.cycles)
        : { score: 100, reason: "no cycles" };
      scores.push({
        name: "Coupling",
        score: couplingScore,
        weight: 0.25,
        reason: couplingReason,
      });
      scores.push({
        name: "Cycles",
        score: cycleScore,
        weight: 0.15,
        reason: cycleReason,
      });
    }

    return scores;
  }

  private calculateHealthScore(scores: CategoryScore[]): number {
    if (scores.length === 0) return 100;

    let totalWeight = 0;
    let weightedSum = 0;

    for (const score of scores) {
      weightedSum += score.score * score.weight;
      totalWeight += score.weight;
    }

    return Math.round(weightedSum / totalWeight);
  }

  private calculateComplexityScoreWithReason(complexity: ComplexityMetrics): { score: number; reason: string } {
    if (complexity.functions.length === 0) return { score: 100, reason: "no functions" };

    const hotspotRatio = complexity.hotspots.length / complexity.functions.length;
    const percent = (hotspotRatio * 100).toFixed(1);
    const reason = `${percent}% hotspots`;

    // 0% hotspots = 100, 5% = 75, 10% = 50, 20%+ = 0
    if (hotspotRatio === 0) return { score: 100, reason: "0% hotspots" };
    if (hotspotRatio <= 0.02) return { score: 90, reason };
    if (hotspotRatio <= 0.05) return { score: 75, reason };
    if (hotspotRatio <= 0.1) return { score: 50, reason };
    if (hotspotRatio <= 0.2) return { score: 25, reason };
    return { score: 0, reason };
  }

  private calculateDuplicationScoreWithReason(duplication: DuplicationMetrics): { score: number; reason: string } {
    const density = duplication.density * 100;
    const reason = `${density.toFixed(1)}% density`;

    // 0% = 100, 5% = 85, 10% = 70, 20% = 40, 30%+ = 0
    if (density <= 2) return { score: 100, reason };
    if (density <= 5) return { score: 85, reason };
    if (density <= 10) return { score: 70, reason };
    if (density <= 15) return { score: 55, reason };
    if (density <= 20) return { score: 40, reason };
    if (density <= 30) return { score: 20, reason };
    return { score: 0, reason };
  }

  private calculateCouplingScore(coupling: CouplingMetrics, cycles?: CycleMetrics): number {
    return this.calculateCouplingScoreWithReason(coupling, cycles).score;
  }

  private calculateCouplingScoreWithReason(
    coupling: CouplingMetrics,
    cycles?: CycleMetrics,
  ): { score: number; reason: string } {
    let score = 100;
    const penalties: string[] = [];

    // Penalize for high-degree hubs
    const highDegreeHubs = coupling.hubs.filter((h) => h.totalDegree > COUPLING_HUB_THRESHOLD);
    if (highDegreeHubs.length > 0) {
      score -= highDegreeHubs.length * 5;
      penalties.push(`${highDegreeHubs.length} hub${highDegreeHubs.length > 1 ? "s" : ""}`);
    }

    // Penalize for cycles
    if (cycles && cycles.count > 0) {
      score -= cycles.count * 15;
      penalties.push(`${cycles.count} cycle${cycles.count > 1 ? "s" : ""}`);
    }

    // Penalize for high graph density
    if (coupling.graphDensity > 0.1) {
      score -= 10;
      penalties.push("high density");
    }

    const finalScore = Math.max(0, Math.min(100, score));
    const reason = penalties.length > 0 ? penalties.join(", ") : "healthy";
    return { score: finalScore, reason };
  }

  private calculateCycleScoreWithReason(cycles: CycleMetrics): { score: number; reason: string } {
    // Count only non-fixture cycles for scoring
    const isTestFixture = (file: string) =>
      file.includes("/test/fixtures/") || file.includes("/tests/fixtures/") || file.includes("/__fixtures__/");

    const productionCycles = cycles.sccs.filter((scc) => !scc.every((f) => isTestFixture(f)));
    const productionCount = productionCycles.length;

    if (productionCount === 0) {
      if (cycles.count > 0) {
        return { score: 100, reason: `${cycles.count} cycle${cycles.count > 1 ? "s" : ""} (test fixtures only)` };
      }
      return { score: 100, reason: "no cycles" };
    }
    if (productionCount === 1) return { score: 70, reason: "1 cycle" };
    if (productionCount <= 3) return { score: 40, reason: `${productionCount} cycles` };
    return { score: 0, reason: `${productionCount} cycles` };
  }

  private identifyIssues(result: MetricsResult): Issue[] {
    const issues: Issue[] = [];

    // Complexity issues
    if (result.complexity) {
      const worst = result.complexity.hotspots[0];
      if (worst && worst.cognitive > COMPLEXITY_THRESHOLD_COGNITIVE * 10) {
        issues.push({
          severity: "critical",
          category: "Complexity",
          title: `\`${this.relativePath(worst.file)}:${worst.line}\` — Cognitive complexity ${worst.cognitive}`,
          details: [
            `This function is ${Math.round(worst.cognitive / COMPLEXITY_THRESHOLD_COGNITIVE)}x over the threshold (${COMPLEXITY_THRESHOLD_COGNITIVE}).`,
            `Cyclomatic complexity: ${worst.cyclomatic} (${Math.round(worst.cyclomatic / COMPLEXITY_THRESHOLD_CYCLOMATIC)}x over threshold).`,
          ],
          recommendation:
            "Extract conditional branches into named handler functions. Consider using a strategy pattern, lookup table, or state machine to replace nested conditionals.",
        });
      } else if (worst && worst.cognitive > COMPLEXITY_THRESHOLD_COGNITIVE * 3) {
        issues.push({
          severity: "warning",
          category: "Complexity",
          title: `\`${this.relativePath(worst.file)}:${worst.line}\` — High complexity (${worst.cognitive})`,
          details: [`This function exceeds the cognitive complexity threshold of ${COMPLEXITY_THRESHOLD_COGNITIVE}.`],
          recommendation: "Consider breaking this function into smaller, focused functions.",
        });
      }
    }

    // Duplication issues
    if (result.duplication) {
      const density = result.duplication.density * 100;
      if (density > DUPLICATION_THRESHOLD_PERCENT * 2) {
        issues.push({
          severity: "critical",
          category: "Duplication",
          title: `Duplication density ${density.toFixed(1)}% (threshold: ${DUPLICATION_THRESHOLD_PERCENT}%)`,
          details: [
            `Found ${result.duplication.blocks.length.toLocaleString()} duplicate code blocks.`,
            `${result.duplication.duplicatedLines.toLocaleString()} lines are duplicated.`,
          ],
          recommendation: "Extract duplicated logic into shared utility modules. Focus on the largest blocks first.",
        });
      } else if (density > DUPLICATION_THRESHOLD_PERCENT) {
        issues.push({
          severity: "warning",
          category: "Duplication",
          title: `Duplication density ${density.toFixed(1)}% (threshold: ${DUPLICATION_THRESHOLD_PERCENT}%)`,
          details: [`Found ${result.duplication.blocks.length.toLocaleString()} duplicate code blocks.`],
          recommendation: "Review largest duplicate blocks for extraction opportunities.",
        });
      }
    }

    // Coupling issues (hub nodes)
    if (result.coupling) {
      const highHubs = result.coupling.hubs.filter((h) => h.totalDegree > COUPLING_HUB_THRESHOLD);
      for (const hub of highHubs.slice(0, 2)) {
        const instability = hub.fanIn + hub.fanOut > 0 ? hub.fanOut / (hub.fanIn + hub.fanOut) : 0;
        if (instability > 0.3 && instability < 0.7) {
          issues.push({
            severity: "warning",
            category: "Coupling",
            title: `\`${this.relativePath(hub.file)}\` — Hub node (${hub.totalDegree} connections)`,
            details: [
              `Fan-in: ${hub.fanIn} (files depending on this)`,
              `Fan-out: ${hub.fanOut} (files this depends on)`,
              `Instability: ${instability.toFixed(2)} (balanced — may indicate mixed responsibilities)`,
            ],
            recommendation:
              "Review if this module has too many responsibilities. Consider splitting into focused modules or introducing a facade pattern.",
          });
        }
      }
    }

    // Cycle issues
    if (result.cycles && result.cycles.count > 0) {
      // Check if cycles are only in test fixtures
      const isTestFixture = (file: string) =>
        file.includes("/test/fixtures/") || file.includes("/tests/fixtures/") || file.includes("/__fixtures__/");
      const allCyclesInFixtures = result.cycles.sccs.every((scc) => scc.every((f) => isTestFixture(f)));

      if (allCyclesInFixtures) {
        // Don't report test fixture cycles as issues - they're likely intentional
        // Just note it in the coupling section
      } else {
        const productionCycles = result.cycles.sccs.filter((scc) => !scc.every((f) => isTestFixture(f)));
        issues.push({
          severity: productionCycles.length > 2 ? "critical" : "warning",
          category: "Cycles",
          title: `${productionCycles.length} circular ${productionCycles.length === 1 ? "dependency" : "dependencies"} detected`,
          details: productionCycles.slice(0, 3).map((scc) => scc.map((f) => this.relativePath(f)).join(" → ")),
          recommendation:
            "Break cycles by introducing interfaces, dependency injection, or restructuring module boundaries.",
        });
      }
    }

    // Data flow issues
    if (result.dataFlow) {
      const unusedParams = result.dataFlow.unusedParameters;
      if (unusedParams.length >= 5) {
        issues.push({
          severity: unusedParams.length >= 10 ? "warning" : "warning",
          category: "Data Flow",
          title: `${unusedParams.length} unused optional parameters detected`,
          details: [
            "Parameters with default/optional values that no caller ever provides.",
            `Example: \`${unusedParams[0].functionName}(${unusedParams[0].parameterName})\` in ${this.relativePath(unusedParams[0].file)}`,
          ],
          recommendation:
            "Review if these parameters are needed. Remove unused parameters or update callers to provide values.",
        });
      }
    }

    // Swallowed error issues
    if (result.swallowedErrors) {
      const highConfidence = result.swallowedErrors.findings.filter((f) => f.confidence === "high");
      const emptyCatches =
        result.swallowedErrors.summary.byPattern["empty-catch"] +
        result.swallowedErrors.summary.byPattern["empty-promise-catch"];

      if (emptyCatches >= 5) {
        issues.push({
          severity: emptyCatches >= 10 ? "critical" : "warning",
          category: "Error Handling",
          title: `${emptyCatches} empty error handlers detected`,
          details: [
            "Empty catch blocks and .catch() handlers silently discard errors.",
            "This hides failures from callers, developers, and monitoring systems.",
          ],
          recommendation:
            "Handle errors explicitly: log them, rethrow them, or return error indicators. If intentional, add a comment explaining why.",
        });
      } else if (highConfidence.length >= 3) {
        issues.push({
          severity: "warning",
          category: "Error Handling",
          title: `${highConfidence.length} swallowed error patterns detected`,
          details: [
            "Code patterns that hide errors from callers or operators.",
            `Example: ${this.getSwallowedErrorPatternLabel(highConfidence[0].pattern)} at ${this.relativePath(highConfidence[0].file)}:${highConfidence[0].line}`,
          ],
          recommendation: "Review swallowed error patterns and add proper error handling or propagation.",
        });
      }
    }

    // Orphaned package issues
    if (result.monorepo?.packageLifecycles) {
      const orphanedPackages: string[] = [];
      for (const [pkgName, lifecycle] of result.monorepo.packageLifecycles.entries()) {
        if (lifecycle.state === "orphaned") {
          orphanedPackages.push(pkgName);
        }
      }

      if (orphanedPackages.length > 0) {
        issues.push({
          severity: "warning",
          category: "Monorepo",
          title: `${orphanedPackages.length} orphaned ${orphanedPackages.length === 1 ? "package" : "packages"} detected`,
          details: [
            "Private packages with no consumers in the monorepo.",
            `Orphaned packages: ${orphanedPackages.join(", ")}`,
          ],
          recommendation: "Review these packages — consider deletion if they are no longer needed.",
        });
      }
    }

    return issues;
  }

  private formatIssue(issue: Issue, num: number): string[] {
    const lines: string[] = [];
    lines.push(`**${num}. ${issue.title}**`);
    lines.push("");
    for (const detail of issue.details) {
      lines.push(detail);
    }
    lines.push("");
    lines.push(`**Recommended fix:** ${issue.recommendation}`);
    lines.push("");
    return lines;
  }

  private generateActions(issues: Issue[], _result: MetricsResult): string[] {
    const actions: string[] = [];

    for (const issue of issues) {
      if (issue.category === "Complexity" && issue.severity === "critical") {
        const match = issue.title.match(/`([^`]+)`/);
        if (match) {
          actions.push(`Refactor ${match[1]} — reduce complexity`);
        }
      } else if (issue.category === "Duplication") {
        actions.push("Extract duplicate code into shared modules");
      } else if (issue.category === "Coupling") {
        const match = issue.title.match(/`([^`]+)`/);
        if (match) {
          actions.push(`Review ${match[1]} — consider splitting responsibilities`);
        }
      } else if (issue.category === "Cycles") {
        actions.push("Break circular dependencies");
      } else if (issue.category === "Data Flow") {
        actions.push("Review unused parameters — remove or wire up callers");
      } else if (issue.category === "Error Handling") {
        actions.push("Fix swallowed errors — add logging, rethrow, or document intentional handling");
      }
    }

    // Add preventive action if there are any issues
    if (issues.length > 0) {
      actions.push("Add pre-commit complexity checks to prevent new hotspots");
    }

    return [...new Set(actions)]; // Deduplicate
  }

  private relativePath(filePath: string): string {
    return path.relative(this.rootDir, filePath);
  }

  private getHealthLabel(score: number): string {
    if (score >= SCORE_WARNING) return "Good";
    if (score >= SCORE_CRITICAL) return "Needs Improvement";
    return "Critical";
  }

  private getStatusEmoji(score: number): string {
    if (score >= SCORE_WARNING) return "🟢";
    if (score >= SCORE_CRITICAL) return "🟡";
    return "🔴";
  }

  private getStatusLabel(score: number): string {
    if (score >= SCORE_WARNING) return "Healthy";
    if (score >= SCORE_CRITICAL) return "Review";
    return "Critical";
  }

  private getInstabilityLabel(instability: number): string {
    if (instability <= 0.3) return "stable";
    if (instability >= 0.7) return "unstable";
    return "balanced";
  }

  private isBarrelFile(filePath: string): boolean {
    const basename = path.basename(filePath);
    return basename === "index.ts" || basename === "index.tsx" || basename === "index.js" || basename === "index.mjs";
  }

  private isInOrphanedPackage(
    filePath: string,
    packageLifecycles?: Map<string, import("../types.js").PackageLifecycle>,
    packages?: import("../types.js").WorkspacePackage[],
  ): boolean {
    if (!packageLifecycles || !packages) {
      return false;
    }

    // Find which package this file belongs to
    for (const pkg of packages) {
      if (filePath.startsWith(pkg.dir)) {
        const lifecycle = packageLifecycles.get(pkg.name);
        return lifecycle?.state === "orphaned";
      }
    }

    return false;
  }

  private getSwallowedErrorPatternLabel(pattern: string): string {
    const labels: Record<string, string> = {
      "empty-catch": "Empty catch",
      "comment-only-catch": "Comment-only catch",
      "catch-returns-success": "Returns success",
      "catch-log-only": "Log-only catch",
      "void-promise": "Fire-and-forget",
      "empty-promise-catch": "Empty .catch()",
      "error-param-unused": "Error unused",
    };
    return labels[pattern] ?? pattern;
  }

  private getComplexityPatternLabel(pattern: string): string {
    const labels: Record<string, string> = {
      "nested-conditionals": "Nested ifs",
      "many-branches": "Many branches",
      "switch-heavy": "Large switch",
      "loop-heavy": "Many loops",
      mixed: "Mixed",
      unknown: "-",
    };
    return labels[pattern] ?? pattern;
  }

  private formatFanIn(hub: HubNode): string {
    // Backward compatibility: if new fields are undefined, just return fanIn
    if (hub.productionFanIn === undefined && hub.testFanIn === undefined) {
      return hub.fanIn.toString();
    }

    const prodFanIn = hub.productionFanIn ?? 0;
    const testFanIn = hub.testFanIn ?? 0;

    // All test dependencies
    if (prodFanIn === 0 && testFanIn > 0) {
      return `${hub.fanIn} (all tests)`;
    }

    // Mixed production and test
    if (prodFanIn > 0 && testFanIn > 0) {
      return `${prodFanIn} prod / ${testFanIn} test`;
    }

    // All production (or no dependencies at all)
    return hub.fanIn.toString();
  }
}
