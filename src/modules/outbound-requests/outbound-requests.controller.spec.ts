import { AuthenticatedUser } from '../../auth/jwt.strategy';
import {
  RepairRequestsController,
  StreetClosureRequestsController,
} from './outbound-requests.controller';
import { OutboundRequestsService } from './outbound-requests.service';
import {
  ApproveClosureDto,
  CreateRepairRequestDto,
  CreateStreetClosureRequestDto,
  QueryRepairRequestsDto,
  QueryStreetClosureRequestsDto,
  RejectClosureDto,
  StartRepairDto,
} from './dto';
import type { Mocked } from 'vitest';

const USER = { userId: '42', roles: [] } as unknown as AuthenticatedUser;

const ID = '11111111-1111-1111-1111-111111111111';
const RESULT = { id: ID };

describe('RepairRequestsController', () => {
  let service: Mocked<OutboundRequestsService>;
  let controller: RepairRequestsController;

  beforeEach(() => {
    service = {
      createRepairRequest: vi.fn().mockResolvedValue(RESULT),
      findRepairRequests: vi.fn().mockResolvedValue({ items: [RESULT] }),
      findRepairRequest: vi.fn().mockResolvedValue(RESULT),
      startRepair: vi.fn().mockResolvedValue(RESULT),
      closeRepair: vi.fn().mockResolvedValue(RESULT),
    } as unknown as Mocked<OutboundRequestsService>;
    controller = new RepairRequestsController(service);
  });

  it('create delega el dto', async () => {
    const dto = {} as CreateRepairRequestDto;
    await expect(controller.create(dto, USER)).resolves.toBe(RESULT);
    expect(service.createRepairRequest).toHaveBeenCalledWith(dto, USER);
  });

  it('findAll delega la query', async () => {
    const query = {} as QueryRepairRequestsDto;
    await controller.findAll(query);
    expect(service.findRepairRequests).toHaveBeenCalledWith(query);
  });

  it('findOne delega el id', async () => {
    await controller.findOne(ID);
    expect(service.findRepairRequest).toHaveBeenCalledWith(ID);
  });

  it('start delega id y dto', async () => {
    const dto = {} as StartRepairDto;
    await controller.start(ID, dto, USER);
    expect(service.startRepair).toHaveBeenCalledWith(ID, dto, USER);
  });

  it('close delega el id', async () => {
    await controller.close(ID, USER);
    expect(service.closeRepair).toHaveBeenCalledWith(ID, USER);
  });
});

describe('StreetClosureRequestsController', () => {
  let service: Mocked<OutboundRequestsService>;
  let controller: StreetClosureRequestsController;

  beforeEach(() => {
    service = {
      createClosureRequest: vi.fn().mockResolvedValue(RESULT),
      findClosureRequests: vi.fn().mockResolvedValue({ items: [RESULT] }),
      findClosureRequest: vi.fn().mockResolvedValue(RESULT),
      approveClosure: vi.fn().mockResolvedValue(RESULT),
      rejectClosure: vi.fn().mockResolvedValue(RESULT),
      endClosure: vi.fn().mockResolvedValue(RESULT),
    } as unknown as Mocked<OutboundRequestsService>;
    controller = new StreetClosureRequestsController(service);
  });

  it('create delega el dto', async () => {
    const dto = {} as CreateStreetClosureRequestDto;
    await controller.create(dto, USER);
    expect(service.createClosureRequest).toHaveBeenCalledWith(dto, USER);
  });

  it('findAll delega la query', async () => {
    const query = {} as QueryStreetClosureRequestsDto;
    await controller.findAll(query);
    expect(service.findClosureRequests).toHaveBeenCalledWith(query);
  });

  it('findOne delega el id', async () => {
    await controller.findOne(ID);
    expect(service.findClosureRequest).toHaveBeenCalledWith(ID);
  });

  it('approve delega id y dto', async () => {
    const dto = {} as ApproveClosureDto;
    await controller.approve(ID, dto, USER);
    expect(service.approveClosure).toHaveBeenCalledWith(ID, dto, USER);
  });

  it('reject delega id y el motivo del dto', async () => {
    await controller.reject(ID, { reason: 'no procede' } as RejectClosureDto, USER);
    expect(service.rejectClosure).toHaveBeenCalledWith(ID, 'no procede', USER);
  });

  it('end delega el id', async () => {
    await controller.end(ID, USER);
    expect(service.endClosure).toHaveBeenCalledWith(ID, USER);
  });
});
