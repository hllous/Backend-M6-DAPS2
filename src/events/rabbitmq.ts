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

/**
 * El usuario de la URL, sin la clave. Va como `userId` de cada mensaje: M9
 * verifica ese campo contra el `sourceModule` del sobre cuando despliegue el
 * broker (hoy por AMQP no valida la identidad). RabbitMQ rechaza un `userId`
 * distinto del usuario autenticado, así que sacarlo de la URL no lo contradice.
 */
export function brokerUser(url: string): string | undefined {
  try {
    const { username } = new URL(url);
    return username ? decodeURIComponent(username) : undefined;
  } catch {
    return undefined;
  }
}
