import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { CoreClient } from '../core/core.client';
import {
  CitizenRecord,
  IdentityPort,
  IdentityRecord,
  IdentityUnavailableError,
  OrganizationRecord,
} from './identity.port';

const TIMEOUT_MS = 10_000;

const identitySchema = z.object({
  sub: z.string(),
  actorType: z.string(),
  actorId: z.guid(),
  nombre: z.string(),
  apellido: z.string(),
  estado: z.string(),
});
// Ciudadanos y organizaciones: sin muestra real, solo lo mínimo; el resto pasa.
const directorySchema = z
  .object({ id: z.string().optional(), uuid: z.string().optional(), estado: z.string().optional() })
  .passthrough();

const uuidSchema = z.guid();
/** Un id no UUID no llega a M1 (path traversal con '.', '..', '/'). Error de argumento, no de M1. */
function assertUuid(id: string, campo: string): void {
  if (!uuidSchema.safeParse(id).success) throw new TypeError(`${campo} debe ser un UUID`);
}

/**
 * Adaptador HTTP a M1 (ADR-009). Manda el module-token del Core como Bearer
 * directo; M1 lo valida con la clave pública de M9 solo en `/integraciones/v1/**`.
 *
 * Sin `M1_BASE_URL` queda deshabilitado y la app arranca igual.
 */
@Injectable()
export class M1IdentityClient extends IdentityPort {
  private readonly baseUrl?: string;

  constructor(
    config: ConfigService,
    private readonly core: CoreClient,
  ) {
    super();
    this.baseUrl = config.getOrThrow<{ baseUrl?: string }>('m1').baseUrl?.replace(/\/+$/, '');
  }

  get enabled(): boolean {
    return Boolean(this.baseUrl);
  }

  async findEmployeeBySub(sub: string): Promise<IdentityRecord | null> {
    const q = new URLSearchParams({ actorType: 'EMPLEADO', sub });
    const record = await this.get(`/integraciones/v1/actores?${q}`, identitySchema);
    // Un directorio que contesta por otro empleado no se puede usar como respuesta.
    if (record && record.sub !== sub) {
      throw new IdentityUnavailableError('M1 devolvió un registro de otro sub');
    }
    return record;
  }

  findCitizenById(id: string): Promise<CitizenRecord | null> {
    assertUuid(id, 'id de ciudadano');
    return this.get(`/integraciones/v1/ciudadanos/${id}`, directorySchema);
  }

  findOrganizationById(id: string): Promise<OrganizationRecord | null> {
    assertUuid(id, 'id de organización');
    return this.get(`/integraciones/v1/organizaciones/${id}`, directorySchema);
  }

  findOrganizationByCuit(cuit: string): Promise<OrganizationRecord | null> {
    return this.get(
      `/integraciones/v1/organizaciones?${new URLSearchParams({ cuit })}`,
      directorySchema,
    );
  }

  /** `null` solo ante 404. Todo lo demás que no sea 2xx es un error tipado. */
  private async get<S extends z.ZodTypeAny>(path: string, schema: S): Promise<z.infer<S> | null> {
    if (!this.baseUrl) {
      throw new IdentityUnavailableError('Cliente de M1 deshabilitado: falta M1_BASE_URL');
    }
    let token: string;
    try {
      token = await this.core.getToken();
    } catch {
      // El error del Core no se propaga: no hace falta y evita arrastrar su cause.
      throw new IdentityUnavailableError('No se pudo obtener el token de módulo del Core');
    }
    let res: Response;
    try {
      // `redirect: 'error'`: un 307/308 reenviaría el Bearer a donde diga el Location.
      res = await fetch(`${this.baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      // Solo el nombre del error (TimeoutError, TypeError de red): sin cause ni texto.
      throw new IdentityUnavailableError(`No se pudo consultar a M1 (${(err as Error).name})`);
    }
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new IdentityUnavailableError(`M1 respondió HTTP ${res.status}`, res.status);
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      // El SyntaxError de V8 cita el texto recibido.
      throw new IdentityUnavailableError('M1 devolvió un cuerpo que no es JSON', res.status);
    }
    const parsed = schema.safeParse(body);
    // Sin el detalle de zod: cita los valores recibidos.
    if (!parsed.success) {
      throw new IdentityUnavailableError('M1 devolvió un cuerpo con forma inválida', res.status);
    }
    return parsed.data;
  }
}
