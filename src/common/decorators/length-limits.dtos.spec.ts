import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IngestEventDto } from '../../events/inbox/ingest-event.dto';
import { QueryContainersDto } from '../../modules/containers/dto/query-containers.dto';
import { AddCrewMembersDto } from '../../modules/crews/dto/add-crew-members.dto';
import { CreateCrewDto } from '../../modules/crews/dto/create-crew.dto';
import { UpdateCrewDto } from '../../modules/crews/dto/update-crew.dto';
import { QueryDisposalSitesDto } from '../../modules/disposal-sites/dto/query-disposal-sites.dto';
import { QueryEnvironmentalReportsDto } from '../../modules/environmental-reports/dto/query-environmental-reports.dto';
import { CreateGreenPointDto } from '../../modules/green-points/dto/create-green-point.dto';
import { QueryGreenPointsDto } from '../../modules/green-points/dto/query-green-points.dto';
import { UpdateGreenPointDto } from '../../modules/green-points/dto/update-green-point.dto';
import { QueryGreenSpacesDto } from '../../modules/green-spaces/dto/query-green-spaces.dto';
import { QueryRoutesDto } from '../../modules/routes/dto/query-routes.dto';
import { QueryServiceTypesDto } from '../../modules/service-types/dto/query-service-types.dto';
import { CreateDelayNoticeDto } from '../../modules/services/dto/delay-notice.dto';
import { CreateServiceDto } from '../../modules/services/dto/create-service.dto';
import { QueryServicesDto } from '../../modules/services/dto/query-services.dto';
import { UpdateServiceDto } from '../../modules/services/dto/update-service.dto';
import { QueryTreesDto } from '../../modules/trees/dto/query-trees.dto';
import { AuthorizeInterventionDto } from '../../modules/trees/interventions/dto/authorize-intervention.dto';
import { CreateTreeInterventionDto } from '../../modules/trees/interventions/dto/create-tree-intervention.dto';
import { CreateTreeSurveyDto } from '../../modules/trees/surveys/dto/create-tree-survey.dto';
import { AddNeighborhoodsDto } from '../../modules/zones/dto/add-neighborhoods.dto';
import { QueryZonesDto } from '../../modules/zones/dto/query-zones.dto';

// Mismas opciones que el ValidationPipe de main.ts.
async function errorEn(clase: new () => object, campo: string, valor: unknown) {
  const dto = plainToInstance(clase, { [campo]: valor }, { enableImplicitConversion: true });
  const errores = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return errores.find((e) => e.property === campo);
}

const s = (n: number) => 'a'.repeat(n);

// [clase, campo, tope de largo]
const TEXTOS: Array<[string, new () => object, string, number]> = [
  ['QueryContainersDto', QueryContainersDto, 'search', 100],
  ['QueryDisposalSitesDto', QueryDisposalSitesDto, 'search', 100],
  ['QueryEnvironmentalReportsDto', QueryEnvironmentalReportsDto, 'search', 100],
  ['QueryEnvironmentalReportsDto', QueryEnvironmentalReportsDto, 'ticketId', 100],
  ['QueryEnvironmentalReportsDto', QueryEnvironmentalReportsDto, 'publicId', 100],
  ['QueryGreenPointsDto', QueryGreenPointsDto, 'search', 100],
  ['QueryGreenSpacesDto', QueryGreenSpacesDto, 'search', 100],
  ['QueryRoutesDto', QueryRoutesDto, 'search', 100],
  ['QueryServiceTypesDto', QueryServiceTypesDto, 'search', 100],
  ['QueryTreesDto', QueryTreesDto, 'search', 100],
  ['QueryZonesDto', QueryZonesDto, 'search', 100],
  ['QueryServicesDto', QueryServicesDto, 'ticketId', 100],
  ['CreateDelayNoticeDto', CreateDelayNoticeDto, 'reason', 500],
  ['CreateServiceDto', CreateServiceDto, 'notes', 2000],
  ['UpdateServiceDto', UpdateServiceDto, 'notes', 2000],
  ['CreateCrewDto', CreateCrewDto, 'leaderUserId', 100],
  ['CreateCrewDto', CreateCrewDto, 'organizationId', 100],
  ['UpdateCrewDto', UpdateCrewDto, 'leaderUserId', 100],
  ['UpdateCrewDto', UpdateCrewDto, 'organizationId', 100],
  ['AuthorizeInterventionDto', AuthorizeInterventionDto, 'authorizedByUserId', 100],
  ['CreateTreeSurveyDto', CreateTreeSurveyDto, 'inspectorId', 100],
  ['IngestEventDto', IngestEventDto, 'eventId', 100],
  ['IngestEventDto', IngestEventDto, 'eventType', 100],
];

// [clase, campo, tope de elementos, elemento valido n-esimo]
const UUID = (i: number) => `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`;
const ARRAYS: Array<[string, new () => object, string, (i: number) => unknown]> = [
  ['CreateTreeInterventionDto', CreateTreeInterventionDto, 'treeIds', UUID],
  ['AddCrewMembersDto', AddCrewMembersDto, 'userIds', (i) => `usr-${i}`],
  ['AddNeighborhoodsDto', AddNeighborhoodsDto, 'neighborhoodIds', (i) => `barrio-${i}`],
];

// Los tipos de residuo son un enum chico y ArrayUnique: el tope solo se
// alcanza con repetidos, asi que se prueba por la constraint de tamano.
const WASTE: Array<[string, new () => object, string]> = [
  ['CreateGreenPointDto', CreateGreenPointDto, 'wasteTypes'],
  ['UpdateGreenPointDto', UpdateGreenPointDto, 'wasteTypes'],
];

// Con %s jest imprimiria la clase entera: el titulo es "Clase.campo".
function titulos<A extends unknown[]>(tabla: Array<[string, ...A]>): Array<[string, ...A]> {
  return tabla.map(([n, ...r]) => [`${n}.${String(r[1])}`, ...r] as [string, ...A]);
}

// El UUID de treeIds ya acota el largo del elemento: solo se prueba el tamano.
const ARRAYS_DE_TEXTO = ARRAYS.filter(([, , campo]) => campo !== 'treeIds');

describe('topes de largo de los DTO de entrada', () => {
  it.each(titulos(TEXTOS))('%s: el tope pasa y tope+1 falla', async (_n, clase, campo, tope) => {
    expect(await errorEn(clase, campo, s(tope))).toBeUndefined();
    expect(await errorEn(clase, campo, s(tope + 1))).toHaveProperty('constraints.maxLength');
  });

  it.each(titulos(ARRAYS))('%s: 100 elementos pasan y 101 fallan', async (_n, clase, campo, el) => {
    const lista = (n: number) => Array.from({ length: n }, (_, i) => el(i));
    expect(await errorEn(clase, campo, lista(100))).toBeUndefined();
    expect(await errorEn(clase, campo, lista(101))).toHaveProperty('constraints.arrayMaxSize');
  });

  it.each(titulos(WASTE))('%s: mas de 100 elementos falla por tamano', async (_n, clase, campo) => {
    const err = await errorEn(clase, campo, Array(101).fill('RECYCLABLE'));
    expect(err).toHaveProperty('constraints.arrayMaxSize');
  });

  it.each(titulos(ARRAYS_DE_TEXTO))('%s: cada elemento tiene tope', async (_n, clase, campo) => {
    expect(await errorEn(clase, campo, [s(100)])).toBeUndefined();
    expect(await errorEn(clase, campo, [s(101)])).toHaveProperty('constraints.maxLength');
  });
});
