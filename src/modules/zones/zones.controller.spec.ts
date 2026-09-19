import { ZonesController } from './zones.controller';
import { ZonesService } from './zones.service';
import { AddNeighborhoodsDto, CreateZoneDto, QueryZonesDto, UpdateZoneDto } from './dto';

const ID = '11111111-1111-1111-1111-111111111111';
const RESULT = { id: ID };

describe('ZonesController', () => {
  let service: jest.Mocked<ZonesService>;
  let controller: ZonesController;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(RESULT),
      findAll: jest.fn().mockResolvedValue({ items: [RESULT] }),
      findOne: jest.fn().mockResolvedValue(RESULT),
      update: jest.fn().mockResolvedValue(RESULT),
      remove: jest.fn().mockResolvedValue(undefined),
      addNeighborhoods: jest.fn().mockResolvedValue(RESULT),
      removeNeighborhood: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ZonesService>;
    controller = new ZonesController(service);
  });

  it('create delega el dto', async () => {
    const dto = {} as CreateZoneDto;
    await expect(controller.create(dto)).resolves.toBe(RESULT);
    expect(service.create).toHaveBeenCalledWith(dto);
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
    await controller.update(ID, dto);
    expect(service.update).toHaveBeenCalledWith(ID, dto);
  });

  it('remove delega el id', async () => {
    await controller.remove(ID);
    expect(service.remove).toHaveBeenCalledWith(ID);
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
