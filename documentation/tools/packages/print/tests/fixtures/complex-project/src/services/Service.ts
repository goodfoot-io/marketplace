import { config } from '../utils/config';

export class Service {
  initialize() {
    console.log('Service initialized with config:', config.getAll());
  }

  process(data: unknown) {
    return { processed: true, data };
  }
}
