export interface UploadedObject {
  url: string;
}

/**
 * Puerto de storage para evidencia. La implementación real (Cloudflare R2,
 * S3-compatible) vive en `r2-evidence-storage.service.ts`; este puerto existe
 * para no acoplar `AttachmentsService` a un proveedor concreto.
 */
export interface EvidenceStorage {
  upload(params: { buffer: Buffer; key: string; contentType: string }): Promise<UploadedObject>;
}

export const EVIDENCE_STORAGE = Symbol('EVIDENCE_STORAGE');
