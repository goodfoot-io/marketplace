export abstract class ComponentBase {
  constructor(protected type: string) {}

  abstract render(): void;

  getType() {
    return this.type;
  }
}
