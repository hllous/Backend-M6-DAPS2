/**
 * Whitelist de tipos de archivo aceptados para evidencia.
 *
 * La extensión con la que se persiste `Attachment.filename` siempre se deriva
 * del `mimetype` reportado por Multer (no del nombre original que mandó el
 * cliente), así el mapeo inverso extensión→contentType es 100% confiable al
 * leer — ver nota en `evidence-response.dto.ts` sobre por qué no hay columna
 * `contentType` en la tabla.
 */
export const EVIDENCE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export const EVIDENCE_MIME_BY_EXTENSION: Record<string, string> = Object.fromEntries(
  Object.entries(EVIDENCE_EXTENSION_BY_MIME).map(([mime, ext]) => [ext, mime]),
);

export const MAX_EVIDENCE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
