import { AuthenticatedUser } from '../../auth/jwt.strategy';
import { CrewsController } from './crews.controller';
import { CrewsService } from './crews.service';
import {
  AddCrewMembersDto,
  CreateCrewDto,
  CreateCrewZoneAssignmentDto,
  QueryCrewsDto,
  UpdateCrewDto,
} from './dto';

const USER = { userId: '42', roles: [] } as unknown as AuthenticatedUser;

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
      createZoneAssignment: jest.fn().mockResolvedValue(RESULT),
      listZoneAssignments: jest.fn().mockResolvedValue([RESULT]),
    } as unknown as jest.Mocked<CrewsService>;
    controller = new CrewsController(service);
  });

  it('create delega el dto', async () => {
    const dto = {} as CreateCrewDto;
    await expect(controller.create(dto, USER)).resolves.toBe(RESULT);
    expect(service.create).toHaveBeenCalledWith(dto, USER);
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
    await controller.update(ID, dto, USER);
    expect(service.update).toHaveBeenCalledWith(ID, dto, USER);
  });

  it('remove delega el id', async () => {
    await controller.remove(ID, USER);
    expect(service.remove).toHaveBeenCalledWith(ID, USER);
  });

  it('addMembers delega id y dto', async () => {
    const dto = {} as AddCrewMembersDto;
    await controller.addMembers(ID, dto, USER);
    expect(service.addMembers).toHaveBeenCalledWith(ID, dto, USER);
  });

  it('createZoneAssignment delega id, dto y el usuario del token', async () => {
    const dto = {} as CreateCrewZoneAssignmentDto;
    await expect(controller.createZoneAssignment(ID, dto, USER)).resolves.toBe(RESULT);
    expect(service.createZoneAssignment).toHaveBeenCalledWith(ID, dto, USER);
  });

  it('listZoneAssignments delega el id', async () => {
    await expect(controller.listZoneAssignments(ID)).resolves.toEqual([RESULT]);
    expect(service.listZoneAssignments).toHaveBeenCalledWith(ID);
  });

  it('removeMember delega id y userId', async () => {
    await controller.removeMember(ID, 'user-1', USER);
    expect(service.removeMember).toHaveBeenCalledWith(ID, 'user-1', USER);
  });
});
