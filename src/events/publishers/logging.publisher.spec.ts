import { Logger } from '@nestjs/common';
import { EventEnvelope } from '../envelope';
import { LoggingEventPublisher } from './logging.publisher';

describe('LoggingEventPublisher', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('loguea el evento en vez de publicarlo a un bus', async () => {
    const publisher = new LoggingEventPublisher();
    const envelope: EventEnvelope = {
      specVersion: '1.0',
      eventId: 'ev-1',
      eventType: 'urbanServiceScheduled',
      occurredAt: '2026-01-01T00:00:00.000Z',
      producer: { moduleId: 'M6', service: 'urban-services-api' },
      subject: 'svc-1',
      data: {},
    };

    expect(publisher.transport).toBe('log');
    await publisher.publish(envelope);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('urbanServiceScheduled subject=svc-1 eventId=ev-1'),
    );
  });
});
