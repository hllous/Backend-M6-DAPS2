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

  it('create delega el dto', async () => {
    const dto = {} as CreateTreeInterventionDto;
    await expect(controller.create(dto)).resolves.toBe(RESULT);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('findAll delega la query', async () => {
    const query = {} as QueryTreeInterventionsDto;
    await controller.findAll(query);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('findOne delega el id', async () => {
    await controller.findOne(ID);
    expect(service.findOne).toHaveBeenCalledWith(ID);
  });

  it('submitForAuthorization delega el id', async () => {
    await controller.submitForAuthorization(ID);
    expect(service.submitForAuthorization).toHaveBeenCalledWith(ID);
  });

  it('authorize delega id y dto', async () => {
    const dto = {} as AuthorizeInterventionDto;
    await controller.authorize(ID, dto);
    expect(service.authorize).toHaveBeenCalledWith(ID, dto);
  });

  it('reject delega el id', async () => {
    await controller.reject(ID);
    expect(service.reject).toHaveBeenCalledWith(ID);
  });

  it('assignService delega id y dto', async () => {
    const dto = {} as AssignInterventionServiceDto;
    await controller.assignService(ID, dto);
    expect(service.assignService).toHaveBeenCalledWith(ID, dto);
  });
});
