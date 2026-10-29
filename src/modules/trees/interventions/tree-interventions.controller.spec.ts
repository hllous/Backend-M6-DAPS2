import { M6Role } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TreeInterventionsController } from './tree-interventions.controller';
import { TreeInterventionsService } from './tree-interventions.service';
import {
  AssignInterventionServiceDto,
  AuthorizeInterventionDto,
  CreateTreeInterventionDto,
  QueryTreeInterventionsDto,
} from './dto';

const ID = '11111111-1111-1111-1111-111111111111';
const RESULT = { id: ID };

describe('TreeInterventionsController', () => {
  let service: jest.Mocked<TreeInterventionsService>;
  let controller: TreeInterventionsController;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(RESULT),
      findAll: jest.fn().mockResolvedValue({ items: [RESULT] }),
      findOne: jest.fn().mockResolvedValue(RESULT),
      submitForAuthorization: jest.fn().mockResolvedValue(RESULT),
      authorize: jest.fn().mockResolvedValue(RESULT),
      reject: jest.fn().mockResolvedValue(RESULT),
      assignService: jest.fn().mockResolvedValue(RESULT),
    } as unknown as jest.Mocked<TreeInterventionsService>;
    controller = new TreeInterventionsController(service);
  });

  it('create delega el dto y el usuario del token', async () => {
    const dto = {} as CreateTreeInterventionDto;
    await expect(controller.create(dto, 'user-2')).resolves.toBe(RESULT);
    expect(service.create).toHaveBeenCalledWith(dto, 'user-2');
  });

  it('findAll delega la query', async () => {
    const query = {} as QueryTreeInterventionsDto;
    await controller.findAll(query);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('findAll pasa el filtro por árbol al service', async () => {
    const query = { treeId: ID } as QueryTreeInterventionsDto;
    await controller.findAll(query);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  /** Lo que el ValidationPipe global convierte en 400. */
  it.each([
    ['un UUID válido', 'b8c9d0e1-f2a3-4567-8bcd-678901234567', 0],
    ['algo que no es UUID', 'arbol-1', 1],
  ])('treeId: %s', async (_caso, treeId, errores) => {
    const dto = plainToInstance(QueryTreeInterventionsDto, { treeId });
    expect(await validate(dto)).toHaveLength(errores);
  });

  it('findOne delega el id', async () => {
    await controller.findOne(ID);
    expect(service.findOne).toHaveBeenCalledWith(ID);
  });

  it('submitForAuthorization delega el id', async () => {
    await controller.submitForAuthorization(ID);
    expect(service.submitForAuthorization).toHaveBeenCalledWith(ID);
  });

  it('authorize delega id, dto, el usuario y sus roles del token', async () => {
    const dto = {} as AuthorizeInterventionDto;
    await controller.authorize(ID, dto, 'user-7', ['M6_ADMIN' as M6Role]);
    expect(service.authorize).toHaveBeenCalledWith(ID, dto, 'user-7', ['M6_ADMIN']);
  });

  it('reject delega el id y los roles del token', async () => {
    await controller.reject(ID, 'user-7', ['M6_ADMIN' as M6Role]);
    expect(service.reject).toHaveBeenCalledWith(ID, 'user-7', ['M6_ADMIN']);
  });

  it('assignService delega id y dto', async () => {
    const dto = {} as AssignInterventionServiceDto;
    await controller.assignService(ID, dto);
    expect(service.assignService).toHaveBeenCalledWith(ID, dto);
  });
});
