import { App } from './components/App';
import { logger } from './utils/logger';

export function main() {
  logger.info('Starting application');
  const app = new App();
  app.start();
}

if (require.main === module) {
  main();
}
