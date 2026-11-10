import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { InboxAdminService } from './inbox-admin.service';
import { QueryInboxDto } from './inbox-admin.dto';
import { IngestEventDto } from './ingest-event.dto';
import type { Mocked } from 'vitest';

describe('InboxController', () => {
  let service: Mocked<InboxService>;
  let admin: Mocked<InboxAdminService>;
  let controller: InboxController;

  beforeEach(() => {
    service = {
      ingest: vi.fn().mockResolvedValue({ status: 'processed' }),
      registeredTypes: vi.fn().mockReturnValue(['tipoA', 'tipoB']),
    } as unknown as Mocked<InboxService>;
    admin = {
      findAll: vi.fn().mockResolvedValue('lista'),
      findOne: vi.fn().mockResolvedValue('detalle'),
    } as unknown as Mocked<InboxAdminService>;
    controller = new InboxController(service, admin);
  });

  it('el listado y el detalle delegan en el service de consulta', async () => {
    const q = new QueryInboxDto();
    await expect(controller.findAll(q)).resolves.toBe('lista');
    await expect(controller.findOne('ev-1')).resolves.toBe('detalle');
    expect(admin.findAll).toHaveBeenCalledWith(q);
    expect(admin.findOne).toHaveBeenCalledWith('ev-1');
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

    await expect(controller.ingest(dto, '42')).resolves.toEqual({ status: 'processed' });
    expect(service.ingest).toHaveBeenCalledWith(dto);
  });

  it('el detalle rechaza un messageId demasiado largo sin consultar', async () => {
    await expect(controller.findOne('x'.repeat(101))).rejects.toThrow('excede');
    expect(admin.findOne).not.toHaveBeenCalled();
  });

  it('handlers devuelve los tipos registrados', async () => {
    await expect(controller.handlers()).resolves.toEqual({ eventTypes: ['tipoA', 'tipoB'] });
    expect(service.registeredTypes).toHaveBeenCalledWith();
  });
});
