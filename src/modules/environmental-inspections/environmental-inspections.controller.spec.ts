import { EnvironmentalInspectionsController } from './environmental-inspections.controller';
import { EnvironmentalInspectionsService } from './environmental-inspections.service';
import { CompleteInspectionDto, CreateInspectionDto, IssueViolationNoticeDto } from './dto';

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
    await expect(controller.create(REPORT_ID, dto)).resolves.toBe(RESULT);
    expect(service.create).toHaveBeenCalledWith(REPORT_ID, dto);
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
    await controller.complete(ID, dto);
    expect(service.complete).toHaveBeenCalledWith(ID, dto);
  });

  it('issueNotice delega id, dto y userId', async () => {
    const dto = {} as IssueViolationNoticeDto;
    await controller.issueNotice(ID, dto, 'user-1');
    expect(service.issueNotice).toHaveBeenCalledWith(ID, dto, 'user-1');
  });

  it('findNotice delega el id', async () => {
    await controller.findNotice(ID);
    expect(service.findNotice).toHaveBeenCalledWith(ID);
  });
});
