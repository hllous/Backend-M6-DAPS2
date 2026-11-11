import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import { HttpExceptionFilter } from './http-exception.filter';
import type { Mock } from 'vitest';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();
  let json: Mock;
  let type: Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    json = vi.fn();
    type = vi.fn(() => ({ json }));
    const status = vi.fn(() => ({ type }));
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

  it('no devuelve en path los tokens de la query', () => {
    const status = vi.fn(() => ({ type }));
    const h = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url: '/zones?access_token=SECRETO&page=2' }),
      }),
    } as unknown as ArgumentsHost;
    filter.catch(new NotFoundException('x'), h);
    expect(captured().path).toBe('/zones?access_token=[REDACTED]&page=2');
  });

  it('conserva el code de la excepción (403 ROLE_REQUIRED) y no agrega uno si no hay', () => {
    filter.catch(
      new ForbiddenException({ statusCode: 403, message: 'Sin rol', code: 'ROLE_REQUIRED' }),
      host,
    );
    expect(captured()).toMatchObject({
      statusCode: 403,
      message: 'Sin rol',
      code: 'ROLE_REQUIRED',
    });

    json.mockClear();
    filter.catch(new NotFoundException('x'), host);
    expect(captured()).not.toHaveProperty('code');
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

  describe('Problem Details RFC 9457 (ADR-011)', () => {
    it('responde application/problem+json con los campos RFC y los históricos', () => {
      filter.catch(new NotFoundException('Contenedor no encontrado'), host);

      expect(type).toHaveBeenCalledWith('application/problem+json');
      expect(captured()).toEqual({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Contenedor no encontrado',
        instance: '/containers/abc',
        statusCode: 404,
        message: 'Contenedor no encontrado',
        error: 'Not Found',
        timestamp: expect.any(String),
        path: '/containers/abc',
      });
    });

    it('instance sale redactada igual que path', () => {
      const status = vi.fn(() => ({ type }));
      const h = {
        switchToHttp: () => ({
          getResponse: () => ({ status }),
          getRequest: () => ({ url: '/zones?access_token=SECRETO' }),
        }),
      } as unknown as ArgumentsHost;
      filter.catch(new NotFoundException('x'), h);
      expect(captured().instance).toBe('/zones?access_token=[REDACTED]');
    });

    it('el arreglo de validación va unido en detail y message', () => {
      filter.catch(new BadRequestException(['a', 'b']), host);
      expect(captured()).toMatchObject({ status: 400, detail: 'a; b', message: 'a; b' });
    });

    it('mantiene code junto a los campos RFC', () => {
      filter.catch(new ForbiddenException({ message: 'Sin rol', code: 'ROLE_REQUIRED' }), host);
      expect(captured()).toMatchObject({ title: 'Forbidden', status: 403, code: 'ROLE_REQUIRED' });
    });

    it('P2002 y P2003 mantienen su mapeo', () => {
      const prismaErr = (code: string) =>
        new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: '5.22.0' });
      filter.catch(prismaErr('P2002'), host);
      expect(captured()).toMatchObject({ status: 409, title: 'Conflict' });
      json.mockClear();
      filter.catch(prismaErr('P2003'), host);
      expect(captured()).toMatchObject({ status: 404, title: 'Not Found' });
    });

    it('500 genérico sin stack ni detalle interno', () => {
      filter.catch(new Error('boom con secreto'), host);
      const body = captured();
      expect(body).toMatchObject({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Error interno del servidor',
      });
      expect(JSON.stringify(body)).not.toContain('secreto');
    });

    it('429 (ThrottlerException) sale como problem+json', () => {
      filter.catch(new ThrottlerException(), host);
      expect(captured()).toMatchObject({
        status: 429,
        title: 'Too Many Requests',
        statusCode: 429,
      });
    });

    it('un error de body-parser (413) conserva su status en vez de caer en 500', () => {
      const err = Object.assign(new Error('request entity too large'), {
        status: 413,
        expose: true,
      });
      filter.catch(err, host);
      expect(captured()).toMatchObject({ status: 413, title: 'Payload Too Large' });
    });
  });
});
