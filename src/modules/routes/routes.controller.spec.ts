import { AuthenticatedUser } from '../../auth/jwt.strategy';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';
import { CreateRouteDto, QueryRoutesDto, SetRouteStopsDto, UpdateRouteDto } from './dto';
import type { Mocked } from 'vitest';

const USER = { userId: '42', roles: [] } as unknown as AuthenticatedUser;

const ID = '11111111-1111-1111-1111-111111111111';
const RESULT = { id: ID };

describe('RoutesController', () => {
  let service: Mocked<RoutesService>;
  let controller: RoutesController;

  beforeEach(() => {
    service = {
      create: vi.fn().mockResolvedValue(RESULT),
      findAll: vi.fn().mockResolvedValue({ items: [RESULT] }),
      findOne: vi.fn().mockResolvedValue(RESULT),
      update: vi.fn().mockResolvedValue(RESULT),
      remove: vi.fn().mockResolvedValue(undefined),
      setStops: vi.fn().mockResolvedValue(RESULT),
    } as unknown as Mocked<RoutesService>;
    controller = new RoutesController(service);
  });

  it('create delega el dto', async () => {
    const dto = {} as CreateRouteDto;
    await expect(controller.create(dto, USER)).resolves.toBe(RESULT);
    expect(service.create).toHaveBeenCalledWith(dto, USER);
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
    await controller.update(ID, dto, USER);
    expect(service.update).toHaveBeenCalledWith(ID, dto, USER);
  });

  it('remove delega el id', async () => {
    await controller.remove(ID, USER);
    expect(service.remove).toHaveBeenCalledWith(ID, USER);
  });

  it('setStops delega id y dto', async () => {
    const dto = {} as SetRouteStopsDto;
    await controller.setStops(ID, dto);
    expect(service.setStops).toHaveBeenCalledWith(ID, dto);
  });
});
