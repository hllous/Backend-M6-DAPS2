import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
}
