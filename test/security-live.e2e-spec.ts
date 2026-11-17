import { createHmac, randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { M6Role } from '@prisma/client';
import request from 'supertest';
import { buildCorsOptions } from '../src/common/http/cors-options';
import { API_CSP, DOCS_CSP } from '../src/common/middleware/security-headers.middleware';
import { EVIDENCE_STORAGE } from '../src/modules/attachments/storage/evidence-storage.interface';
import { ZonesService } from '../src/modules/zones/zones.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupSwagger } from '../src/swagger-config';
import {
  ACTORES,
  Api,
  bearer,
  crearCuadrilla,
  crearTipoServicio,
  crearZona,
  createTestApp,
  grantRoles,
  hoy,
  seedActores,
  tokenDe,
  tokenFor,
  truncateAll,
} from './helpers';

/**
 * Las pruebas de seguridad que la cátedra ejecuta en vivo (Eje D, #696), una
 * por una, contra la app real y Postgres real. El mismo set corre contra una
 * URL cualquiera con `scripts/security-live.mjs` (docs/testing.md).
 *
 * Regla de cada caso: el atacante no recibe el dato ni deja cambios. Por eso
 * casi todos verifican también la base, no solo el status.
 */
describe('Seguridad en vivo (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let oficina: Api;
  const http = () => request(app.getHttpServer());

  const FRONT = 'https://front.m6.test';
  const INTEGRANTE_A = ACTORES.cuadrilla.userId; // 9004
  const INTEGRANTE_B = '9011';
  const INSPECTOR_B = '9007';
  const campo = (userId: string) => new Api(app, tokenFor('ADMINISTRATIVO', userId));

  let zoneId: string;
  let serviceTypeId: string;
  let cuadrillaA: string;
  let servicioA: string;
  let evidenciaUrlA: string;

  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 1, 2, 3, 4, 5, 6, 0xff, 0xd9]);

  // ─── JWT a mano ─────────────────────────────────────
  // jsonwebtoken no firma alg=none ni deja romper el contrato a gusto: se arma el token.
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const secreto = () => Buffer.from(process.env.JWT_SECRET ?? '', 'base64');
  const ahora = () => Math.floor(Date.now() / 1000);
  const claims = (extra: Record<string, unknown> = {}) => ({
    sub: ACTORES.admin.userId,
    sub_type: 'EMPLEADO',
    rol: ACTORES.admin.m1Role,
    typ: 'access',
    iss: process.env.JWT_ISSUER,
    iat: ahora(),
    exp: ahora() + 900,
    ...extra,
  });
  function firmar(
    payload: Record<string, unknown>,
    { alg = 'HS256', clave = secreto() }: { alg?: string; clave?: Buffer } = {},
  ): string {
    const cuerpo = `${b64({ alg, typ: 'JWT' })}.${b64(payload)}`;
    if (alg === 'none') return `${cuerpo}.`;
    const hash = { HS256: 'sha256', HS384: 'sha384', HS512: 'sha512' }[alg] ?? 'sha256';
    return `${cuerpo}.${createHmac(hash, clave).update(cuerpo).digest('base64url')}`;
  }
  /** Mismo encabezado y firma, payload cambiado: lo que hace quien edita el token en jwt.io. */
  function alterado(): string {
    const [h, , s] = firmar(claims({ rol: 'RESPONSABLE_AREA' })).split('.');
    return `${h}.${b64(claims({ sub: '1', rol: 'RESPONSABLE_AREA' }))}.${s}`;
  }

  beforeAll(async () => {
    app = await createTestApp(
      (b) =>
        b.overrideProvider(EVIDENCE_STORAGE).useValue({
          upload: async ({ key }: { key: string }) => ({ url: `https://storage.test/${key}` }),
          remove: async () => undefined,
        }),
      // Lo que main.ts agrega antes de listen: Swagger (para la CSP de /api/docs) y CORS.
      (a) => {
        setupSwagger(a);
        a.enableCors(buildCorsOptions([FRONT]));
      },
    );
    prisma = app.get(PrismaService);
    await truncateAll(prisma);
    await seedActores(prisma);
    await grantRoles(prisma, INTEGRANTE_B, [M6Role.M6_CAMPO_CUADRILLA]);
    await grantRoles(prisma, INSPECTOR_B, [M6Role.M6_CAMPO_INSPECTOR]);

    oficina = Api.porRol(app);
    zoneId = (await crearZona(oficina)).id;
    serviceTypeId = (await crearTipoServicio(oficina, { mode: 'POINT' })).id;
    cuadrillaA = (await crearCuadrilla(oficina, [INTEGRANTE_A])).id;
    await crearCuadrilla(oficina, [INTEGRANTE_B]);

    servicioA = (
      await oficina
        .post('/services', {
          serviceTypeId,
          scheduledDate: hoy(),
          origin: 'PLANNED',
          zoneId,
          crewId: cuadrillaA,
        })
        .expect(201)
    ).body.id;
    await campo(INTEGRANTE_A).post(`/services/${servicioA}/start`).expect(200);
    const subida = await http()
      .post('/evidence')
      .set(bearer(tokenFor('ADMINISTRATIVO', INTEGRANTE_A)))
      .set('Idempotency-Key', randomUUID())
      .field('ownerType', 'SERVICE')
      .field('ownerId', servicioA)
      .attach('file', JPEG, { filename: 'foto.jpg', contentType: 'image/jpeg' })
      .expect(201);
    evidenciaUrlA = subida.body.url;
  });

  afterAll(async () => {
    await app.close();
  });

  /** Un error del filtro global: Problem Details, sin stack ni rutas del servidor. */
  const sinFiltraciones = (res: request.Response) => {
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    const texto = JSON.stringify(res.body);
    expect(texto).not.toMatch(/\bat [\w.<>]+ \(|node_modules|[A-Z]:\\|\/src\/|stack/i);
    expect(res.body.traceId).toBe(res.headers['x-request-id']);
  };

  // ─── 1. JWT ─────────────────────────────────────────
  describe('JWT inválido → 401', () => {
    const casos: [string, () => string][] = [
      ['vencido', () => firmar(claims({ iat: ahora() - 3600, exp: ahora() - 60 }))],
      ['firma alterada (payload editado)', alterado],
      ['firmado con otra clave', () => firmar(claims(), { clave: Buffer.alloc(32, 1) })],
      ['alg=none sin firma', () => firmar(claims(), { alg: 'none' })],
      ['otro emisor (iss)', () => firmar(claims({ iss: 'emisor-falso' }))],
      ['sin emisor', () => firmar(claims({ iss: undefined }))],
      ['typ=refresh', () => firmar(claims({ typ: 'refresh' }))],
      ['sin exp', () => firmar(claims({ exp: undefined }))],
      ['nbf en el futuro', () => firmar(claims({ nbf: ahora() + 3600 }))],
      ['basura', () => 'no.es.un-jwt'],
    ];

    it('el token de control (válido) sí entra', async () => {
      await http()
        .get('/zones')
        .set(bearer(firmar(claims())))
        .expect(200);
    });

    it.each(casos)('%s', async (_n, token) => {
      const res = await http().get('/zones').set(bearer(token()));
      expect(res.status).toBe(401);
      expect(res.body.data).toBeUndefined();
      sinFiltraciones(res);
    });

    it('sin token: 401', async () => {
      const res = await http().get('/zones');
      expect(res.status).toBe(401);
      sinFiltraciones(res);
    });

    it('un token rechazado tampoco escribe', async () => {
      const antes = await prisma.zone.count();
      const res = await http()
        .post('/zones')
        .set(bearer(firmar(claims(), { alg: 'none' })))
        .send({ code: 'NONE-1', name: 'x' });
      expect(res.status).toBe(401);
      await expect(prisma.zone.count()).resolves.toBe(antes);
    });
  });

  // ─── 2. BFLA ────────────────────────────────────────
  describe('BFLA: rol sin permiso → 403 ROLE_REQUIRED', () => {
    const casos: [string, () => string, string, string, unknown][] = [
      [
        'auditor crea una zona',
        () => tokenDe('auditor'),
        'post',
        '/zones',
        { code: 'BF-1', name: 'x' },
      ],
      [
        'cuadrilla crea una zona',
        () => tokenDe('cuadrilla'),
        'post',
        '/zones',
        { code: 'BF-2', name: 'x' },
      ],
      [
        'operaciones lista roles',
        () => tokenDe('operaciones'),
        'get',
        '/role-assignments',
        undefined,
      ],
      [
        'cuadrilla se asigna M6_ADMIN',
        () => tokenDe('cuadrilla'),
        'put',
        `/role-assignments/${ACTORES.cuadrilla.userId}`,
        { roles: ['M6_ADMIN'] },
      ],
      ['ambiental postea al inbox', () => tokenDe('ambiental'), 'post', '/events/inbox', {}],
      [
        'ciudadano lee servicios',
        () => tokenFor('CIUDADANO', '777', 'CIUDADANO'),
        'get',
        '/services',
        undefined,
      ],
    ];

    it.each(casos)('%s', async (_n, token, method, path, body) => {
      const antesZonas = await prisma.zone.count();
      const antesRoles = await prisma.userRoleAssignment.count();
      const req = (http() as unknown as Record<string, (p: string) => request.Test>)
        [method](path)
        .set(bearer(token()));
      const res = body === undefined ? await req : await req.send(body as object);

      expect(res.status).toBe(403);
      expect(res.body.data).toBeUndefined();
      sinFiltraciones(res);
      // El 403 no dice qué rol hacía falta.
      expect(JSON.stringify(res.body)).not.toMatch(/M6_(ADMIN|OFICINA|CAMPO|AUDITOR)/);
      await expect(prisma.zone.count()).resolves.toBe(antesZonas);
      await expect(prisma.userRoleAssignment.count()).resolves.toBe(antesRoles);
    });
  });

  // ─── 3. BOLA / IDOR ─────────────────────────────────
  describe('BOLA: Campo sobre un recurso de otra cuadrilla → 403, nunca el dato', () => {
    const noAsignado = (res: request.Response) => {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('NOT_ASSIGNED');
      sinFiltraciones(res);
      // Sin el traceId: un UUID al azar puede contener "9004".
      const texto = JSON.stringify({ ...res.body, traceId: undefined });
      for (const dato of [cuadrillaA, INTEGRANTE_A, evidenciaUrlA])
        expect(texto).not.toContain(dato);
    };

    it('B lee la evidencia del servicio de A: 403 y sin URLs', async () => {
      const res = await campo(INTEGRANTE_B).get(`/evidence?ownerType=SERVICE&ownerId=${servicioA}`);
      noAsignado(res);
    });

    it('control: el integrante de A sí la ve', async () => {
      const res = await campo(INTEGRANTE_A)
        .get(`/evidence?ownerType=SERVICE&ownerId=${servicioA}`)
        .expect(200);
      expect(res.body.map((e: { url: string }) => e.url)).toContain(evidenciaUrlA);
    });

    it('B sube evidencia al servicio de A: 403 y no queda archivo', async () => {
      const antes = await prisma.attachment.count();
      const res = await http()
        .post('/evidence')
        .set(bearer(tokenFor('ADMINISTRATIVO', INTEGRANTE_B)))
        .set('Idempotency-Key', randomUUID())
        .field('ownerType', 'SERVICE')
        .field('ownerId', servicioA)
        .attach('file', JPEG, { filename: 'x.jpg', contentType: 'image/jpeg' });
      noAsignado(res);
      await expect(prisma.attachment.count()).resolves.toBe(antes);
    });

    it.each([
      ['suspende', 'suspend', { reason: 'x' }],
      ['cierra', 'complete', undefined],
      ['informa una zona', 'zone-results', { zoneId: '', status: 'SERVICED' }],
    ])('B %s el servicio de A: 403 y el servicio no cambia', async (_n, accion, body) => {
      const antes = await prisma.service.findUniqueOrThrow({ where: { id: servicioA } });
      const payload = body && 'zoneId' in body ? { ...body, zoneId } : body;
      noAsignado(await campo(INTEGRANTE_B).post(`/services/${servicioA}/${accion}`, payload));
      const despues = await prisma.service.findUniqueOrThrow({ where: { id: servicioA } });
      expect(despues).toEqual(antes);
      expect(await prisma.zoneResult.count({ where: { serviceId: servicioA } })).toBe(0);
    });

    it('otro inspector cierra la inspección asignada a 9005: 403 y sigue abierta', async () => {
      const exp = await oficina.post('/environmental-reports', { reportType: 'NOISE' }).expect(201);
      await oficina.post(`/environmental-reports/${exp.body.id}/start-review`).expect(200);
      const id = (
        await oficina
          .post(`/environmental-reports/${exp.body.id}/inspections`, {
            inspectorId: ACTORES.inspector.userId,
          })
          .expect(201)
      ).body.id;

      const res = await campo(INSPECTOR_B).post(`/environmental-inspections/${id}/complete`, {
        inspectedAt: new Date().toISOString(),
        outcome: 'NO_VIOLATION',
      });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('NOT_ASSIGNED');
      const fila = await prisma.environmentalInspection.findUniqueOrThrow({ where: { id } });
      expect(fila.outcome).toBeNull();
    });

    it('/me devuelve solo lo del token, aunque se pida otro id por query', async () => {
      // /me no lee parámetros: la identidad sale solo del token firmado.
      const res = await campo(INTEGRANTE_B).get(`/me?userId=${INTEGRANTE_A}`).expect(200);
      expect(res.body.userId).toBe(INTEGRANTE_B);
      expect(JSON.stringify(res.body)).not.toContain(cuadrillaA);
    });

    it('un id inexistente es 404 (no confunde con 403 ni filtra nada)', async () => {
      const res = await campo(INTEGRANTE_B).get(
        `/evidence?ownerType=SERVICE&ownerId=${randomUUID()}`,
      );
      expect(res.status).toBe(404);
      sinFiltraciones(res);
    });
  });

  // ─── 4. Mass assignment ─────────────────────────────
  describe('mass assignment → 400 y nada persistido', () => {
    it.each([
      ['id propio', { id: randomUUID() }],
      ['createdAt', { createdAt: '2000-01-01T00:00:00.000Z' }],
      ['role', { role: 'M6_ADMIN' }],
    ])('POST /zones con %s', async (_n, extra) => {
      const code = `MA-${Math.floor(Math.random() * 1e6)}`;
      const res = await oficina.post('/zones', { code, name: 'x', ...extra });
      expect(res.status).toBe(400);
      sinFiltraciones(res);
      await expect(prisma.zone.count({ where: { code } })).resolves.toBe(0);
    });

    it('POST /services con status COMPLETED no crea un servicio cerrado', async () => {
      const antes = await prisma.service.count();
      const res = await oficina.post('/services', {
        serviceTypeId,
        scheduledDate: hoy(),
        origin: 'PLANNED',
        zoneId,
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
      });
      expect(res.status).toBe(400);
      await expect(prisma.service.count()).resolves.toBe(antes);
    });

    it('POST /environmental-reports con status y fecha de cierre ajenos', async () => {
      const antes = await prisma.environmentalReport.count();
      const res = await oficina.post('/environmental-reports', {
        reportType: 'NOISE',
        status: 'CLOSED',
        closedAt: new Date().toISOString(),
      });
      expect(res.status).toBe(400);
      await expect(prisma.environmentalReport.count()).resolves.toBe(antes);
    });

    it('PATCH /services/:id con status, crewId ajeno e id: 400 y la fila queda igual', async () => {
      const antes = await prisma.service.findUniqueOrThrow({ where: { id: servicioA } });
      const res = await oficina.patch(`/services/${servicioA}`, {
        notes: 'ok',
        status: 'CANCELLED',
        crewId: randomUUID(),
        id: randomUUID(),
      });
      expect(res.status).toBe(400);
      await expect(prisma.service.findUniqueOrThrow({ where: { id: servicioA } })).resolves.toEqual(
        antes,
      );
    });

    it('PUT /role-assignments con un rol fuera del catálogo: 400 y sin filas', async () => {
      const res = await new Api(app, tokenDe('admin')).put('/role-assignments/9099', {
        roles: ['SUPERADMIN'],
      });
      expect(res.status).toBe(400);
      await expect(prisma.userRoleAssignment.count({ where: { userId: '9099' } })).resolves.toBe(0);
    });
  });

  // ─── 5. Inyección ───────────────────────────────────
  describe('inyección SQL / NoSQL / XSS: sin ejecución ni 500', () => {
    const SQL = [
      "' OR '1'='1",
      "'; DROP TABLE service;--",
      '1 UNION SELECT * FROM user_role_assignment--',
    ];
    const XSS = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '"><svg onload=alert(1)>',
    ];

    it.each(SQL)('SQL en el id de la ruta (%s): 400, no 500', async (p) => {
      const res = await oficina.get(`/services/${encodeURIComponent(p)}`);
      expect(res.status).toBe(400);
      sinFiltraciones(res);
    });

    it.each(SQL)('SQL en el filtro de búsqueda (%s): no devuelve de más', async (p) => {
      const res = await oficina.get(`/zones?search=${encodeURIComponent(p)}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      await expect(prisma.service.count()).resolves.toBeGreaterThan(0);
    });

    it.each([...SQL, ...XSS])(
      'texto libre (%s) se guarda literal y vuelve como JSON',
      async (p) => {
        const res = await oficina.post('/environmental-reports', {
          reportType: 'ILLEGAL_DUMPSITE',
          address: p,
          description: p,
        });
        expect(res.status).toBe(201);
        expect(res.headers['content-type']).toMatch(/^application\/json/);
        expect(res.headers['content-security-policy']).toBe(API_CSP);
        const fila = await prisma.environmentalReport.findUniqueOrThrow({
          where: { id: res.body.id },
        });
        expect(fila.description).toBe(p);
        const leido = await oficina.get(`/environmental-reports/${res.body.id}`).expect(200);
        expect(leido.body.description).toBe(p);
      },
    );

    it('operadores NoSQL en el body ($gt, $ne): 400', async () => {
      const res = await oficina.post('/zones', { code: { $gt: '' }, name: { $ne: null } });
      expect(res.status).toBe(400);
      sinFiltraciones(res);
    });

    it('carácter nulo en un texto: 400', async () => {
      const res = await oficina.post('/zones', { code: 'NUL-1', name: 'a\u0000b' });
      expect(res.status).toBe(400);
      await expect(prisma.zone.count({ where: { code: 'NUL-1' } })).resolves.toBe(0);
    });
  });

  // ─── 6. Cabeceras y CORS ────────────────────────────
  describe('cabeceras de seguridad', () => {
    it('la API: CSP restrictiva, nosniff, DENY, no-referrer, Permissions-Policy, sin X-Powered-By', async () => {
      const res = await oficina.get('/zones').expect(200);
      expect(res.headers).toMatchObject({
        'content-security-policy': API_CSP,
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'referrer-policy': 'no-referrer',
        'cross-origin-resource-policy': 'same-site',
      });
      expect(res.headers['permissions-policy']).toContain('camera=()');
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('/api/docs: Swagger UI sirve con su CSP propia (DEF-19) y sus scripts cargan', async () => {
      const html = await http().get('/api/docs').expect(200);
      expect(html.headers['content-type']).toMatch(/text\/html/);
      expect(html.headers['content-security-policy']).toBe(DOCS_CSP);
      expect(html.headers['x-content-type-options']).toBe('nosniff');
      // Todo script de la página es un archivo propio: la CSP no permite scripts en línea.
      // Se recorre con indexOf y no con una regex de etiquetas (CodeQL js/bad-tag-filter).
      const texto = html.text.toLowerCase();
      let desde = texto.indexOf('<script');
      let scripts = 0;
      while (desde !== -1) {
        const cierre = texto.indexOf('>', desde);
        const fin = texto.indexOf('</script', cierre);
        expect(texto.slice(desde, cierre)).toMatch(/\ssrc="\.?\/?[\w./-]+"/);
        expect(texto.slice(cierre + 1, fin).trim()).toBe('');
        scripts += 1;
        desde = texto.indexOf('<script', fin);
      }
      expect(scripts).toBeGreaterThan(0);
      const init = await http().get('/api/docs/swagger-ui-init.js').expect(200);
      expect(init.headers['content-security-policy']).toBe(DOCS_CSP);
    });

    it('HSTS en producción', async () => {
      const previo = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const res = await http().get('/zones');
        expect(res.headers['strict-transport-security']).toMatch(/max-age=\d{7,}/);
      } finally {
        process.env.NODE_ENV = previo;
      }
    });

    it('CORS: el origen permitido se refleja, sin credenciales; con X-Request-Id expuesto', async () => {
      const res = await http()
        .options('/zones')
        .set('Origin', FRONT)
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'authorization');
      expect(res.headers['access-control-allow-origin']).toBe(FRONT);
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
      const get = await http()
        .get('/zones')
        .set('Origin', FRONT)
        .set(bearer(tokenDe('admin')));
      expect(get.headers['access-control-expose-headers']).toContain('X-Request-Id');
    });

    it('CORS: un origen ajeno no recibe Access-Control-Allow-Origin, y nunca *', async () => {
      const res = await http()
        .options('/zones')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'GET');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      const get = await http()
        .get('/zones')
        .set('Origin', 'https://evil.example')
        .set(bearer(tokenDe('admin')));
      expect(get.headers['access-control-allow-origin']).not.toBe('*');
    });
  });

  // ─── 7. Errores y logs ──────────────────────────────
  describe('errores sin stack y logs sin datos personales ni tokens', () => {
    it('un 500 devuelve Problem Details con traceId y sin stack; el log tiene el mismo traceId', async () => {
      const zonas = app.get(ZonesService);
      const falla = vi
        .spyOn(zonas, 'findAll')
        .mockRejectedValueOnce(new Error('Falla interna con SECRETO y /app/src/x.ts'));
      const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      try {
        const res = await oficina.get('/zones?search=DNI-30111222&page=1');
        expect(res.status).toBe(500);
        sinFiltraciones(res);
        expect(res.body).toMatchObject({ detail: 'Error interno del servidor', path: '/zones' });
        expect(JSON.stringify(res.body)).not.toMatch(/SECRETO|DNI-30111222|page=1/);

        const linea = log.mock.calls.map((c) => String(c[0])).find((l) => l.includes('traceId='));
        expect(linea).toContain(`[traceId=${res.body.traceId}]`);
        expect(linea).not.toContain('DNI-30111222');
      } finally {
        falla.mockRestore();
        log.mockRestore();
      }
    });

    it('ruta inexistente: 404 en Problem Details, sin stack', async () => {
      const res = await oficina.get('/no-existe');
      expect(res.status).toBe(404);
      sinFiltraciones(res);
    });

    it('JSON mal formado: 400 sin el detalle del parser', async () => {
      const res = await http()
        .post('/zones')
        .set(bearer(tokenDe('admin')))
        .set('Content-Type', 'application/json')
        .send('{"code": "x",');
      expect(res.status).toBe(400);
      sinFiltraciones(res);
    });

    it('el log HTTP no registra el Authorization ni el token de la query', async () => {
      const token = tokenDe('admin');
      const escrito: string[] = [];
      const captura = (s: unknown) => {
        escrito.push(String(s));
        return true;
      };
      const out = vi.spyOn(process.stdout, 'write').mockImplementation(captura);
      const err = vi.spyOn(process.stderr, 'write').mockImplementation(captura);
      const log = vi.spyOn(Logger.prototype, 'log');
      try {
        // Uno que entra (lo registra el LoggingInterceptor) y uno con el token en la query.
        await http().get('/zones?search=x').set(bearer(token)).expect(200);
        await http().get('/zones?access_token=TOKEN-EN-QUERY&apiKey=CLAVE').set(bearer(token));
      } finally {
        out.mockRestore();
        err.mockRestore();
      }
      const todo = [...escrito, ...log.mock.calls.map((c) => String(c[0]))].join('\n');
      log.mockRestore();
      expect(todo).toContain('GET /zones?search=x');
      for (const secreto of [token, token.split('.')[2], 'TOKEN-EN-QUERY', 'CLAVE']) {
        expect(todo).not.toContain(secreto);
      }
    });
  });
});
