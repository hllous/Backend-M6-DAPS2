import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
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

  // El filtro y la paginación los resuelve el service; el controller no recorta.
  it('findAll pasa crewId y la paginación tal cual al service (#243)', async () => {
    const page = { data: [{ id: ID, assignedCrewId: 'crew-1' }], meta: { total: 1 } };
    service.findAll.mockResolvedValue(page as any);
    const query = { crewId: 'crew-1', page: 2, pageSize: 10 } as QueryEnvironmentalReportsDto;

    await expect(controller.findAll(query)).resolves.toBe(page);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('crewId tiene que ser UUID: otro valor es 400, no una cola vacía (#243)', async () => {
    const errores = (crewId: string) =>
      validate(plainToInstance(QueryEnvironmentalReportsDto, { crewId }), {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

    expect(await errores('e5f6a7b8-c9d0-4234-8fab-345678901234')).toEqual([]);
    expect((await errores('cuadrilla-1')).map((e) => e.property)).toEqual(['crewId']);
  });

  it('findOne devuelve assignedCrewId tal como lo arma el service (#243)', async () => {
    service.findOne.mockResolvedValue({ id: ID, assignedCrewId: null } as any);

    await expect(controller.findOne(ID)).resolves.toMatchObject({ assignedCrewId: null });
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
