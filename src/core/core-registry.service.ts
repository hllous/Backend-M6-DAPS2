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
/** Forma de un nombre de evento (camelCase, tope 60 como el Core) y cuántas entradas se leen. */
const EVENT_TYPE = /^[A-Za-z][A-Za-z0-9]{0,59}$/;
const MAX_ENTRADAS = 200;

export interface RegistroResultado {
  suscripcionesCreadas: string[];
  publicacionesCreadas: string[];
  /** Registrado en el Core a nombre de M6 y que el código ya no declara. Se loguea, no se borra. */
  sobrantes: string[];
}

/** Lo que `sync()` haría, sin hacerlo. Las «Inactivas» también figuran en las «Creadas»: el POST las reactiva. */
export interface PlanRegistro extends RegistroResultado {
  suscripcionesYaActivas: string[];
  publicacionesYaActivas: string[];
  suscripcionesInactivas: string[];
  publicacionesInactivas: string[];
}

export interface BajaResultado {
  eventType: string;
  estado: 'simulacro' | 'baja' | 'no-suscripto' | 'error';
  /** Suscripciones propias de ese tipo (puede haber más de una). */
  cantidad?: number;
  detalle?: string;
}

/** El id va al path del DELETE: solo formas inocuas. */
const ID_CORE = /^[A-Za-z0-9_-]{1,64}$/;

interface Listado {
  activos: Set<string>;
  inactivos: Set<string>;
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

  /** Registro real: consulta, crea lo que falta y loguea. */
  async sync(): Promise<RegistroResultado> {
    const { maxAttempts, plan } = await this.planificar();
    const { suscripcionesCreadas, publicacionesCreadas, sobrantes } = plan;
    for (const eventType of suscripcionesCreadas) {
      await this.crear('/api/v1/subscriptions', { eventType, maxAttempts });
    }
    for (const eventType of publicacionesCreadas) {
      await this.crear('/api/v1/publications', { eventType });
    }
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

  /**
   * Simulacro: el mismo plan que `sync()` ejecutaría, solo con GET. Desde acá no
   * hay camino a `crear()`; el spec lo verifica contra el Core simulado.
   */
  async simular(): Promise<PlanRegistro> {
    return (await this.planificar()).plan;
  }

  /**
   * Baja de suscripciones sobrantes, solo las pedidas por nombre (nunca "todos los
   * sobrantes"). Rechaza, antes de tocar el Core, un nombre inválido o uno que M6
   * declara hoy. Sin `apply` solo hace GET. Un tipo que no está suscripto se
   * informa y se sigue; un error HTTP queda en su resultado y no frena al resto.
   */
  async darDeBaja(tipos: string[], apply: boolean): Promise<BajaResultado[]> {
    const vigentes: string[] = [...Object.values(ConsumedEvent), ...Object.values(EventType)];
    for (const t of tipos) {
      if (!EVENT_TYPE.test(t)) {
        throw new Error('Tipo de evento inválido (letras y dígitos, hasta 60, empieza con letra)');
      }
      if (vigentes.includes(t))
        throw new Error(`${t} está declarado por M6: no se da de baja lo vigente`);
    }
    const modulo = this.config.get<string>('core.moduleId', 'ambiente');
    const res = await this.core.request('/api/v1/subscriptions');
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      throw new Error(`GET /api/v1/subscriptions respondió HTTP ${res.status}`);
    }
    const body = (await res.json().catch(() => undefined)) as
      { data?: unknown; items?: unknown } | unknown[] | undefined;
    const lista = Array.isArray(body) ? body : (body?.data ?? body?.items);
    if (!Array.isArray(lista)) {
      throw new Error('GET /api/v1/subscriptions devolvió algo que no es una lista');
    }

    const entradas = lista as { eventType?: unknown; moduleName?: unknown; id?: unknown }[];
    const out: BajaResultado[] = [];
    for (const eventType of [...new Set(tipos)]) {
      // moduleName estricto: una entrada sin dueño claro no se toca. `active` no
      // se mira: una suscripción inactiva también se baja.
      const propias = entradas.filter((x) => x?.eventType === eventType && x.moduleName === modulo);
      if (!propias.length) {
        out.push({ eventType, estado: 'no-suscripto' });
        continue;
      }
      const errores: string[] = [];
      for (const e of propias) {
        const id = typeof e.id === 'number' ? String(e.id) : e.id;
        if (typeof id !== 'string' || !ID_CORE.test(id)) {
          errores.push('la suscripción no trae un id utilizable');
          continue;
        }
        if (!apply) continue;
        try {
          const del = await this.core.request(`/api/v1/subscriptions/${encodeURIComponent(id)}`, {
            method: 'DELETE',
          });
          await del.body?.cancel().catch(() => undefined);
          if (!del.ok) errores.push(`DELETE respondió HTTP ${del.status}`);
        } catch (err) {
          // Solo el name (como CoreClient): el message de fetch puede citar la URL.
          errores.push(`DELETE falló (${(err as Error).name})`);
        }
      }
      out.push({
        eventType,
        cantidad: propias.length,
        estado: errores.length ? 'error' : apply ? 'baja' : 'simulacro',
        ...(errores.length ? { detalle: errores.join('; ') } : {}),
      });
    }
    return out;
  }

