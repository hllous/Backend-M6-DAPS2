import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto';

describe('AuditController', () => {
  it('findAll delega la query', async () => {
    const service = { findAll: jest.fn().mockResolvedValue({ data: [] }) };
    const controller = new AuditController(service as unknown as AuditService);
    const query = new QueryAuditDto();

    await expect(controller.findAll(query)).resolves.toEqual({ data: [] });
    expect(service.findAll).toHaveBeenCalledWith(query);
  });
});
