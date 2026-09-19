import { CrewsController } from './crews.controller';
import { CrewsService } from './crews.service';
import { AddCrewMembersDto, CreateCrewDto, QueryCrewsDto, UpdateCrewDto } from './dto';

const ID = '11111111-1111-1111-1111-111111111111';
const RESULT = { id: ID };

describe('CrewsController', () => {
  let service: jest.Mocked<CrewsService>;
  let controller: CrewsController;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(RESULT),
      findAll: jest.fn().mockResolvedValue({ items: [RESULT] }),
      findOne: jest.fn().mockResolvedValue(RESULT),
      update: jest.fn().mockResolvedValue(RESULT),
      remove: jest.fn().mockResolvedValue(undefined),
      addMembers: jest.fn().mockResolvedValue(RESULT),
      removeMember: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CrewsService>;
    controller = new CrewsController(service);
  });

  it('create delega el dto', async () => {
    const dto = {} as CreateCrewDto;
    await expect(controller.create(dto)).resolves.toBe(RESULT);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('findAll delega la query', async () => {
    const query = {} as QueryCrewsDto;
    await controller.findAll(query);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('findOne delega el id', async () => {
    await controller.findOne(ID);
    expect(service.findOne).toHaveBeenCalledWith(ID);
  });

  it('update delega id y dto', async () => {
    const dto = {} as UpdateCrewDto;
    await controller.update(ID, dto);
    expect(service.update).toHaveBeenCalledWith(ID, dto);
  });

  it('remove delega el id', async () => {
    await controller.remove(ID);
    expect(service.remove).toHaveBeenCalledWith(ID);
  });

  it('addMembers delega id y dto', async () => {
    const dto = {} as AddCrewMembersDto;
    await controller.addMembers(ID, dto);
    expect(service.addMembers).toHaveBeenCalledWith(ID, dto);
  });

  it('removeMember delega id y userId', async () => {
    await controller.removeMember(ID, 'user-1');
    expect(service.removeMember).toHaveBeenCalledWith(ID, 'user-1');
  });
});
