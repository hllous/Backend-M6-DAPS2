import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RiskLevel, RiskType, TreeHealthStatus, TreeInterventionType } from '@prisma/client';

/**
 * El último relevamiento del árbol, resumido.
 *
 * El riesgo no es un atributo del árbol sino el resultado de haberlo mirado:
 * vive en `TreeSurvey` y cambia con cada relevamiento. Pero para pintar el
 * arbolado en el mapa por color de riesgo hace falta el dato vigente en el
 * listado, y pedirlo árbol por árbol no escala en un censo real.
 *
 * Es un resumen, no el historial: van los campos que responden "¿este árbol
 * necesita atención?". El resto —inspector, notas, si requiere corte de calle—
 * sigue en `GET /trees/:treeId/surveys`.
 */
export class TreeLastSurveyDto {
  @ApiProperty({ description: 'Fecha del relevamiento', format: 'date-time' })
  surveyedAt: Date;

  @ApiProperty({ description: 'Estado sanitario', enum: TreeHealthStatus })
  healthStatus: TreeHealthStatus;

  @ApiProperty({ description: 'Nivel de riesgo evaluado', enum: RiskLevel })
  riskLevel: RiskLevel;

  @ApiPropertyOptional({ description: 'Tipo de riesgo detectado', enum: RiskType })
  riskType: RiskType | null;

  @ApiPropertyOptional({ description: 'Intervención sugerida', enum: TreeInterventionType })
  suggestedIntervention: TreeInterventionType | null;
}

export class TreeResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() surveyCode: string;
  @ApiPropertyOptional() species: string | null;
  @ApiProperty({ format: 'uuid' }) zoneId: string;
  @ApiPropertyOptional() address: string | null;
  @ApiPropertyOptional() lat: number | null;
  @ApiPropertyOptional() lng: number | null;
  @ApiPropertyOptional() heightM: number | null;
  @ApiPropertyOptional() diameterCm: number | null;
  @ApiProperty() active: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt: Date;

  @ApiPropertyOptional({
    description:
      'Resumen del último relevamiento. `null` si el árbol todavía no fue relevado, ' +
      'que es un estado real y no un error: se censa el arbolado antes de poder recorrerlo entero.',
    type: TreeLastSurveyDto,
    nullable: true,
  })
  lastSurvey: TreeLastSurveyDto | null;
}
