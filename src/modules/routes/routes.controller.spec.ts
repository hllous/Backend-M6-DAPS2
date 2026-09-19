import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';
import { CreateRouteDto, QueryRoutesDto, SetRouteStopsDto, UpdateRouteDto } from './dto';

const ID = '11111111-1111-1111-1111-111111111111';
const RESULT = { id: ID };

describe('RoutesController', () => {
  let service: jest.Mocked<RoutesService>;
  let controller: RoutesController;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(RESULT),
      findAll: jest.fn().mockResolvedValue({ items: [RESULT] }),
      findOne: jest.fn().mockResolvedValue(RESULT),
      update: jest.fn().mockResolvedValue(RESULT),
      remove: jest.fn().mockResolvedValue(undefined),
      setStops: jest.fn().mockResolvedValue(RESULT),
    } as unknown as jest.Mocked<RoutesService>;
    controller = new RoutesController(service);
  });

  it('create delega el dto', async () => {
    const dto = {} as CreateRouteDto;
    await expect(controller.create(dto)).resolves.toBe(RESULT);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('findAll delega la query', async () => {
    const query = {} as QueryRoutesDto;
    await controller.findAll(query);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('findOne delega el id', async () => {
    await controller.findOne(ID);
    expect(service.findOne).toHaveBeenCalledWith(ID);
  });

  it('update delega id y dto', async () => {
    const dto = {} as UpdateRouteDto;
    await controller.update(ID, dto);
    expect(service.update).toHaveBeenCalledWith(ID, dto);
  });

  it('remove delega el id', async () => {
    await controller.remove(ID);
    expect(service.remove).toHaveBeenCalledWith(ID);
  });

  it('setStops delega id y dto', async () => {
    const dto = {} as SetRouteStopsDto;
    await controller.setStops(ID, dto);
    expect(service.setStops).toHaveBeenCalledWith(ID, dto);
  });
});
