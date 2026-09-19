import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import {
  AssignCrewDto,
  CompleteServiceDto,
  ConfirmRescheduleDto,
  CreateCollectionRecordDto,
  CreateDelayNoticeDto,
  CreateServiceDto,
  CreateZoneResultDto,
  QueryAssignmentConflictsDto,
  QueryServicesDto,
  StatusChangeDto,
  UpdateServiceDto,
} from './dto';

describe('ServicesController', () => {
  let service: jest.Mocked<ServicesService>;
  let controller: ServicesController;

  const RESULT = { id: 'svc-1' };
  const ID = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(RESULT),
      findAll: jest.fn().mockResolvedValue({ items: [RESULT] }),
      findOne: jest.fn().mockResolvedValue(RESULT),
      update: jest.fn().mockResolvedValue(RESULT),
      assignCrew: jest.fn().mockResolvedValue(RESULT),
      getAssignmentConflicts: jest.fn().mockResolvedValue({ conflicts: [] }),
      addDelayNotice: jest.fn().mockResolvedValue(RESULT),
      findDelayNotices: jest.fn().mockResolvedValue([RESULT]),
      start: jest.fn().mockResolvedValue(RESULT),
      suspend: jest.fn().mockResolvedValue(RESULT),
      resume: jest.fn().mockResolvedValue(RESULT),
      complete: jest.fn().mockResolvedValue(RESULT),
      cancel: jest.fn().mockResolvedValue(RESULT),
      reschedule: jest.fn().mockResolvedValue(RESULT),
      confirmReschedule: jest.fn().mockResolvedValue(RESULT),
      addZoneResult: jest.fn().mockResolvedValue(RESULT),
      findZoneResults: jest.fn().mockResolvedValue([RESULT]),
      addCollectionRecord: jest.fn().mockResolvedValue(RESULT),
      findCollectionRecords: jest.fn().mockResolvedValue([RESULT]),
    } as unknown as jest.Mocked<ServicesService>;
    controller = new ServicesController(service);
  });

  it('create delega en el service con el dto y el userId', async () => {
    const dto = { serviceTypeId: 'x' } as CreateServiceDto;
    await expect(controller.create(dto, 'user-1')).resolves.toBe(RESULT);
    expect(service.create).toHaveBeenCalledWith(dto, 'user-1');
  });

  it('findAll delega la query', async () => {
    const query = { page: 1 } as QueryServicesDto;
    await controller.findAll(query);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('findOne delega el id', async () => {
    await controller.findOne(ID);
    expect(service.findOne).toHaveBeenCalledWith(ID);
  });

  it('update delega id y dto', async () => {
    const dto = { notes: 'x' } as UpdateServiceDto;
    await controller.update(ID, dto);
    expect(service.update).toHaveBeenCalledWith(ID, dto);
  });

  it('assignCrew delega id, dto y userId opcional', async () => {
    const dto = { crewId: 'c1' } as AssignCrewDto;
    await controller.assignCrew(ID, dto, 'user-1');
    expect(service.assignCrew).toHaveBeenCalledWith(ID, dto, 'user-1');
  });

  it('assignmentConflicts delega id y query', async () => {
    const query = {} as QueryAssignmentConflictsDto;
    await controller.assignmentConflicts(ID, query);
    expect(service.getAssignmentConflicts).toHaveBeenCalledWith(ID, query);
  });

  it('addDelayNotice delega id, dto y userId opcional', async () => {
    const dto = { delayType: 'START' } as CreateDelayNoticeDto;
    await controller.addDelayNotice(ID, dto, 'user-1');
    expect(service.addDelayNotice).toHaveBeenCalledWith(ID, dto, 'user-1');
  });

  it('findDelayNotices delega el id', async () => {
    await controller.findDelayNotices(ID);
    expect(service.findDelayNotices).toHaveBeenCalledWith(ID);
  });

  it('start delega id y userId', async () => {
    await controller.start(ID, 'user-1');
    expect(service.start).toHaveBeenCalledWith(ID, 'user-1');
  });

  it('suspend delega id y el motivo del dto', async () => {
    await controller.suspend(ID, { reason: 'lluvia' } as StatusChangeDto);
    expect(service.suspend).toHaveBeenCalledWith(ID, 'lluvia');
  });

  it('resume delega el id', async () => {
    await controller.resume(ID);
    expect(service.resume).toHaveBeenCalledWith(ID);
  });

  it('complete delega id, dto y userId', async () => {
    const dto = {} as CompleteServiceDto;
    await controller.complete(ID, dto, 'user-1');
    expect(service.complete).toHaveBeenCalledWith(ID, dto, 'user-1');
  });

  it('cancel delega id, motivo y userId', async () => {
    await controller.cancel(ID, { reason: 'x' } as StatusChangeDto, 'user-1');
    expect(service.cancel).toHaveBeenCalledWith(ID, 'x', 'user-1');
  });

  it('reschedule delega id y motivo', async () => {
    await controller.reschedule(ID, { reason: 'x' } as StatusChangeDto);
    expect(service.reschedule).toHaveBeenCalledWith(ID, 'x');
  });

  it('confirmReschedule delega id y dto', async () => {
    const dto = {} as ConfirmRescheduleDto;
    await controller.confirmReschedule(ID, dto);
    expect(service.confirmReschedule).toHaveBeenCalledWith(ID, dto);
  });

  it('addZoneResult delega id y dto', async () => {
    const dto = {} as CreateZoneResultDto;
    await controller.addZoneResult(ID, dto);
    expect(service.addZoneResult).toHaveBeenCalledWith(ID, dto);
  });

  it('findZoneResults delega el id', async () => {
    await controller.findZoneResults(ID);
    expect(service.findZoneResults).toHaveBeenCalledWith(ID);
  });

  it('addCollectionRecord delega id y dto', async () => {
    const dto = {} as CreateCollectionRecordDto;
    await controller.addCollectionRecord(ID, dto);
    expect(service.addCollectionRecord).toHaveBeenCalledWith(ID, dto);
  });

  it('findCollectionRecords delega el id', async () => {
    await controller.findCollectionRecords(ID);
    expect(service.findCollectionRecords).toHaveBeenCalledWith(ID);
  });
});
