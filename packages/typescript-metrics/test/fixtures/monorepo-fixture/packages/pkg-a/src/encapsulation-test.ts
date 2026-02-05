// Test fixture for EncapsulationAnalyzer
// Demonstrates various encapsulation patterns for metrics calculation

/**
 * PublicClass - All public members (poor encapsulation)
 * Expected MHF: 0 (0/3), AHF: 0 (0/2)
 */
export class PublicClass {
  public prop1: string = "";
  public prop2: number = 0;

  public method1(): void {}
  public method2(): string {
    return "";
  }
  public method3(): number {
    return 0;
  }
}

/**
 * WellEncapsulatedClass - Good encapsulation
 * Expected MHF: 0.75 (3/4), AHF: 0.75 (3/4)
 */
export class WellEncapsulatedClass {
  public visibleProp: string = "";
  private _data: string[] = [];

  public getData(): string[] {
    return this._data;
  }
}

/**
 * ProtectedClass - Uses protected members
 * Expected MHF: 0.67 (2/3), AHF: 1.0 (1/1)
 */
export class ProtectedClass {
  protected _internalState: string = "";

  public execute(): void {}

  protected initialize(): void {}

  protected reset(): void {}
}

/**
 * ModernPrivateClass - Uses TypeScript # private fields
 * Expected MHF: 0.5 (2/4), AHF: 1.0 (1/1)
 */
export class ModernPrivateClass {
  #privateData: string = "";

  public getData(): string {
    return this.#privateData;
  }

  public setData(value: string): void {
    this.#privateData = value;
  }
}

/**
 * MixedVisibilityClass - Mix of all visibility modifiers
 * Expected MHF: 0.67 (2/3), AHF: 0.67 (2/3)
 */
export class MixedVisibilityClass {
  public publicProp: string = "";

  public publicMethod(): void {}
  protected protectedMethod(): void {}
}

/**
 * EmptyClass - Edge case with no methods/properties
 * Expected MHF: 1.0, AHF: 1.0 (convention for empty)
 */
export class EmptyClass {}
