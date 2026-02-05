import { execSync } from "node:child_process";
import * as path from "node:path";
import type { ChurnHotspotMetrics, ChurnHotspotOptions, FileChurn, Hotspot } from "../types.js";

export class ChurnHotspotAnalyzer {
  private options: ChurnHotspotOptions;

  constructor(options: ChurnHotspotOptions) {
    this.options = options;
  }

  analyze(files?: string[]): ChurnHotspotMetrics {
    const filesToAnalyze = files ?? this.options.files;

    // 1. Check if directory is a git repo
    if (!this.isGitRepo()) {
      return { files: [], hotspots: [], isGitRepo: false };
    }

    // 2. Get churn data from git log
    const churnData = this.getChurnData(filesToAnalyze);

    // 3. If complexityMetrics provided, calculate combined hotspots
    const hotspots = this.calculateHotspots(churnData);

    return {
      files: churnData,
      hotspots,
      isGitRepo: true,
    };
  }

  private isGitRepo(): boolean {
    try {
      execSync("git rev-parse --git-dir", {
        cwd: this.options.rootDir,
        stdio: "pipe",
      });
      return true;
    } catch {
      return false;
    }
  }

  private getChurnData(files: string[]): FileChurn[] {
    const timeWindowDays = this.options.timeWindowDays ?? 90;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - timeWindowDays);
    const since = sinceDate.toISOString().split("T")[0];

    try {
      // Get all commits with numstat
      const gitOutput = execSync(`git log --numstat --since=${since} --max-count=1000 --format="%H"`, {
        cwd: this.options.rootDir,
        encoding: "utf-8",
        stdio: "pipe",
      });

      // Parse git output to build file churn map
      const fileChurnMap = new Map<string, { commits: Set<string>; linesAdded: number; linesDeleted: number }>();

      const lines = gitOutput.split("\n");
      let currentCommit = "";

      for (const line of lines) {
        const trimmed = line.trim();

        // Empty line separates commits
        if (trimmed === "") {
          continue;
        }

        // Commit hash lines (40 hex chars)
        if (/^[0-9a-f]{40}$/.test(trimmed)) {
          currentCommit = trimmed;
          continue;
        }

        // numstat line: additions\tdeletions\tfilename
        const parts = trimmed.split("\t");
        if (parts.length === 3) {
          const additions = parts[0];
          const deletions = parts[1];
          const filename = parts[2];

          // Binary files show as "-"
          if (additions === "-" || deletions === "-") {
            continue;
          }

          // Convert relative git path to absolute path
          const absolutePath = path.resolve(this.options.rootDir, filename);

          // Get or initialize churn data for this file
          let churnData = fileChurnMap.get(absolutePath);
          if (!churnData) {
            churnData = {
              commits: new Set(),
              linesAdded: 0,
              linesDeleted: 0,
            };
            fileChurnMap.set(absolutePath, churnData);
          }

          churnData.commits.add(currentCommit);
          churnData.linesAdded += Number.parseInt(additions, 10);
          churnData.linesDeleted += Number.parseInt(deletions, 10);
        }
      }

      // Build FileChurn array for requested files
      const result: FileChurn[] = [];

      for (const file of files) {
        const absolutePath = path.resolve(file);
        const churnData = fileChurnMap.get(absolutePath);

        if (churnData) {
          const commits = churnData.commits.size;
          const linesAdded = churnData.linesAdded;
          const linesDeleted = churnData.linesDeleted;
          const churnScore = commits + linesAdded + linesDeleted;

          result.push({
            file: absolutePath,
            commits,
            linesAdded,
            linesDeleted,
            churnScore,
          });
        } else {
          // File not in git history or no changes in time window
          result.push({
            file: absolutePath,
            commits: 0,
            linesAdded: 0,
            linesDeleted: 0,
            churnScore: 0,
          });
        }
      }

      return result;
    } catch (error) {
      // Git command failed - return empty churn for all files
      console.warn("Git log command failed:", error);
      return files.map((file) => ({
        file: path.resolve(file),
        commits: 0,
        linesAdded: 0,
        linesDeleted: 0,
        churnScore: 0,
      }));
    }
  }

  private calculateHotspots(churnData: FileChurn[]): Hotspot[] {
    const complexityMetrics = this.options.complexityMetrics;

    // If no complexity metrics provided, return hotspots based on churn alone
    if (!complexityMetrics) {
      return churnData
        .filter((fc) => fc.churnScore > 0)
        .map((fc) => ({
          file: fc.file,
          churnScore: fc.churnScore,
          complexityScore: 0,
          combinedScore: fc.churnScore,
        }))
        .sort((a, b) => b.combinedScore - a.combinedScore);
    }

    // Build a map of file to max complexity
    const fileComplexityMap = new Map<string, { cyclomatic: number; cognitive: number }>();

    for (const fileComplexity of complexityMetrics.files) {
      const absPath = path.resolve(fileComplexity.file);
      let maxCyclomatic = 0;
      let maxCognitive = 0;

      for (const fn of fileComplexity.functions) {
        maxCyclomatic = Math.max(maxCyclomatic, fn.cyclomatic);
        maxCognitive = Math.max(maxCognitive, fn.cognitive);
      }

      fileComplexityMap.set(absPath, {
        cyclomatic: maxCyclomatic,
        cognitive: maxCognitive,
      });
    }

    // Collect churn scores and complexity scores for normalization
    const churnScores: number[] = [];
    const complexityScores: number[] = [];

    for (const fc of churnData) {
      const absPath = path.resolve(fc.file);
      const complexity = fileComplexityMap.get(absPath);

      if (fc.churnScore > 0 || complexity) {
        churnScores.push(fc.churnScore);
        // Use max of cyclomatic and cognitive as complexity score
        const complexityScore = complexity ? Math.max(complexity.cyclomatic, complexity.cognitive) : 0;
        complexityScores.push(complexityScore);
      }
    }

    // Normalize scores
    const normalizedChurn = this.normalize(churnScores);
    const normalizedComplexity = this.normalize(complexityScores);

    // Build hotspots with combined scores
    const hotspots: Hotspot[] = [];
    let index = 0;

    for (const fc of churnData) {
      const absPath = path.resolve(fc.file);
      const complexity = fileComplexityMap.get(absPath);

      if (fc.churnScore > 0 || complexity) {
        const complexityScore = complexity ? Math.max(complexity.cyclomatic, complexity.cognitive) : 0;
        const normalizedChurnScore = normalizedChurn.get(index) ?? 0;
        const normalizedComplexityScore = normalizedComplexity.get(index) ?? 0;

        // Combined score is product of normalized values
        const combinedScore = normalizedChurnScore * normalizedComplexityScore;

        hotspots.push({
          file: fc.file,
          churnScore: fc.churnScore,
          complexityScore,
          combinedScore,
          cyclomatic: complexity?.cyclomatic,
          cognitive: complexity?.cognitive,
        });

        index++;
      }
    }

    // Sort by combined score descending
    return hotspots.sort((a, b) => b.combinedScore - a.combinedScore);
  }

  private normalize(values: number[]): Map<number, number> {
    const result = new Map<number, number>();

    if (values.length === 0) {
      return result;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    // Handle edge case where all values are the same
    if (max === min) {
      for (let i = 0; i < values.length; i++) {
        result.set(i, values[i] > 0 ? 1 : 0);
      }
      return result;
    }

    // Min-max normalization: (value - min) / (max - min)
    for (let i = 0; i < values.length; i++) {
      const normalized = (values[i] - min) / (max - min);
      result.set(i, normalized);
    }

    return result;
  }
}