  private async planificar(): Promise<{ maxAttempts: number; plan: PlanRegistro }> {
    const maxAttempts = this.config.get<number>('core.subscriptionMaxAttempts', 4);
    const modulo = this.config.get<string>('core.moduleId', 'ambiente');
    const subs = await this.listar('/api/v1/subscriptions', modulo);
    const pubs = await this.listar('/api/v1/publications', modulo);

    const deseadasSubs: string[] = Object.values(ConsumedEvent).filter(
      (e) => !SIN_PUBLICADOR.includes(e),
    );
    const deseadasPubs: string[] = Object.values(EventType);

    const sobrantes = [
      ...[...subs.activos].filter((e) => !deseadasSubs.includes(e)).map((e) => `suscripción ${e}`),
      ...[...pubs.activos].filter((e) => !deseadasPubs.includes(e)).map((e) => `publicación ${e}`),
    ];
    return {
      maxAttempts,
      plan: {
        suscripcionesCreadas: deseadasSubs.filter((e) => !subs.activos.has(e)),
        publicacionesCreadas: deseadasPubs.filter((e) => !pubs.activos.has(e)),
        suscripcionesYaActivas: deseadasSubs.filter((e) => subs.activos.has(e)),
        publicacionesYaActivas: deseadasPubs.filter((e) => pubs.activos.has(e)),
        suscripcionesInactivas: deseadasSubs.filter(
          (e) => subs.inactivos.has(e) && !subs.activos.has(e),
        ),
        publicacionesInactivas: deseadasPubs.filter(
          (e) => pubs.inactivos.has(e) && !pubs.activos.has(e),
        ),
        sobrantes,
      },
    };
  }

  private async syncConReintentos(intento: number): Promise<void> {
    try {
      await this.sync();
    } catch (err) {
      // App cerrándose: el fallo es esperable y no merece un error en el log.
      if (this.cerrado) return;
      const msg = (err as Error).message;
      if (intento >= INTENTOS_MAX) {
        this.logger.error(`Registro en el Core abandonado tras ${intento} intentos: ${msg}`);
        return;
      }
      const espera = Math.min(ESPERA_INICIAL_MS * 3 ** (intento - 1), ESPERA_MAX_MS);
      this.logger.warn(`Registro en el Core falló (${msg}); reintento en ${espera / 1000} s`);
      this.timer = setTimeout(() => void this.syncConReintentos(intento + 1), espera);
      this.timer.unref();
    }
  }

  /**
   * Los `eventType` ya registrados **a nombre de M6 y activos**. Acepta un array
   * (la forma real del Core) o `{ data | items: [...] }`.
   *
   * `GET /publications` devuelve las de TODOS los módulos (M9, 22/10): una
   * entrada de otro módulo no cuenta como nuestra, o M6 creería tener declarado
   * un tipo que otro declaró y nunca se registraría. Una entrada `active: false`
   * cuenta como faltante: el POST repetido la reactiva.
   */
  private async listar(path: string, modulo: string): Promise<Listado> {
    const res = await this.core.request(path);
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      throw new Error(`GET ${path} respondió HTTP ${res.status}`);
    }
    const body = (await res.json().catch(() => undefined)) as
      { data?: unknown; items?: unknown; meta?: { total?: unknown } } | unknown[] | undefined;
    const lista = Array.isArray(body) ? body : (body?.data ?? body?.items);
    if (!Array.isArray(lista)) throw new Error(`GET ${path} devolvió algo que no es una lista`);
    // Una página parcial haría creer que falta lo que ya existe, y el POST
    // repetido reactiva la suscripción y pisa su maxAttempts.
    const total = Array.isArray(body) ? undefined : body?.meta?.total;
    if (typeof total === 'number' && total > lista.length) {
      throw new Error(
        `GET ${path} devolvió ${lista.length} de ${total}: respuesta paginada, no se crea nada`,
      );
    }
    // Única fuente no confiable que llega a los logs (los sobrantes): solo
    // pasan nombres con forma de evento y se corta la lista.
    const out: Listado = { activos: new Set(), inactivos: new Set() };
    for (const x of lista.slice(0, MAX_ENTRADAS)) {
      const e = x as { eventType?: unknown; moduleName?: unknown; active?: unknown } | null;
      if (typeof e?.moduleName === 'string' && e.moduleName !== modulo) continue;
      if (typeof e?.eventType !== 'string' || !EVENT_TYPE.test(e.eventType)) continue;
      (e.active === false ? out.inactivos : out.activos).add(e.eventType);
    }
    return out;
  }

  private async crear(path: string, body: Record<string, unknown>): Promise<void> {
    const res = await this.core.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      throw new Error(`POST ${path} (${String(body.eventType)}) respondió HTTP ${res.status}`);
    }
  }
}
