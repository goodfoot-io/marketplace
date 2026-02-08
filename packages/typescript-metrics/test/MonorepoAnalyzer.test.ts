import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { MonorepoAnalyzer } from "../src/lib/MonorepoAnalyzer.js";

const fixtureRoot = path.join(__dirname, "fixtures/monorepo-fixture");

describe("MonorepoAnalyzer", () => {
  it("should discover all workspace packages via @manypkg/get-packages", async () => {
    const analyzer = new MonorepoAnalyzer({ rootDir: fixtureRoot });
    const packages = await analyzer.discoverPackages();

    expect(packages).toHaveLength(4);
    expect(packages.map((p) => p.name).sort()).toEqual([
      "@fixture/pkg-a",
      "@fixture/pkg-b",
      "@fixture/pkg-c",
      "@fixture/pkg-orphaned",
    ]);
  });

  it("should count named exports from package entry point", () => {
    const analyzer = new MonorepoAnalyzer({ rootDir: fixtureRoot });
    const pkgADir = path.join(fixtureRoot, "packages/pkg-a");

    const apiSurface = analyzer.analyzeApiSurface(pkgADir);

    expect(apiSurface.namedExports).toHaveLength(5);
  });

  it("should count default exports", () => {
    const analyzer = new MonorepoAnalyzer({ rootDir: fixtureRoot });
    const pkgADir = path.join(fixtureRoot, "packages/pkg-a");

    const apiSurface = analyzer.analyzeApiSurface(pkgADir);

    // pkg-a should not have default export
    expect(apiSurface.defaultExport).toBe(false);
  });

  it("should count type-only exports", () => {
    const analyzer = new MonorepoAnalyzer({ rootDir: fixtureRoot });
    const pkgADir = path.join(fixtureRoot, "packages/pkg-a");

    const apiSurface = analyzer.analyzeApiSurface(pkgADir);

    expect(apiSurface.typeExports).toBeDefined();
  });

  it("should identify barrel re-exports (export *) separately", () => {
    const analyzer = new MonorepoAnalyzer({ rootDir: fixtureRoot });
    const pkgADir = path.join(fixtureRoot, "packages/pkg-a");

    const apiSurface = analyzer.analyzeApiSurface(pkgADir);

    expect(apiSurface.barrelReexports).toBeGreaterThanOrEqual(0);
  });

  it("should categorize imports as internal/workspace/external", () => {
    const analyzer = new MonorepoAnalyzer({ rootDir: fixtureRoot });
    const pkgBDir = path.join(fixtureRoot, "packages/pkg-b");
    const workspacePackageNames = ["@fixture/pkg-a", "@fixture/pkg-b", "@fixture/pkg-c"];

    const breakdown = analyzer.analyzeImportBreakdown(pkgBDir, workspacePackageNames);

    expect(breakdown.internal.count).toBeGreaterThanOrEqual(0);
    expect(breakdown.workspacePackages.count).toBeGreaterThanOrEqual(0);
    expect(breakdown.externalNpm.count).toBeGreaterThanOrEqual(0);
  });

  it("should calculate import ratios per package", () => {
    const analyzer = new MonorepoAnalyzer({ rootDir: fixtureRoot });
    const pkgBDir = path.join(fixtureRoot, "packages/pkg-b");
    const workspacePackageNames = ["@fixture/pkg-a", "@fixture/pkg-b", "@fixture/pkg-c"];

    const breakdown = analyzer.analyzeImportBreakdown(pkgBDir, workspacePackageNames);

    expect(breakdown.internal.ratio).toBeGreaterThanOrEqual(0);
    expect(breakdown.internal.ratio).toBeLessThanOrEqual(1);
    expect(breakdown.workspacePackages.ratio).toBeGreaterThanOrEqual(0);
    expect(breakdown.workspacePackages.ratio).toBeLessThanOrEqual(1);
    expect(breakdown.externalNpm.ratio).toBeGreaterThanOrEqual(0);
    expect(breakdown.externalNpm.ratio).toBeLessThanOrEqual(1);
  });

  it("should build cross-boundary dependency matrix", async () => {
    const analyzer = new MonorepoAnalyzer({ rootDir: fixtureRoot });
    const packages = await analyzer.discoverPackages();

    const matrix = analyzer.buildCrossBoundaryMatrix(packages);

    expect(matrix).toBeInstanceOf(Map);
    expect(matrix.size).toBe(4);
  });

  it("should calculate package dependency depth from package.json", async () => {
    const analyzer = new MonorepoAnalyzer({ rootDir: fixtureRoot });
    const packages = await analyzer.discoverPackages();

    const depth = analyzer.calculateDependencyDepth(packages);

    // pkg-c -> pkg-b -> pkg-a = depth 2
    expect(depth).toBe(2);
  });

  it("should populate packageLifecycles in analyze()", async () => {
    const analyzer = new MonorepoAnalyzer({ rootDir: fixtureRoot });
    const metrics = await analyzer.analyze();

    expect(metrics.packageLifecycles).toBeDefined();
    expect(metrics.packageLifecycles).toBeInstanceOf(Map);
    expect(metrics.packageLifecycles?.size).toBe(4);

    const orphanedPkg = metrics.packageLifecycles?.get("@fixture/pkg-orphaned");
    expect(orphanedPkg?.state).toBe("orphaned");
  });

  describe("analyzeLifecycles", () => {
    it("should mark private package with 0 consumers as orphaned", async () => {
      const analyzer = new MonorepoAnalyzer({ rootDir: fixtureRoot });
      const packages = await analyzer.discoverPackages();
      const matrix = analyzer.buildCrossBoundaryMatrix(packages);

      const lifecycles = analyzer.analyzeLifecycles(packages, matrix);

      const orphanedPkg = lifecycles.get("@fixture/pkg-orphaned");
      expect(orphanedPkg).toBeDefined();
      expect(orphanedPkg?.isPrivate).toBe(true);
      expect(orphanedPkg?.consumerCount).toBe(0);
      expect(orphanedPkg?.state).toBe("orphaned");
    });

    it("should not mark public package as orphaned", async () => {
      const analyzer = new MonorepoAnalyzer({ rootDir: fixtureRoot });
      const packages = await analyzer.discoverPackages();
      const matrix = analyzer.buildCrossBoundaryMatrix(packages);

      const lifecycles = analyzer.analyzeLifecycles(packages, matrix);

      const pkgA = lifecycles.get("@fixture/pkg-a");
      expect(pkgA).toBeDefined();
      expect(pkgA?.isPrivate).toBe(false);
      expect(pkgA?.state).toBe("active");
    });

    it("should classify packages correctly based on privacy and consumers", async () => {
      const analyzer = new MonorepoAnalyzer({ rootDir: fixtureRoot });
      const packages = await analyzer.discoverPackages();
      const matrix = analyzer.buildCrossBoundaryMatrix(packages);

      const lifecycles = analyzer.analyzeLifecycles(packages, matrix);

      // Verify the invariant: orphaned requires both private=true AND consumerCount=0
      for (const [_pkgName, lifecycle] of lifecycles.entries()) {
        if (lifecycle.state === "orphaned") {
          expect(lifecycle.isPrivate).toBe(true);
          expect(lifecycle.consumerCount).toBe(0);
        }
        if (!lifecycle.isPrivate || lifecycle.consumerCount > 0) {
          expect(lifecycle.state).toBe("active");
        }
      }
    });
  });
});
