// Test fixture for EncapsulationAnalyzer
// Demonstrates various encapsulation patterns for metrics calculation

/**
 * PublicClass - All public members (poor encapsulation)
 * MHF: 0 (0/3 hidden methods), AHF: 0 (0/2 hidden attributes)
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
 * WellEncapsulatedClass - Demonstrates private attributes
 * MHF: 0 (0/1 hidden methods), AHF: 0.5 (1/2 hidden attributes)
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
 * MHF: 0.67 (2/3 hidden methods), AHF: 1.0 (1/1 hidden attributes)
 */
export class ProtectedClass {
  protected _internalState: string = "";

  public execute(): void {}

  protected initialize(): void {}

  protected reset(): void {}
}

/**
 * ModernPrivateClass - Uses TypeScript # private fields
 * MHF: 0 (0/2 hidden methods), AHF: 1.0 (1/1 hidden attributes)
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
 * MixedVisibilityClass - Mix of visibility modifiers
 * MHF: 0.5 (1/2 hidden methods), AHF: 0 (0/1 hidden attributes)
 */
export class MixedVisibilityClass {
  public publicProp: string = "";

  public publicMethod(): void {}
  protected protectedMethod(): void {}
}

/**
 * EmptyClass - Edge case with no methods/properties
 * MHF: 1.0, AHF: 1.0 (convention for empty classes)
 */
export class EmptyClass {}
