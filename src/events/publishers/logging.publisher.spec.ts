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
      eventId: 'ev-1',
      eventType: 'urbanServiceScheduled',
      eventVersion: '1.0',
      occurredAt: '2026-01-01T00:00:00.000Z',
      sourceModule: 'ambiente',
      data: {},
    };

    expect(publisher.transport).toBe('log');
    await publisher.publish(envelope);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('urbanServiceScheduled eventId=ev-1'),
    );
  });
});
