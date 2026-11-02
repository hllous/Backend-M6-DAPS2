import { AuthenticatedUser } from '../../auth/jwt.strategy';
import type { Response } from 'express';
import { EnvironmentalInspectionsController } from './environmental-inspections.controller';
import { EnvironmentalInspectionsService } from './environmental-inspections.service';
import { CompleteInspectionDto, CreateInspectionDto, IssueViolationNoticeDto } from './dto';

const USER = { userId: 'user-7', roles: [] } as unknown as AuthenticatedUser;

const ID = '11111111-1111-1111-1111-111111111111';
const REPORT_ID = '22222222-2222-2222-2222-222222222222';
const RESULT = { id: ID };

describe('EnvironmentalInspectionsController', () => {
  let service: jest.Mocked<EnvironmentalInspectionsService>;
  let controller: EnvironmentalInspectionsController;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(RESULT),
      findByReport: jest.fn().mockResolvedValue([RESULT]),
      findOne: jest.fn().mockResolvedValue(RESULT),
      complete: jest.fn().mockResolvedValue(RESULT),
      issueNotice: jest.fn().mockResolvedValue(RESULT),
      findNotice: jest.fn().mockResolvedValue(RESULT),
    } as unknown as jest.Mocked<EnvironmentalInspectionsService>;
    controller = new EnvironmentalInspectionsController(service);
  });

  it('create delega reportId y dto', async () => {
    const dto = {} as CreateInspectionDto;
    await expect(controller.create(REPORT_ID, dto, USER)).resolves.toBe(RESULT);
    expect(service.create).toHaveBeenCalledWith(REPORT_ID, dto, USER);
  });

  it('findByReport delega el reportId', async () => {
    await controller.findByReport(REPORT_ID);
    expect(service.findByReport).toHaveBeenCalledWith(REPORT_ID);
  });

  it('findOne delega el id', async () => {
    await controller.findOne(ID);
    expect(service.findOne).toHaveBeenCalledWith(ID);
  });

  it('complete delega id y dto', async () => {
    const dto = {} as CompleteInspectionDto;
    await controller.complete(ID, dto, USER);
    expect(service.complete).toHaveBeenCalledWith(ID, dto, USER);
  });

  it('issueNotice delega id, dto y userId', async () => {
    const dto = {} as IssueViolationNoticeDto;
    await controller.issueNotice(ID, dto, USER);
    expect(service.issueNotice).toHaveBeenCalledWith(ID, dto, USER);
  });

  it('findNotice delega el id', async () => {
    const res = { type: jest.fn() } as unknown as Response;
    await expect(controller.findNotice(ID, res)).resolves.toBe(RESULT);
    expect(service.findNotice).toHaveBeenCalledWith(ID);
    expect(res.type).not.toHaveBeenCalled();
  });

  it('findNotice sin acta responde el literal JSON null', async () => {
    service.findNotice.mockResolvedValue(null);
    const res = { type: jest.fn() } as unknown as Response;
    await expect(controller.findNotice(ID, res)).resolves.toBe('null');
    expect(res.type).toHaveBeenCalledWith('application/json');
  });
});
