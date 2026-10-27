import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { CoreClient } from './core.client';

/** Un barrio del catálogo de M9 (`GET /api/v1/catalogos/barrios`). */
export interface Barrio {
  id: string;
  codigo: string;
  nombre: string;
  zona: string;
  zonaNombre: string;
  metadatos?: Record<string, unknown> | null;
  activo: boolean;
}

const RENOVAR_CADA_MS = 6 * 60 * 60 * 1000;
/** Si todavía no hay catálogo, reintenta antes que la renovación normal. */
const REINTENTO_MS = 60_000;
const PATH = '/api/v1/catalogos/barrios';

/**
 * Catálogo de barrios de M9, leído al arrancar y renovado cada tanto.
 *
 * Es de solo lectura y chico (48 barrios de CABA), así que vive en memoria. Si el
 * Core no responde o no hay CORE_API_URL la app sigue: `disponible` queda en false
 * y quien lo consulta degrada. Nada se borra en M9 (baja = `activo:false`), por lo
 * que un id guardado nunca deja de existir en el catálogo.
 */
@Injectable()
export class NeighborhoodsCatalogService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(NeighborhoodsCatalogService.name);
  private barrios: Barrio[] | undefined;
  private timer?: NodeJS.Timeout;
  private cerrado = false;

  constructor(private readonly core: CoreClient) {}

  onApplicationBootstrap(): void {
    if (!this.core.enabled) {
      this.logger.warn('Sin CORE_API_URL: el catálogo de barrios no se carga');
      return;
    }
    // Sin await: un Core caído no puede demorar ni tumbar el arranque.
    void this.refrescar();
  }

  onModuleDestroy(): void {
    this.cerrado = true;
    clearTimeout(this.timer);
  }

  get disponible(): boolean {
    return this.barrios !== undefined;
  }

  /** Vacío si el catálogo todavía no se pudo leer; ver `disponible`. */
  list(filtro: { soloActivos?: boolean; zona?: string; q?: string } = {}): Barrio[] {
    const q = filtro.q?.trim().toLowerCase();
    return (this.barrios ?? []).filter(
      (b) =>
        (!filtro.soloActivos || b.activo) &&
        (!filtro.zona || b.zona === filtro.zona) &&
        (!q || b.nombre.toLowerCase().includes(q) || b.codigo.includes(q)),
    );
  }

  /** `undefined` si no hay catálogo: no se puede afirmar nada. */
  existe(id: string): boolean | undefined {
    return this.barrios?.some((b) => b.id === id);
  }

  async refrescar(): Promise<void> {
    let proximo = RENOVAR_CADA_MS;
    try {
      const res = await this.core.request(PATH);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json().catch(() => undefined)) as unknown;
      const lista = Array.isArray(body) ? body : (body as { data?: unknown } | undefined)?.data;
      if (!Array.isArray(lista)) throw new Error('la respuesta no es una lista');
      this.barrios = lista.filter(esBarrio);
      this.logger.log(`Catálogo de barrios cargado: ${this.barrios.length}`);
    } catch (err) {
      // Solo el mensaje: el error de fetch puede arrastrar URL o cabeceras.
      this.logger.warn(
        `No se pudo leer el catálogo de barrios del Core: ${(err as Error).message}`,
      );
      // Con un catálogo viejo en memoria se sigue usando; sin ninguno se reintenta pronto.
      if (!this.barrios) proximo = REINTENTO_MS;
    }
    if (this.cerrado) return;
    this.timer = setTimeout(() => void this.refrescar(), proximo);
    this.timer.unref();
  }
}

function esBarrio(b: unknown): b is Barrio {
  const x = b as Partial<Barrio> | null;
  return (
    typeof x?.id === 'string' &&
    typeof x.codigo === 'string' &&
    typeof x.nombre === 'string' &&
    typeof x.activo === 'boolean'
  );
}
