// Subcadena sobre el nombre decodificado: cubre api-key, x-api-key, client_secret,
// access_token, token[], pwd, etc. "sig" va anclado para no tocar p. ej. "assignedTo".
const SENSITIVE_PARAM =
  /(token|secret|passw|pwd|key|auth|jwt|bearer|session)|(^|[^a-z])sig(nature)?$|^sig(nature)?/i;

/**
 * Reemplaza el valor de los parámetros sensibles de la query; el resto de la URL
 * queda igual. Se usa en logs y en el `path` de las respuestas de error, que
 * rebotan la URL al cliente y a cualquier proxy que las registre.
 */
export function redactUrl(url: string): string {
  const i = url.indexOf('?');
  if (i === -1) return url;
  const query = url
    .slice(i + 1)
    .split('&')
    .map((pair) => {
      const name = pair.split('=')[0];
      // Un nombre con % mal formado no debe tirar el request: se compara tal cual.
      let decoded = name;
      try {
        decoded = decodeURIComponent(name);
      } catch {
        // se usa el nombre crudo
      }
      return SENSITIVE_PARAM.test(decoded) ? `${name}=[REDACTED]` : pair;
    })
    .join('&');
  return `${url.slice(0, i)}?${query}`;
}
