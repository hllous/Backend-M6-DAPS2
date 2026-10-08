import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Pedimos otro token un minuto antes de que venza, no cuando ya venció. */
const MARGEN_RENOVACION_MS = 60_000;
const TIMEOUT_MS = 10_000;

interface CoreConfig {
  apiUrl?: string;
  moduleId: string;
  moduleSecret?: string;
}

/**
 * Cliente de la API REST del Core (M9) con token de módulo.
 *
 * El token dura 15 minutos y no tiene refresh: cuando vence se pide otro con el
 * secret de máquina. Lo valida solo el Core; acá no se mira su contenido.
 *
 * Sin `CORE_API_URL` el cliente queda deshabilitado y la app arranca igual: es
 * la situación real hasta que M9 publique la URL de cada ambiente.
 */
@Injectable()
export class CoreClient {
  private readonly config: CoreConfig;
  private readonly baseUrl?: string;
  /** El token vigente o el pedido en vuelo, compartido entre llamadas concurrentes. */
  private token?: Promise<string>;
  /** Infinito mientras el pedido está en vuelo: no se pide otro hasta que vuelva. */
  private renovarDesde = 0;

  constructor(config: ConfigService) {
    this.config = config.getOrThrow<CoreConfig>('core');
    this.baseUrl = this.config.apiUrl?.replace(/\/+$/, '');
  }

  get enabled(): boolean {
    return Boolean(this.baseUrl);
  }

  getToken(): Promise<string> {
    if (!this.baseUrl) {
      return Promise.reject(new Error('Cliente del Core deshabilitado: falta CORE_API_URL'));
    }
    if (!this.token || Date.now() >= this.renovarDesde) {
      this.renovarDesde = Infinity;
      const pedido: Promise<string> = this.pedirToken().then(
        ({ accessToken, expiresIn }) => {
          if (this.token === pedido) {
            this.renovarDesde = Date.now() + expiresIn * 1000 - MARGEN_RENOVACION_MS;
          }
          return accessToken;
        },
        (err: unknown) => {
          // Sin esto un pedido fallido quedaría cacheado y nunca se reintentaría.
          if (this.token === pedido) this.token = undefined;
          throw err;
        },
      );
      this.token = pedido;
    }
    return this.token;
  }

  /**
   * Llama al Core con `Authorization: Bearer`. Ante un 401 (token revocado, o
   * reloj del Core adelantado) pide otro token y reintenta una vez. El `body`
   * tiene que poder mandarse dos veces: un string sí, un stream no.
   */
  async request(path: string, init: RequestInit = {}): Promise<Response> {
    const pedido = this.getToken();
    const res = await this.fetchConToken(path, init, await pedido);
    if (res.status !== 401) return res;

    // Si otra llamada ya lo renovó, no lo tiramos: reusamos el nuevo.
    if (this.token === pedido) this.token = undefined;
    return this.fetchConToken(path, init, await this.getToken());
  }

  private fetchConToken(path: string, init: RequestInit, token: string): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return this.fetch(path, { ...init, headers });
  }

  private async pedirToken(): Promise<{ accessToken: string; expiresIn: number }> {
    let res: Response;
    try {
      res = await this.fetch('/api/v1/auth/module-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: this.config.moduleId,
          secret: this.config.moduleSecret,
        }),
      });
    } catch (err) {
      // En el mensaje va solo el nombre (TimeoutError, TypeError de red). El
      // `cause` de fetch dice por qué falló la conexión y no trae el body.
      // Error con cause recién desde ES2022 y el tsconfig apunta a ES2021.
      throw Object.assign(
        new Error(`No se pudo pedir el token de módulo al Core (${(err as Error).name})`),
        { cause: err },
      );
    }
    if (!res.ok) {
      throw new Error(`El Core rechazó el pedido de token de módulo (HTTP ${res.status})`);
    }
    // El SyntaxError de V8 cita el texto recibido, y ese texto puede traer el token.
    const body = (await res.json().catch(() => ({}))) as {
      accessToken?: unknown;
      expiresIn?: unknown;
    };
    if (typeof body.accessToken !== 'string' || typeof body.expiresIn !== 'number') {
      throw new Error('El Core devolvió un token de módulo sin accessToken o expiresIn');
    }
    return { accessToken: body.accessToken, expiresIn: body.expiresIn };
  }

  private fetch(path: string, init: RequestInit): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  }
}
