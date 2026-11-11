import { AuthenticatedUser } from '../../auth/jwt.strategy';
import { ZonesController } from './zones.controller';
import { ZonesService } from './zones.service';
import { AddNeighborhoodsDto, CreateZoneDto, QueryZonesDto, UpdateZoneDto } from './dto';
import type { Mocked } from 'vitest';

const USER = { userId: '42', roles: [] } as unknown as AuthenticatedUser;

const ID = '11111111-1111-1111-1111-111111111111';
const RESULT = { id: ID };

describe('ZonesController', () => {
  let service: Mocked<ZonesService>;
  let controller: ZonesController;

  beforeEach(() => {
    service = {
      create: vi.fn().mockResolvedValue(RESULT),
      findAll: vi.fn().mockResolvedValue({ items: [RESULT] }),
      findOne: vi.fn().mockResolvedValue(RESULT),
      update: vi.fn().mockResolvedValue(RESULT),
      remove: vi.fn().mockResolvedValue(undefined),
      addNeighborhoods: vi.fn().mockResolvedValue(RESULT),
      removeNeighborhood: vi.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<ZonesService>;
    controller = new ZonesController(service);
  });

  it('create delega el dto', async () => {
    const dto = {} as CreateZoneDto;
    await expect(controller.create(dto, USER)).resolves.toBe(RESULT);
    expect(service.create).toHaveBeenCalledWith(dto, USER);
  });

  it('findAll delega la query', async () => {
    const query = {} as QueryZonesDto;
    await controller.findAll(query);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('findOne delega el id', async () => {
    await controller.findOne(ID);
    expect(service.findOne).toHaveBeenCalledWith(ID);
  });

  it('update delega id y dto', async () => {
    const dto = {} as UpdateZoneDto;
    await controller.update(ID, dto, USER);
    expect(service.update).toHaveBeenCalledWith(ID, dto, USER);
  });

  it('remove delega el id', async () => {
    await controller.remove(ID, USER);
    expect(service.remove).toHaveBeenCalledWith(ID, USER);
  });

  it('addNeighborhoods delega id y dto', async () => {
    const dto = {} as AddNeighborhoodsDto;
    await controller.addNeighborhoods(ID, dto);
    expect(service.addNeighborhoods).toHaveBeenCalledWith(ID, dto);
  });

  it('removeNeighborhood delega id y neighborhoodId', async () => {
    await controller.removeNeighborhood(ID, 'n-1');
    expect(service.removeNeighborhood).toHaveBeenCalledWith(ID, 'n-1');
  });
});
