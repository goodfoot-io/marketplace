import { Service } from '../services/Service';
import { logger } from '../utils/logger';

export class App {
  private service: Service;

  constructor() {
    this.service = new Service();
  }

  start() {
    logger.info('App started');
    this.service.initialize();
  }
}
