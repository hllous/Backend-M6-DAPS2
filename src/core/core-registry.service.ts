import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsumedEvent } from '../events/inbox/consumed-events';
import { EventType } from '../events/event-types';
import { CoreClient } from './core.client';

/**
 * Consumidos que no se registran: nadie los publica (los simulamos), y una
 * suscripción a un tipo sin publicador solo ensucia el mapa del Core.
 */
const SIN_PUBLICADOR: readonly string[] = [ConsumedEvent.WEATHER_ALERT_ISSUED];

/** Backoff entre intentos de la sincronización al arrancar: 5 s, 15 s, 45 s... tope 5 min. */
const ESPERA_INICIAL_MS = 5_000;
const ESPERA_MAX_MS = 300_000;
const INTENTOS_MAX = 6;

export interface RegistroResultado {
  suscripcionesCreadas: string[];
  publicacionesCreadas: string[];
  /** Registrado en el Core a nombre de M6 y que el código ya no declara. Se loguea, no se borra. */
  sobrantes: string[];
}

/**
 * Registra en el catálogo del Core lo que M6 consume y publica. Las listas
 * salen de `ConsumedEvent` y `EventType`: agregar un evento lo registra solo.
 *
 * Consulta antes de crear: un POST repetido responde 201 pero reactiva la
 * suscripción y pisa su `maxAttempts`, así que nunca se hace a ciegas.
 */
@Injectable()
export class CoreRegistryService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(CoreRegistryService.name);
  private timer?: NodeJS.Timeout;
  private cerrado = false;

  constructor(
    private readonly core: CoreClient,
    private readonly config: ConfigService,
  ) {}

  /** No espera: una falla del Core no tiene que demorar ni tirar el arranque. */
  onApplicationBootstrap(): void {
    if (!this.core.enabled) return;
    if (!this.config.get<boolean>('core.registerOnBoot', true)) {
      this.logger.log('Registro en el Core desactivado (CORE_REGISTER_ON_BOOT=false)');
      return;
    }
    void this.syncConReintentos(1);
  }

  onModuleDestroy(): void {
    this.cerrado = true;
    clearTimeout(this.timer);
  }

  async sync(): Promise<RegistroResultado> {
    const maxAttempts = this.config.get<number>('core.subscriptionMaxAttempts', 4);
    const subs = await this.listar('/api/v1/subscriptions');
    const pubs = await this.listar('/api/v1/publications');

    const deseadasSubs: string[] = Object.values(ConsumedEvent).filter(
      (e) => !SIN_PUBLICADOR.includes(e),
    );
    const deseadasPubs: string[] = Object.values(EventType);

    const suscripcionesCreadas = deseadasSubs.filter((e) => !subs.has(e));
    const publicacionesCreadas = deseadasPubs.filter((e) => !pubs.has(e));
    for (const eventType of suscripcionesCreadas) {
      await this.crear('/api/v1/subscriptions', { eventType, maxAttempts });
    }
    for (const eventType of publicacionesCreadas) {
      await this.crear('/api/v1/publications', { eventType });
    }

    const sobrantes = [
      ...[...subs].filter((e) => !deseadasSubs.includes(e)).map((e) => `suscripción ${e}`),
      ...[...pubs].filter((e) => !deseadasPubs.includes(e)).map((e) => `publicación ${e}`),
    ];
    if (sobrantes.length) {
      this.logger.warn(
        `Registrado en el Core y ya no declarado por M6 (no se borra, retirarlo con DELETE): ${sobrantes.join(', ')}`,
      );
    }
    this.logger.log(
      `Registro en el Core: ${suscripcionesCreadas.length} suscripciones y ${publicacionesCreadas.length} publicaciones nuevas`,
    );
    return { suscripcionesCreadas, publicacionesCreadas, sobrantes };
  }

  private async syncConReintentos(intento: number): Promise<void> {
    try {
      await this.sync();
    } catch (err) {
      const msg = (err as Error).message;
      if (this.cerrado || intento >= INTENTOS_MAX) {
        this.logger.error(`Registro en el Core abandonado tras ${intento} intentos: ${msg}`);
        return;
      }
      const espera = Math.min(ESPERA_INICIAL_MS * 3 ** (intento - 1), ESPERA_MAX_MS);
      this.logger.warn(`Registro en el Core falló (${msg}); reintento en ${espera / 1000} s`);
      this.timer = setTimeout(() => void this.syncConReintentos(intento + 1), espera);
      this.timer.unref();
    }
  }

  /** Los `eventType` ya registrados. Acepta un array o `{ data | items: [...] }`. */
  private async listar(path: string): Promise<Set<string>> {
    const res = await this.core.request(path);
    if (!res.ok) throw new Error(`GET ${path} respondió HTTP ${res.status}`);
    const body = (await res.json().catch(() => undefined)) as
      { data?: unknown; items?: unknown } | unknown[] | undefined;
    const lista = Array.isArray(body) ? body : (body?.data ?? body?.items);
    if (!Array.isArray(lista)) throw new Error(`GET ${path} devolvió algo que no es una lista`);
    return new Set(
      lista
        .map((x) => (x as { eventType?: unknown } | null)?.eventType)
        .filter((e): e is string => typeof e === 'string'),
    );
  }

  private async crear(path: string, body: Record<string, unknown>): Promise<void> {
    const res = await this.core.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`POST ${path} (${String(body.eventType)}) respondió HTTP ${res.status}`);
    }
  }
}
