export abstract class BaseComponent {
  protected name: string;

  constructor(name: string) {
    this.name = name;
  }

  abstract render(): void;

  getName(): string {
    return this.name;
  }
}

export class Button extends BaseComponent {
  private label: string;

  constructor(label: string) {
    super("button");
    this.label = label;
  }

  render(): void {
    console.log(`<button>${this.label}</button>`);
  }

  onClick(callback: () => void): void {
    callback();
  }
}
