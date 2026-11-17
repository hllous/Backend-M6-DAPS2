import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { setupSwagger } from './swagger-config';

describe('setupSwagger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sirve Swagger UI en api/docs con el documento de createOpenApiDocument', () => {
    const doc = { openapi: '3.0.0', info: { title: 't', version: '1' }, paths: {} };
    vi.spyOn(SwaggerModule, 'createDocument').mockReturnValue(doc as never);
    const setup = vi.spyOn(SwaggerModule, 'setup').mockImplementation(() => undefined);
    const app = {} as INestApplication;

    setupSwagger(app);

    expect(setup).toHaveBeenCalledWith('api/docs', app, doc, {
      swaggerOptions: { persistAuthorization: true },
    });
  });
});
