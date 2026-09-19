import { GreenSpacesController } from './green-spaces.controller';
import { GreenSpacesService } from './green-spaces.service';
import { CreateGreenSpaceDto, QueryGreenSpacesDto, UpdateGreenSpaceDto } from './dto';

const ID = '11111111-1111-1111-1111-111111111111';
const RESULT = { id: ID };

describe('GreenSpacesController', () => {
  let service: jest.Mocked<GreenSpacesService>;
  let controller: GreenSpacesController;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(RESULT),
      findAll: jest.fn().mockResolvedValue({ items: [RESULT] }),
      findOne: jest.fn().mockResolvedValue(RESULT),
      update: jest.fn().mockResolvedValue(RESULT),
      remove: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<GreenSpacesService>;
    controller = new GreenSpacesController(service);
  });

  it('create delega el dto', async () => {
    const dto = {} as CreateGreenSpaceDto;
    await expect(controller.create(dto)).resolves.toBe(RESULT);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('findAll delega la query', async () => {
    const query = {} as QueryGreenSpacesDto;
    await controller.findAll(query);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('findOne delega el id', async () => {
    await controller.findOne(ID);
    expect(service.findOne).toHaveBeenCalledWith(ID);
  });

  it('update delega id y dto', async () => {
    const dto = {} as UpdateGreenSpaceDto;
    await controller.update(ID, dto);
    expect(service.update).toHaveBeenCalledWith(ID, dto);
  });

  it('remove delega el id', async () => {
    await controller.remove(ID);
    expect(service.remove).toHaveBeenCalledWith(ID);
  });
});
