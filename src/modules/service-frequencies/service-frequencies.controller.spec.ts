import { ServiceFrequenciesController } from './service-frequencies.controller';
import { ServiceFrequenciesService } from './service-frequencies.service';
import {
  CreateServiceFrequencyDto,
  QueryServiceFrequenciesDto,
  UpdateServiceFrequencyDto,
} from './dto';

const ID = '11111111-1111-1111-1111-111111111111';
const RESULT = { id: ID };

describe('ServiceFrequenciesController', () => {
  let service: jest.Mocked<ServiceFrequenciesService>;
  let controller: ServiceFrequenciesController;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(RESULT),
      findAll: jest.fn().mockResolvedValue({ items: [RESULT] }),
      findOne: jest.fn().mockResolvedValue(RESULT),
      update: jest.fn().mockResolvedValue(RESULT),
      remove: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ServiceFrequenciesService>;
    controller = new ServiceFrequenciesController(service);
  });

  it('create delega el dto', async () => {
    const dto = {} as CreateServiceFrequencyDto;
    await expect(controller.create(dto)).resolves.toBe(RESULT);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('findAll delega la query', async () => {
    const query = {} as QueryServiceFrequenciesDto;
    await controller.findAll(query);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('findOne delega el id', async () => {
    await controller.findOne(ID);
    expect(service.findOne).toHaveBeenCalledWith(ID);
  });

  it('update delega id y dto', async () => {
    const dto = {} as UpdateServiceFrequencyDto;
    await controller.update(ID, dto);
    expect(service.update).toHaveBeenCalledWith(ID, dto);
  });

  it('remove delega el id', async () => {
    await controller.remove(ID);
    expect(service.remove).toHaveBeenCalledWith(ID);
  });
});
