import { ContainersController } from './containers.controller';
import { ContainersService } from './containers.service';
import {
  ConfirmRelocationDto,
  CreateContainerDto,
  QueryContainersDto,
  ReportDamageDto,
  UpdateContainerDto,
} from './dto';

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
    await expect(controller.create(dto)).resolves.toBe(RESULT);
    expect(service.create).toHaveBeenCalledWith(dto);
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

  it('update delega id y dto', async () => {
    const dto = {} as UpdateContainerDto;
    await controller.update(ID, dto);
    expect(service.update).toHaveBeenCalledWith(ID, dto);
  });

  it('reportOverflow delega el id', async () => {
    await controller.reportOverflow(ID);
    expect(service.reportOverflow).toHaveBeenCalledWith(ID);
  });

  it('reportDamage delega id y dto', async () => {
    const dto = {} as ReportDamageDto;
    await controller.reportDamage(ID, dto);
    expect(service.reportDamage).toHaveBeenCalledWith(ID, dto);
  });

  it('empty delega el id', async () => {
    await controller.empty(ID);
    expect(service.empty).toHaveBeenCalledWith(ID);
  });

  it('startRepair delega el id', async () => {
    await controller.startRepair(ID);
    expect(service.startRepair).toHaveBeenCalledWith(ID);
  });

  it('completeRepair delega el id', async () => {
    await controller.completeRepair(ID);
    expect(service.completeRepair).toHaveBeenCalledWith(ID);
  });

  it('relocate delega el id', async () => {
    await controller.relocate(ID);
    expect(service.relocate).toHaveBeenCalledWith(ID);
  });

  it('confirmRelocation delega id y dto', async () => {
    const dto = {} as ConfirmRelocationDto;
    await controller.confirmRelocation(ID, dto);
    expect(service.confirmRelocation).toHaveBeenCalledWith(ID, dto);
  });

  it('remove delega el id', async () => {
    await controller.remove(ID);
    expect(service.remove).toHaveBeenCalledWith(ID);
  });
});
