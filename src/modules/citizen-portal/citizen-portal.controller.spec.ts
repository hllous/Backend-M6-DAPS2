import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { CitizenPortalController } from './citizen-portal.controller';
import { CitizenPortalService } from './citizen-portal.service';
import { QueryPublicGreenPointsDto, QueryPublicServicesDto } from './dto';

const RESULT = { id: '1' };

describe('CitizenPortalController', () => {
  let service: jest.Mocked<CitizenPortalService>;
  let controller: CitizenPortalController;

  beforeEach(() => {
    service = {
      findReportByTicket: jest.fn().mockResolvedValue(RESULT),
      findServices: jest.fn().mockResolvedValue({ items: [RESULT] }),
      findGreenPoints: jest.fn().mockResolvedValue({ items: [RESULT] }),
      findZones: jest.fn().mockResolvedValue([RESULT]),
    } as unknown as jest.Mocked<CitizenPortalService>;
    controller = new CitizenPortalController(service);
  });

  it('findReport delega el ticketId', async () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    await expect(controller.findReport(id)).resolves.toBe(RESULT);
    expect(service.findReportByTicket).toHaveBeenCalledWith(id);
  });

  it('findReport rechaza con 400 un ticketId que no es UUID', async () => {
    // El pipe se aplica en el pipeline de Nest, no al llamar al método: se
    // verifica contra la metadata del parámetro.
    const pipes = Reflect.getMetadata(
      '__routeArguments__',
      CitizenPortalController,
      'findReport',
    ) as Record<string, { data: string; pipes: unknown[] }>;
    const param = Object.values(pipes).find((p) => p.data === 'ticketId');
    expect(param?.pipes).toContain(ParseUUIDPipe);
    // Y ese pipe rechaza lo que no es UUID con 400.
    const pipe = new ParseUUIDPipe();
    const meta = { type: 'param' as const, data: 'ticketId' };
    await expect(pipe.transform('abc', meta)).rejects.toThrow(BadRequestException);
    await expect(pipe.transform("' OR 1=1", meta)).rejects.toThrow(BadRequestException);
  });

  it('findServices delega la query', async () => {
    const query = {} as QueryPublicServicesDto;
    await controller.findServices(query);
    expect(service.findServices).toHaveBeenCalledWith(query);
  });

  it('findGreenPoints delega la query', async () => {
    const query = {} as QueryPublicGreenPointsDto;
    await controller.findGreenPoints(query);
    expect(service.findGreenPoints).toHaveBeenCalledWith(query);
  });

  it('findZones no recibe argumentos', async () => {
    await controller.findZones();
    expect(service.findZones).toHaveBeenCalledWith();
  });
});
