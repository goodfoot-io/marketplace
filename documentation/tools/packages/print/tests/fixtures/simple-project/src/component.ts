import { hello } from '../file1';

export class Component {
  constructor() {
    hello();
  }

  render() {
    return '<div>Component</div>';
  }
}
