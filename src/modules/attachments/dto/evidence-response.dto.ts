import { ApiProperty } from '@nestjs/swagger';

export class EvidenceResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'https://cdn.example.com/evidence/a1b2c3d4.jpg' })
  url: string;

  @ApiProperty({ example: 'IMG_20260902.jpg' })
  filename: string;

  @ApiProperty({ example: 'image/jpeg' })
  contentType: string;

  @ApiProperty({ example: '2026-09-02T22:00:00.000Z' })
  uploadedAt: string;
}
