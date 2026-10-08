/**
 * Tope del handshake. Sin él, un broker que acepta el TCP y no responde deja
 * colgado al dispatcher.
 */
export const CONNECT_TIMEOUT_MS = 10_000;

/** La sección `rabbitmq` de `configuration.ts`, con la URL ya garantizada. */
export interface RabbitMqConfig {
  url: string;
  exchange: string;
  queue: string;
  prefetch: number;
}

/**
 * Host y vhost, sin usuario ni clave: la URL lleva el secreto y los logs de
 * Render los ve cualquiera con acceso al panel.
 */
export function brokerHost(url: string): string {
  try {
    const { protocol, host, pathname } = new URL(url);
    return `${protocol}//${host}${pathname}`;
  } catch {
    return '(URL de RabbitMQ ilegible)';
  }
}
