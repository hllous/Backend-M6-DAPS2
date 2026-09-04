import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { EvidenceStorage, UploadedObject } from './evidence-storage.interface';

/**
 * Sube evidencia a Cloudflare R2 vía el protocolo S3-compatible.
 * Credenciales: R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET.
 * R2_PUBLIC_URL_BASE es el dominio público (custom domain o r2.dev) que sirve
 * el bucket — la URL que persiste `Attachment.url` se arma con ese base + key.
 */
@Injectable()
export class R2EvidenceStorage implements EvidenceStorage {
  private readonly logger = new Logger(R2EvidenceStorage.name);
  private readonly client: S3Client;
  private readonly bucket?: string;
  private readonly publicUrlBase?: string;

  constructor(private readonly config: ConfigService) {
    const accountId = this.config.get<string>('r2.accountId');
    this.bucket = this.config.get<string>('r2.bucket');
    this.publicUrlBase = this.config.get<string>('r2.publicUrlBase');

    this.client = new S3Client({
      region: 'auto',
      endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined,
      credentials: {
        accessKeyId: this.config.get<string>('r2.accessKeyId') ?? '',
        secretAccessKey: this.config.get<string>('r2.secretAccessKey') ?? '',
      },
    });
  }

  async upload(params: {
    buffer: Buffer;
    key: string;
    contentType: string;
  }): Promise<UploadedObject> {
    if (!this.bucket || !this.publicUrlBase) {
      throw new InternalServerErrorException(
        'Storage de evidencia no configurado (faltan R2_BUCKET / R2_PUBLIC_URL_BASE)',
      );
    }

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: params.key,
          Body: params.buffer,
          ContentType: params.contentType,
        }),
      );
    } catch (error) {
      this.logger.error(`Falló la subida a R2 (key=${params.key})`, error as Error);
      throw new InternalServerErrorException('No se pudo subir el archivo de evidencia');
    }

    return { url: `${this.publicUrlBase.replace(/\/$/, '')}/${params.key}` };
  }

  /**
   * Se llama cuando la fila no se pudo escribir después de subir el archivo.
   * No relanza: el error que importa es el de la escritura, no el de la
   * limpieza, y tapar uno con el otro deja al cliente sin saber qué pasó.
   */
  async remove(key: string): Promise<void> {
    if (!this.bucket) return;

    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      this.logger.warn(`No se pudo borrar el objeto huérfano ${key} de R2`, error as Error);
    }
  }
}
