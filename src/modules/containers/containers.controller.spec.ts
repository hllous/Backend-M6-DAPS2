import { AuthenticatedUser } from '../../auth/jwt.strategy';
import { ContainersController } from './containers.controller';
import { ContainersService } from './containers.service';
import {
  ConfirmRelocationDto,
  CreateContainerDto,
  QueryContainersDto,
  ReportDamageDto,
  UpdateContainerDto,
} from './dto';
import { PaginationQueryDto } from '../../common/dto';

const USER = { userId: '42', roles: [] } as unknown as AuthenticatedUser;

const ID = '11111111-1111-1111-1111-111111111111';
const RESULT = { id: ID };

describe('ContainersController', () => {
  let service: jest.Mocked<ContainersService>;
  let controller: ContainersController;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(RESULT),
      findAll: jest.fn().mockResolvedValue({ items: [RESULT] }),
      findOne: jest.fn().mockResolvedValue(RESULT),
      findHistory: jest.fn().mockResolvedValue({ items: [] }),
      update: jest.fn().mockResolvedValue(RESULT),
      reportOverflow: jest.fn().mockResolvedValue(RESULT),
      reportDamage: jest.fn().mockResolvedValue(RESULT),
      empty: jest.fn().mockResolvedValue(RESULT),
      startRepair: jest.fn().mockResolvedValue(RESULT),
      completeRepair: jest.fn().mockResolvedValue(RESULT),
      relocate: jest.fn().mockResolvedValue(RESULT),
      confirmRelocation: jest.fn().mockResolvedValue(RESULT),
      remove: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ContainersService>;
    controller = new ContainersController(service);
  });

  it('create delega el dto', async () => {
    const dto = {} as CreateContainerDto;
    await expect(controller.create(dto, USER)).resolves.toBe(RESULT);
    expect(service.create).toHaveBeenCalledWith(dto, USER);
  });

  it('findAll delega la query', async () => {
    const query = {} as QueryContainersDto;
    await controller.findAll(query);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('findOne delega el id', async () => {
    await controller.findOne(ID);
    expect(service.findOne).toHaveBeenCalledWith(ID);
  });

  it('findHistory delega id y query', async () => {
    const query = {} as PaginationQueryDto;
    await controller.findHistory(ID, query);
    expect(service.findHistory).toHaveBeenCalledWith(ID, query);
  });

  it('update delega id y dto', async () => {
    const dto = {} as UpdateContainerDto;
    await controller.update(ID, dto);
    expect(service.update).toHaveBeenCalledWith(ID, dto);
  });

  it('reportOverflow delega el id', async () => {
    await controller.reportOverflow(ID, USER);
    expect(service.reportOverflow).toHaveBeenCalledWith(ID, USER);
  });

  it('reportDamage delega id y dto', async () => {
    const dto = {} as ReportDamageDto;
    await controller.reportDamage(ID, dto, USER);
    expect(service.reportDamage).toHaveBeenCalledWith(ID, dto, USER);
  });

  it('empty delega el id', async () => {
    await controller.empty(ID, USER);
    expect(service.empty).toHaveBeenCalledWith(ID, USER);
  });

  it('startRepair delega el id', async () => {
    await controller.startRepair(ID, USER);
    expect(service.startRepair).toHaveBeenCalledWith(ID, USER);
  });

  it('completeRepair delega el id', async () => {
    await controller.completeRepair(ID, USER);
    expect(service.completeRepair).toHaveBeenCalledWith(ID, USER);
  });

  it('relocate delega el id', async () => {
    await controller.relocate(ID, USER);
    expect(service.relocate).toHaveBeenCalledWith(ID, USER);
  });

  it('confirmRelocation delega id y dto', async () => {
    const dto = {} as ConfirmRelocationDto;
    await controller.confirmRelocation(ID, dto, USER);
    expect(service.confirmRelocation).toHaveBeenCalledWith(ID, dto, USER);
  });

  it('remove delega el id', async () => {
    await controller.remove(ID, USER);
    expect(service.remove).toHaveBeenCalledWith(ID, USER);
  });
});
