export interface UploadedObject {
  url: string;
}

/**
 * Puerto de storage para evidencia. La implementación real (Cloudflare R2,
 * S3-compatible) vive en `r2-evidence.storage.ts`; este puerto existe para no
 * acoplar `AttachmentsService` a un proveedor concreto.
 */
export interface EvidenceStorage {
  upload(params: { buffer: Buffer; key: string; contentType: string }): Promise<UploadedObject>;

  /**
   * Borra un objeto ya subido.
   *
   * Existe por una sola razón: el archivo se sube **antes** de escribir la fila,
   * así que si la escritura no prospera el objeto queda en el bucket sin que
   * nadie lo referencie nunca. No falla si el objeto no está.
   */
  remove(key: string): Promise<void>;
}

export const EVIDENCE_STORAGE = Symbol('EVIDENCE_STORAGE');
