/**
 * Whitelist de tipos aceptados para evidencia.
 *
 * La extensión con la que se persiste `Attachment.filename` sale de acá y no
 * del nombre que mandó el cliente, así el archivo del bucket y la fila siempre
 * coinciden en tipo. Que el `mimetype` declarado sea el real lo verifica
 * `sniffMime` mirando los bytes — ver `evidence-file.ts`.
 */
export const EVIDENCE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export const MAX_EVIDENCE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
