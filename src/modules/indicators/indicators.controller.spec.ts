import { IndicatorsController } from './indicators.controller';
import { IndicatorsService } from './indicators.service';
import { PeriodQueryDto, ServicePeriodQueryDto } from './dto';
import type { Mocked } from 'vitest';

const RESULT = { total: 1 };

describe('IndicatorsController', () => {
  let service: Mocked<IndicatorsService>;
  let controller: IndicatorsController;

  beforeEach(() => {
    service = {
      coverage: vi.fn().mockResolvedValue(RESULT),
      compliance: vi.fn().mockResolvedValue(RESULT),
      incidents: vi.fn().mockResolvedValue(RESULT),
      waste: vi.fn().mockResolvedValue(RESULT),
    } as unknown as Mocked<IndicatorsService>;
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
