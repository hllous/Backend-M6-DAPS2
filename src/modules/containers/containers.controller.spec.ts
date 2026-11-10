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
import type { Mocked } from 'vitest';

const USER = { userId: '42', roles: [] } as unknown as AuthenticatedUser;

const ID = '11111111-1111-1111-1111-111111111111';
const RESULT = { id: ID };

describe('ContainersController', () => {
  let service: Mocked<ContainersService>;
  let controller: ContainersController;

  beforeEach(() => {
    service = {
      create: vi.fn().mockResolvedValue(RESULT),
      findAll: vi.fn().mockResolvedValue({ items: [RESULT] }),
      findOne: vi.fn().mockResolvedValue(RESULT),
      findHistory: vi.fn().mockResolvedValue({ items: [] }),
      update: vi.fn().mockResolvedValue(RESULT),
      reportOverflow: vi.fn().mockResolvedValue(RESULT),
      reportDamage: vi.fn().mockResolvedValue(RESULT),
      empty: vi.fn().mockResolvedValue(RESULT),
      startRepair: vi.fn().mockResolvedValue(RESULT),
      completeRepair: vi.fn().mockResolvedValue(RESULT),
      relocate: vi.fn().mockResolvedValue(RESULT),
      confirmRelocation: vi.fn().mockResolvedValue(RESULT),
      remove: vi.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<ContainersService>;
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
    expect(service.update).toHaveBeenCalledWith(ID, dto, undefined);
  });

  it('reportOverflow pasa el If-Match al service', async () => {
    await controller.reportOverflow(ID, USER, 'W/"1"');
    expect(service.reportOverflow).toHaveBeenCalledWith(ID, USER, 'W/"1"');
  });

  it('reportOverflow delega el id', async () => {
    await controller.reportOverflow(ID, USER);
    expect(service.reportOverflow).toHaveBeenCalledWith(ID, USER, undefined);
  });

  it('reportDamage delega id y dto', async () => {
    const dto = {} as ReportDamageDto;
    await controller.reportDamage(ID, dto, USER);
    expect(service.reportDamage).toHaveBeenCalledWith(ID, dto, USER, undefined);
  });

  it('empty delega el id', async () => {
    await controller.empty(ID, USER);
    expect(service.empty).toHaveBeenCalledWith(ID, USER, undefined);
  });

  it('startRepair delega el id', async () => {
    await controller.startRepair(ID, USER);
    expect(service.startRepair).toHaveBeenCalledWith(ID, USER, undefined);
  });

  it('completeRepair delega el id', async () => {
    await controller.completeRepair(ID, USER);
    expect(service.completeRepair).toHaveBeenCalledWith(ID, USER, undefined);
  });

  it('relocate delega el id', async () => {
    await controller.relocate(ID, USER);
    expect(service.relocate).toHaveBeenCalledWith(ID, USER, undefined);
  });

  it('confirmRelocation delega id y dto', async () => {
    const dto = {} as ConfirmRelocationDto;
    await controller.confirmRelocation(ID, dto, USER);
    expect(service.confirmRelocation).toHaveBeenCalledWith(ID, dto, USER, undefined);
  });

  it('remove delega el id', async () => {
    await controller.remove(ID, USER);
    expect(service.remove).toHaveBeenCalledWith(ID, USER, undefined);
  });
});
