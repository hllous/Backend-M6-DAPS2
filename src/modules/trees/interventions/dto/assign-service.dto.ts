import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignInterventionServiceDto {
  @ApiProperty({
    description:
      'Servicio que va a ejecutar la intervención. Tiene que ser de modo POINT y no estar ya asociado a otra intervención.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsUUID()
  serviceId: string;
}
