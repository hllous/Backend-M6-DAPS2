import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateContainerDto } from '../../modules/containers/dto/create-container.dto';
import { CreateCrewDto } from '../../modules/crews/dto/create-crew.dto';
import { UpdateCrewDto } from '../../modules/crews/dto/update-crew.dto';
import { CreateDisposalSiteDto } from '../../modules/disposal-sites/dto/create-disposal-site.dto';
import { UpdateDisposalSiteDto } from '../../modules/disposal-sites/dto/update-disposal-site.dto';
import { CreateGreenPointDto } from '../../modules/green-points/dto/create-green-point.dto';
import { UpdateGreenPointDto } from '../../modules/green-points/dto/update-green-point.dto';
import { CreateGreenSpaceDto } from '../../modules/green-spaces/dto/create-green-space.dto';
import { UpdateGreenSpaceDto } from '../../modules/green-spaces/dto/update-green-space.dto';
import { CreateRouteDto } from '../../modules/routes/dto/create-route.dto';
import { UpdateRouteDto } from '../../modules/routes/dto/update-route.dto';
import { CreateServiceTypeDto } from '../../modules/service-types/dto/create-service-type.dto';
import { UpdateServiceTypeDto } from '../../modules/service-types/dto/update-service-type.dto';
import { CreateTreeDto } from '../../modules/trees/dto/create-tree.dto';
import { CreateVehicleDto } from '../../modules/vehicles/dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../../modules/vehicles/dto/update-vehicle.dto';
import { CreateZoneDto } from '../../modules/zones/dto/create-zone.dto';
import { UpdateZoneDto } from '../../modules/zones/dto/update-zone.dto';
import { ConfirmRelocationDto } from '../../modules/containers/dto/confirm-relocation.dto';
import { ContainerRelocationDto } from '../../modules/services/dto/complete-service.dto';
import { ReportStatusChangeDto } from '../../modules/environmental-reports/dto/status-change.dto';
import { CreateDelayNoticeDto } from '../../modules/services/dto/delay-notice.dto';
import { StatusChangeDto } from '../../modules/services/dto/status-change.dto';
import {
  ClosureSectionDto,
  CreateStreetClosureRequestDto,
  RejectClosureDto,
} from '../../modules/outbound-requests/dto/dtos';
import { ChecklistItemDto } from '../../modules/environmental-inspections/dto/dtos';

// Cada campo que lleva @Trim tiene que rechazar los espacios solos: si alguien
// saca el decorador de un DTO, el campo vuelve a aceptar "   " y este test falla.
const CAMPOS: Array<[string, new () => object, string]> = [
  ['CreateContainerDto', CreateContainerDto, 'code'],
  ['CreateCrewDto', CreateCrewDto, 'name'],
  ['UpdateCrewDto', UpdateCrewDto, 'name'],
  ['CreateDisposalSiteDto', CreateDisposalSiteDto, 'code'],
  ['CreateDisposalSiteDto', CreateDisposalSiteDto, 'name'],
  ['UpdateDisposalSiteDto', UpdateDisposalSiteDto, 'name'],
  ['CreateGreenPointDto', CreateGreenPointDto, 'code'],
  ['CreateGreenPointDto', CreateGreenPointDto, 'name'],
  ['UpdateGreenPointDto', UpdateGreenPointDto, 'name'],
  ['CreateGreenSpaceDto', CreateGreenSpaceDto, 'name'],
  ['UpdateGreenSpaceDto', UpdateGreenSpaceDto, 'name'],
  ['CreateRouteDto', CreateRouteDto, 'code'],
  ['CreateRouteDto', CreateRouteDto, 'name'],
  ['UpdateRouteDto', UpdateRouteDto, 'name'],
  ['CreateServiceTypeDto', CreateServiceTypeDto, 'code'],
  ['CreateServiceTypeDto', CreateServiceTypeDto, 'name'],
  ['UpdateServiceTypeDto', UpdateServiceTypeDto, 'name'],
  ['CreateTreeDto', CreateTreeDto, 'surveyCode'],
  ['CreateVehicleDto', CreateVehicleDto, 'plate'],
  ['UpdateVehicleDto', UpdateVehicleDto, 'plate'],
  ['CreateZoneDto', CreateZoneDto, 'code'],
  ['CreateZoneDto', CreateZoneDto, 'name'],
  ['UpdateZoneDto', UpdateZoneDto, 'name'],
  ['ConfirmRelocationDto', ConfirmRelocationDto, 'address'],
  ['ContainerRelocationDto', ContainerRelocationDto, 'address'],
  ['ReportStatusChangeDto', ReportStatusChangeDto, 'reason'],
  ['CreateDelayNoticeDto', CreateDelayNoticeDto, 'reason'],
  ['StatusChangeDto', StatusChangeDto, 'reason'],
  ['ClosureSectionDto', ClosureSectionDto, 'streetName'],
  ['ClosureSectionDto', ClosureSectionDto, 'fromCross'],
  ['ClosureSectionDto', ClosureSectionDto, 'toCross'],
  ['CreateStreetClosureRequestDto', CreateStreetClosureRequestDto, 'reason'],
  ['RejectClosureDto', RejectClosureDto, 'reason'],
  ['ChecklistItemDto', ChecklistItemDto, 'itemCode'],
  ['ChecklistItemDto', ChecklistItemDto, 'label'],
];

describe('@Trim en los DTO de entrada', () => {
  it.each(CAMPOS)('%s rechaza solo espacios en %s', async (_nombre, clase, campo) => {
    const dto = plainToInstance(clase, { [campo]: '   ' }, { enableImplicitConversion: true });
    const errores = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    const delCampo = errores.find((e) => e.property === campo);
    expect(delCampo?.constraints).toHaveProperty('isNotEmpty');
  });
});
