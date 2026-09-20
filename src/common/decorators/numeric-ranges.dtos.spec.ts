import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfirmRelocationDto } from '../../modules/containers/dto/confirm-relocation.dto';
import { CreateContainerDto } from '../../modules/containers/dto/create-container.dto';
import { UpdateContainerDto } from '../../modules/containers/dto/update-container.dto';
import { CreateGreenSpaceDto } from '../../modules/green-spaces/dto/create-green-space.dto';
import { UpdateGreenSpaceDto } from '../../modules/green-spaces/dto/update-green-space.dto';
import { ContainerRelocationDto } from '../../modules/services/dto/complete-service.dto';
import { CreateCollectionRecordDto } from '../../modules/services/dto/create-collection-record.dto';
import { CreateTreeDto } from '../../modules/trees/dto/create-tree.dto';
import { UpdateTreeDto } from '../../modules/trees/dto/update-tree.dto';
import { CreateVehicleDto } from '../../modules/vehicles/dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../../modules/vehicles/dto/update-vehicle.dto';
import { PaginationQueryDto } from '../dto/pagination-query.dto';

// Tope = maximo que entra en la columna (Int, Decimal(10,2), Decimal(5,2),
// Decimal(5,1)). Un valor mayor llegaba a Prisma y volvia como 500 opaco.
// [clase, campo, maximo que entra, minimo valido]
const RANGOS: Array<[string, new () => object, string, number, number]> = [
  ['CreateContainerDto', CreateContainerDto, 'capacityLiters', 2147483647, 1],
  ['UpdateContainerDto', UpdateContainerDto, 'capacityLiters', 2147483647, 1],
  ['CreateVehicleDto', CreateVehicleDto, 'capacity', 99999999.99, 0],
  ['UpdateVehicleDto', UpdateVehicleDto, 'capacity', 99999999.99, 0],
  ['CreateGreenSpaceDto', CreateGreenSpaceDto, 'areaM2', 99999999.99, 0],
  ['UpdateGreenSpaceDto', UpdateGreenSpaceDto, 'areaM2', 99999999.99, 0],
  ['CreateCollectionRecordDto', CreateCollectionRecordDto, 'weightKg', 99999999.99, 0],
  ['CreateCollectionRecordDto', CreateCollectionRecordDto, 'volumeM3', 99999999.99, 0],
  ['CreateTreeDto', CreateTreeDto, 'heightM', 999.99, 0],
  ['UpdateTreeDto', UpdateTreeDto, 'heightM', 999.99, 0],
  ['CreateTreeDto', CreateTreeDto, 'diameterCm', 9999.9, 0],
  ['UpdateTreeDto', UpdateTreeDto, 'diameterCm', 9999.9, 0],
  ['PaginationQueryDto', PaginationQueryDto, 'page', 10000000, 1],
];

// Coordenadas: Decimal(10,7) aceptaba 999.99 y no hay latitud mayor a 90.
const COORDS: Array<[string, new () => object]> = [
  ['CreateContainerDto', CreateContainerDto],
  ['UpdateContainerDto', UpdateContainerDto],
  ['ConfirmRelocationDto', ConfirmRelocationDto],
  ['ContainerRelocationDto', ContainerRelocationDto],
  ['CreateTreeDto', CreateTreeDto],
  ['UpdateTreeDto', UpdateTreeDto],
];

// Mismas opciones que el ValidationPipe de main.ts.
async function errorEn(clase: new () => object, campo: string, valor: unknown) {
  const dto = plainToInstance(clase, { [campo]: valor }, { enableImplicitConversion: true });
  const errores = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return errores.find((e) => e.property === campo);
}

describe('rangos numericos de los DTO de entrada', () => {
  it.each(RANGOS)('%s.%s: el maximo pasa y el siguiente falla', async (_n, clase, campo, max) => {
    expect(await errorEn(clase, campo, max)).toBeUndefined();
    expect(await errorEn(clase, campo, max + 1)).toHaveProperty('constraints.max');
    expect(await errorEn(clase, campo, max * 10)).toHaveProperty('constraints.max');
  });

  it.each(RANGOS)('%s.%s: el minimo pasa y por debajo falla', async (_n, clase, campo, _m, min) => {
    expect(await errorEn(clase, campo, min)).toBeUndefined();
    expect(await errorEn(clase, campo, min - 1)).toHaveProperty('constraints.min');
  });

  it.each(COORDS)('%s valida lat y lng', async (_n, clase) => {
    for (const [campo, limite] of [
      ['lat', 90],
      ['lng', 180],
    ] as const) {
      expect(await errorEn(clase, campo, limite)).toBeUndefined();
      expect(await errorEn(clase, campo, -limite)).toBeUndefined();
      expect(await errorEn(clase, campo, limite + 0.5)).toHaveProperty('constraints.max');
      expect(await errorEn(clase, campo, -limite - 0.5)).toHaveProperty('constraints.min');
      expect(await errorEn(clase, campo, 1e12)).toBeDefined();
    }
  });
});
