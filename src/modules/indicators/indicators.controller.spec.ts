import { IndicatorsController } from './indicators.controller';
import { IndicatorsService } from './indicators.service';
import { PeriodQueryDto, ServicePeriodQueryDto } from './dto';

const RESULT = { total: 1 };

describe('IndicatorsController', () => {
  let service: jest.Mocked<IndicatorsService>;
  let controller: IndicatorsController;

  beforeEach(() => {
    service = {
      coverage: jest.fn().mockResolvedValue(RESULT),
      compliance: jest.fn().mockResolvedValue(RESULT),
      incidents: jest.fn().mockResolvedValue(RESULT),
      waste: jest.fn().mockResolvedValue(RESULT),
    } as unknown as jest.Mocked<IndicatorsService>;
    controller = new IndicatorsController(service);
  });

  it('coverage delega la query', async () => {
    const query = {} as ServicePeriodQueryDto;
    await expect(controller.coverage(query)).resolves.toBe(RESULT);
    expect(service.coverage).toHaveBeenCalledWith(query);
  });

  it('compliance delega la query', async () => {
    const query = {} as ServicePeriodQueryDto;
    await controller.compliance(query);
    expect(service.compliance).toHaveBeenCalledWith(query);
  });

  it('incidents delega la query', async () => {
    const query = {} as PeriodQueryDto;
    await controller.incidents(query);
    expect(service.incidents).toHaveBeenCalledWith(query);
  });

  it('waste delega la query', async () => {
    const query = {} as PeriodQueryDto;
    await controller.waste(query);
    expect(service.waste).toHaveBeenCalledWith(query);
  });
});
