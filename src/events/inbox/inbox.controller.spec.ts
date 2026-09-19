import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { IngestEventDto } from './ingest-event.dto';

describe('InboxController', () => {
  let service: jest.Mocked<InboxService>;
  let controller: InboxController;

  beforeEach(() => {
    service = {
      ingest: jest.fn().mockResolvedValue({ status: 'processed' }),
      registeredTypes: jest.fn().mockReturnValue(['tipoA', 'tipoB']),
    } as unknown as jest.Mocked<InboxService>;
    controller = new InboxController(service);
  });

  it('ingest arma el sobre a partir del dto y delega en el service', async () => {
    const dto: IngestEventDto = {
      specVersion: '1.0',
      eventId: 'ev-1',
      eventType: 'tipoA',
      eventVersion: '1.0',
      occurredAt: '2026-09-18T00:00:00.000Z',
      producer: 'm2',
      subject: 'sub-1',
      data: { foo: 'bar' },
    };

    await expect(controller.ingest(dto)).resolves.toEqual({ status: 'processed' });
    expect(service.ingest).toHaveBeenCalledWith(dto);
  });

  it('handlers devuelve los tipos registrados', async () => {
    await expect(controller.handlers()).resolves.toEqual({ eventTypes: ['tipoA', 'tipoB'] });
    expect(service.registeredTypes).toHaveBeenCalledWith();
  });
});
