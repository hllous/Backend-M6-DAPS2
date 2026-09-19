import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('devuelve ok con el nombre del servicio', () => {
    const controller = new HealthController();
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('m6-ambiente-backend');
    expect(typeof result.timestamp).toBe('string');
  });
});
