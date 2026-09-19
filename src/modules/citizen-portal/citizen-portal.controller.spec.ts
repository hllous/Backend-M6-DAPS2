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
    await expect(controller.findReport('ticket-1')).resolves.toBe(RESULT);
    expect(service.findReportByTicket).toHaveBeenCalledWith('ticket-1');
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
