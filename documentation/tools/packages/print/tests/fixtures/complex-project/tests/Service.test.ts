import { Service } from '../src/services/Service';

describe('Service', () => {
  it('should process data', () => {
    const service = new Service();
    const result = service.process({ test: 'data' });
    expect(result).toEqual({
      processed: true,
      data: { test: 'data' }
    });
  });
});
