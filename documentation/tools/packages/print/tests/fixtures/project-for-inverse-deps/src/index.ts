import { Button } from './components/Button';
import { createLogger } from './lib/logger';
import { formatDate } from './utils/formatter';

const logger = createLogger('main');

export function main() {
  logger.log('Starting application');
  const now = formatDate(new Date());
  console.log(`Application started at ${now}`);

  const button = new Button('Click me');
  button.render();
}
