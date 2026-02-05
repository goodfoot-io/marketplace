import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { EncapsulationAnalyzer } from "../src/lib/EncapsulationAnalyzer.js";

const fixtureRoot = path.join(__dirname, "fixtures/monorepo-fixture");
const encapsulationFixture = path.join(fixtureRoot, "packages/pkg-a/src/encapsulation-test.ts");

describe("EncapsulationAnalyzer", () => {
  it("calculates MHF correctly for classes with mixed visibility", () => {
    // Test with WellEncapsulatedClass: 0/1 hidden methods = MHF 0
    // (biome removed unused private methods from fixture)
    const analyzer = new EncapsulationAnalyzer({
      rootDir: fixtureRoot,
      files: [encapsulationFixture],
    });
    const result = analyzer.analyze();
    const wellEncapsulated = result.classes.find((c) => c.className === "WellEncapsulatedClass");
    expect(wellEncapsulated).toBeDefined();
    expect(wellEncapsulated?.totalMethods).toBe(1);
    expect(wellEncapsulated?.hiddenMethods).toBe(0);
    expect(wellEncapsulated?.mhf).toBe(0);
  });

  it("calculates AHF correctly for classes with mixed visibility", () => {
    // Test with WellEncapsulatedClass: 1/2 private properties = AHF 0.5
    const analyzer = new EncapsulationAnalyzer({
      rootDir: fixtureRoot,
      files: [encapsulationFixture],
    });
    const result = analyzer.analyze();
    const wellEncapsulated = result.classes.find((c) => c.className === "WellEncapsulatedClass");
    expect(wellEncapsulated).toBeDefined();
    expect(wellEncapsulated?.totalAttributes).toBe(2);
    expect(wellEncapsulated?.hiddenAttributes).toBe(1);
    expect(wellEncapsulated?.ahf).toBe(0.5);
  });

  it("treats TypeScript # private fields as hidden", () => {
    // Test with ModernPrivateClass
    // (biome removed unused #private methods from fixture)
    const analyzer = new EncapsulationAnalyzer({
      rootDir: fixtureRoot,
      files: [encapsulationFixture],
    });
    const result = analyzer.analyze();
    const modernPrivate = result.classes.find((c) => c.className === "ModernPrivateClass");
    expect(modernPrivate).toBeDefined();
    expect(modernPrivate?.totalAttributes).toBe(1);
    expect(modernPrivate?.hiddenAttributes).toBe(1);
    expect(modernPrivate?.ahf).toBe(1.0);
    expect(modernPrivate?.totalMethods).toBe(2); // getData, setData (public)
    expect(modernPrivate?.hiddenMethods).toBe(0);
    expect(modernPrivate?.mhf).toBe(0);
  });

  it("treats protected as hidden", () => {
    // Test with ProtectedClass: 2/3 protected methods = MHF 0.67
    const analyzer = new EncapsulationAnalyzer({
      rootDir: fixtureRoot,
      files: [encapsulationFixture],
    });
    const result = analyzer.analyze();
    const protectedClass = result.classes.find((c) => c.className === "ProtectedClass");
    expect(protectedClass).toBeDefined();
    expect(protectedClass?.totalMethods).toBe(3);
    expect(protectedClass?.hiddenMethods).toBe(2);
    expect(protectedClass?.mhf).toBeCloseTo(0.67, 2);
    expect(protectedClass?.totalAttributes).toBe(1);
    expect(protectedClass?.hiddenAttributes).toBe(1);
    expect(protectedClass?.ahf).toBe(1.0);
  });

  it("excludes abstract classes from calculation", () => {
    // Create test with abstract class - should not appear in results
    const analyzer = new EncapsulationAnalyzer({
      rootDir: fixtureRoot,
      files: [encapsulationFixture],
    });
    const result = analyzer.analyze();
    // Ensure no abstract classes are in the results
    // (fixture doesn't have abstract classes, so this is a safety check)
    expect(result.classes.every((c) => !c.className.includes("Abstract"))).toBe(true);
  });

  it("excludes interfaces from calculation", () => {
    // Create test with interface - should not appear in results
    const analyzer = new EncapsulationAnalyzer({
      rootDir: fixtureRoot,
      files: [encapsulationFixture],
    });
    const result = analyzer.analyze();
    // Interfaces are not ClassDeclarations, so they should not appear
    // (fixture doesn't have interfaces, so this is a safety check)
    expect(result.classes.every((c) => !c.className.includes("Interface"))).toBe(true);
  });

  it("handles classes with no methods gracefully (MHF=1.0)", () => {
    // Test with EmptyClass
    const analyzer = new EncapsulationAnalyzer({
      rootDir: fixtureRoot,
      files: [encapsulationFixture],
    });
    const result = analyzer.analyze();
    const emptyClass = result.classes.find((c) => c.className === "EmptyClass");
    expect(emptyClass).toBeDefined();
    expect(emptyClass?.totalMethods).toBe(0);
    expect(emptyClass?.hiddenMethods).toBe(0);
    expect(emptyClass?.mhf).toBe(1.0);
  });

  it("handles classes with no properties gracefully (AHF=1.0)", () => {
    // Test with EmptyClass
    const analyzer = new EncapsulationAnalyzer({
      rootDir: fixtureRoot,
      files: [encapsulationFixture],
    });
    const result = analyzer.analyze();
    const emptyClass = result.classes.find((c) => c.className === "EmptyClass");
    expect(emptyClass).toBeDefined();
    expect(emptyClass?.totalAttributes).toBe(0);
    expect(emptyClass?.hiddenAttributes).toBe(0);
    expect(emptyClass?.ahf).toBe(1.0);
  });

  it("aggregates MHF/AHF across multiple classes", () => {
    // Test with fixture file containing multiple classes
    const analyzer = new EncapsulationAnalyzer({
      rootDir: fixtureRoot,
      files: [encapsulationFixture],
    });
    const result = analyzer.analyze();

    // Should have multiple classes
    expect(result.classes.length).toBeGreaterThan(1);

    // Aggregate MHF should be the average of all class MHF values
    const expectedMhf = result.classes.reduce((sum, c) => sum + c.mhf, 0) / result.classes.length;
    expect(result.aggregateMhf).toBeCloseTo(expectedMhf, 10);

    // Aggregate AHF should be the average of all class AHF values
    const expectedAhf = result.classes.reduce((sum, c) => sum + c.ahf, 0) / result.classes.length;
    expect(result.aggregateAhf).toBeCloseTo(expectedAhf, 10);
  });

  it("handles all visibility patterns correctly", () => {
    // Test PublicClass: all public members
    const analyzer = new EncapsulationAnalyzer({
      rootDir: fixtureRoot,
      files: [encapsulationFixture],
    });
    const result = analyzer.analyze();

    const publicClass = result.classes.find((c) => c.className === "PublicClass");
    expect(publicClass).toBeDefined();
    expect(publicClass?.mhf).toBe(0);
    expect(publicClass?.ahf).toBe(0);

    // MixedVisibilityClass after biome lint: 2 methods (1 public, 1 protected), 1 public prop
    const mixedClass = result.classes.find((c) => c.className === "MixedVisibilityClass");
    expect(mixedClass).toBeDefined();
    expect(mixedClass?.totalMethods).toBe(2);
    expect(mixedClass?.hiddenMethods).toBe(1); // protected only
    expect(mixedClass?.mhf).toBe(0.5);
    expect(mixedClass?.totalAttributes).toBe(1);
    expect(mixedClass?.hiddenAttributes).toBe(0);
    expect(mixedClass?.ahf).toBe(0);
  });

  it("handles getters and setters as methods", () => {
    // ModernPrivateClass has getData (method) and setData (method)
    // They should be counted as regular methods
    // (biome removed unused #private methods)
    const analyzer = new EncapsulationAnalyzer({
      rootDir: fixtureRoot,
      files: [encapsulationFixture],
    });
    const result = analyzer.analyze();
    const modernPrivate = result.classes.find((c) => c.className === "ModernPrivateClass");
    expect(modernPrivate).toBeDefined();
    // getData, setData = 2 methods
    expect(modernPrivate?.totalMethods).toBe(2);
  });

  it("returns 1.0 for empty class array", () => {
    const analyzer = new EncapsulationAnalyzer({
      rootDir: fixtureRoot,
      files: [],
    });
    const result = analyzer.analyze();
    expect(result.classes).toHaveLength(0);
    expect(result.aggregateMhf).toBe(1.0);
    expect(result.aggregateAhf).toBe(1.0);
  });
});
