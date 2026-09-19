import { EnvironmentalReportsController } from './environmental-reports.controller';
import { EnvironmentalReportsService } from './environmental-reports.service';
import {
  CreateEnvironmentalReportDto,
  QueryEnvironmentalReportsDto,
  ReportStatusChangeDto,
} from './dto';

const ID = '11111111-1111-1111-1111-111111111111';
const RESULT = { id: ID };

describe('EnvironmentalReportsController', () => {
  let service: jest.Mocked<EnvironmentalReportsService>;
  let controller: EnvironmentalReportsController;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(RESULT),
      findAll: jest.fn().mockResolvedValue({ items: [RESULT] }),
      findOne: jest.fn().mockResolvedValue(RESULT),
      startReview: jest.fn().mockResolvedValue(RESULT),
      forward: jest.fn().mockResolvedValue(RESULT),
      dismiss: jest.fn().mockResolvedValue(RESULT),
      close: jest.fn().mockResolvedValue(RESULT),
    } as unknown as jest.Mocked<EnvironmentalReportsService>;
    controller = new EnvironmentalReportsController(service);
  });

  it('create delega el dto', async () => {
    const dto = {} as CreateEnvironmentalReportDto;
    await expect(controller.create(dto)).resolves.toBe(RESULT);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('findAll delega la query', async () => {
    const query = {} as QueryEnvironmentalReportsDto;
    await controller.findAll(query);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('findOne delega el id', async () => {
    await controller.findOne(ID);
    expect(service.findOne).toHaveBeenCalledWith(ID);
  });

  it('startReview delega id y userId', async () => {
    await controller.startReview(ID, 'user-1');
    expect(service.startReview).toHaveBeenCalledWith(ID, 'user-1');
  });

  it('forward delega id, motivo y userId', async () => {
    await controller.forward(ID, { reason: 'no compete' } as ReportStatusChangeDto, 'user-1');
    expect(service.forward).toHaveBeenCalledWith(ID, 'no compete', 'user-1');
  });

  it('dismiss delega id, motivo y userId', async () => {
    await controller.dismiss(ID, { reason: 'sin mérito' } as ReportStatusChangeDto, 'user-1');
    expect(service.dismiss).toHaveBeenCalledWith(ID, 'sin mérito', 'user-1');
  });

  it('close delega id y userId', async () => {
    await controller.close(ID, 'user-1');
    expect(service.close).toHaveBeenCalledWith(ID, 'user-1');
  });
});
