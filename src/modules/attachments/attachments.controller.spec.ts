import { M6Role } from '@prisma/client';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { QueryEvidenceDto, UploadEvidenceDto } from './dto';

const RESULT = { id: 'ev-1' };
const ROLES = [M6Role.M6_CAMPO_CUADRILLA];

describe('AttachmentsController', () => {
  let service: jest.Mocked<AttachmentsService>;
  let controller: AttachmentsController;

  beforeEach(() => {
    service = {
      upload: jest.fn().mockResolvedValue(RESULT),
      findByOwner: jest.fn().mockResolvedValue([RESULT]),
    } as unknown as jest.Mocked<AttachmentsService>;
    controller = new AttachmentsController(service);
  });

  it('upload delega dto, archivo, la Idempotency-Key y los roles y el userId del token', async () => {
    const dto = { ownerType: 'CONTAINER', ownerId: 'c1' } as UploadEvidenceDto;
    const file = { originalname: 'foto.jpg' } as Express.Multer.File;
    await expect(controller.upload(dto, file, 'idem-1', ROLES, '4242')).resolves.toBe(RESULT);
    expect(service.upload).toHaveBeenCalledWith(dto, file, 'idem-1', ROLES, '4242');
  });

  it('findByOwner delega la query', async () => {
    const query = {} as QueryEvidenceDto;
    await controller.findByOwner(query);
    expect(service.findByOwner).toHaveBeenCalledWith(query);
  });
});
