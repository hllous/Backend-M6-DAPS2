import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();
  let json: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    json = jest.fn();
    const status = jest.fn(() => ({ json }));
    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url: '/containers/abc' }),
      }),
    } as unknown as ArgumentsHost;
  });

  const captured = () => json.mock.calls[0][0];

  it('usa la frase del estado, no la constante del enum', () => {
    filter.catch(new NotFoundException('Contenedor no encontrado'), host);

    expect(captured()).toMatchObject({
      statusCode: 404,
      message: 'Contenedor no encontrado',
      error: 'Not Found', // no 'NOT_FOUND'
      path: '/containers/abc',
    });
  });

  it('junta los mensajes de class-validator en uno solo', () => {
    filter.catch(new BadRequestException(['code no puede estar vacio', 'lat invalida']), host);

    expect(captured().message).toBe('code no puede estar vacio; lat invalida');
  });

  it('traduce P2025 a 404 en vez de dejarlo salir como 500', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.22.0',
    });

    filter.catch(err, host);

    expect(captured()).toMatchObject({ statusCode: 404, error: 'Not Found' });
  });

  it('deja en 500 cualquier error no contemplado', () => {
    filter.catch(new Error('boom'), host);

    expect(captured()).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
    });
  });
});
