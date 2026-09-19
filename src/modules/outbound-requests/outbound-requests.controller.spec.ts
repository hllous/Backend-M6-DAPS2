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

const ID = '11111111-1111-1111-1111-111111111111';
const RESULT = { id: ID };

describe('RepairRequestsController', () => {
  let service: jest.Mocked<OutboundRequestsService>;
  let controller: RepairRequestsController;

  beforeEach(() => {
    service = {
      createRepairRequest: jest.fn().mockResolvedValue(RESULT),
      findRepairRequests: jest.fn().mockResolvedValue({ items: [RESULT] }),
      findRepairRequest: jest.fn().mockResolvedValue(RESULT),
      startRepair: jest.fn().mockResolvedValue(RESULT),
      closeRepair: jest.fn().mockResolvedValue(RESULT),
    } as unknown as jest.Mocked<OutboundRequestsService>;
    controller = new RepairRequestsController(service);
  });

  it('create delega el dto', async () => {
    const dto = {} as CreateRepairRequestDto;
    await expect(controller.create(dto)).resolves.toBe(RESULT);
    expect(service.createRepairRequest).toHaveBeenCalledWith(dto);
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
    await controller.start(ID, dto);
    expect(service.startRepair).toHaveBeenCalledWith(ID, dto);
  });

  it('close delega el id', async () => {
    await controller.close(ID);
    expect(service.closeRepair).toHaveBeenCalledWith(ID);
  });
});

describe('StreetClosureRequestsController', () => {
  let service: jest.Mocked<OutboundRequestsService>;
  let controller: StreetClosureRequestsController;

  beforeEach(() => {
    service = {
      createClosureRequest: jest.fn().mockResolvedValue(RESULT),
      findClosureRequests: jest.fn().mockResolvedValue({ items: [RESULT] }),
      findClosureRequest: jest.fn().mockResolvedValue(RESULT),
      approveClosure: jest.fn().mockResolvedValue(RESULT),
      rejectClosure: jest.fn().mockResolvedValue(RESULT),
      endClosure: jest.fn().mockResolvedValue(RESULT),
    } as unknown as jest.Mocked<OutboundRequestsService>;
    controller = new StreetClosureRequestsController(service);
  });

  it('create delega el dto', async () => {
    const dto = {} as CreateStreetClosureRequestDto;
    await controller.create(dto);
    expect(service.createClosureRequest).toHaveBeenCalledWith(dto);
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
    await controller.approve(ID, dto);
    expect(service.approveClosure).toHaveBeenCalledWith(ID, dto);
  });

  it('reject delega id y el motivo del dto', async () => {
    await controller.reject(ID, { reason: 'no procede' } as RejectClosureDto);
    expect(service.rejectClosure).toHaveBeenCalledWith(ID, 'no procede');
  });

  it('end delega el id', async () => {
    await controller.end(ID);
    expect(service.endClosure).toHaveBeenCalledWith(ID);
  });
});
