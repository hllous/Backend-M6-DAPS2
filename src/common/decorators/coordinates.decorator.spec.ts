import { ValidationPipe } from '@nestjs/common';
import { IsOptional } from 'class-validator';
import { Latitude, Longitude } from './coordinates.decorator';

class CoordsDto {
  @IsOptional()
  @Latitude()
  lat?: number;

  @IsOptional()
  @Longitude()
  lng?: number;
}

describe('@Latitude / @Longitude', () => {
  // Mismas opciones que main.ts.
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });
  const validar = (body: object) => pipe.transform(body, { type: 'body', metatype: CoordsDto });

  it.each([
    { lat: 90, lng: 180 },
    { lat: -90, lng: -180 },
    { lat: -34.1234567, lng: -58.1234567 },
    {},
  ])('acepta %j', async (body) => {
    await expect(validar(body)).resolves.toBeDefined();
  });

  it.each([
    { lat: 91 },
    { lat: -90.1 },
    { lng: 181 },
    { lng: -180.1 },
    { lat: -34.12345678 },
    { lng: -58.12345678 },
    { lat: 'abc' },
    { lng: 'abc' },
  ])('rechaza %j', async (body) => {
    await expect(validar(body)).rejects.toMatchObject({ status: 400 });
  });
});
