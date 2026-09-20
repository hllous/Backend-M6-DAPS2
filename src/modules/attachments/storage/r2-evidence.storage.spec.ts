import { InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { R2EvidenceStorage } from './r2-evidence.storage';

const sendMock = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

describe('R2EvidenceStorage', () => {
  const configured = (overrides: Record<string, string | undefined> = {}) => {
    const values: Record<string, string | undefined> = {
      'r2.accountId': 'acc-1',
      'r2.bucket': 'evidencia',
      'r2.publicUrlBase': 'https://cdn.example.com/',
      'r2.accessKeyId': 'key',
      'r2.secretAccessKey': 'secret',
      ...overrides,
    };
    return { get: jest.fn((key: string) => values[key]) } as unknown as ConfigService;
  };

  beforeEach(() => {
    sendMock.mockReset();
    (S3Client as jest.Mock).mockClear();
  });

  it('sube el archivo y arma la url pública a partir del base y la key', async () => {
    sendMock.mockResolvedValue({});
    const storage = new R2EvidenceStorage(configured());
    const buffer = Buffer.from('x');

    const result = await storage.upload({
      buffer,
      key: 'k1',
      contentType: 'image/png',
    });

    expect(result).toEqual({ url: 'https://cdn.example.com/k1' });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith({
      input: {
        Bucket: 'evidencia',
        Key: 'k1',
        Body: expect.any(Buffer),
        ContentType: 'image/png',
      },
    });
  });

  it('arma el endpoint del S3Client con el accountId configurado', () => {
    new R2EvidenceStorage(configured());

    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://acc-1.r2.cloudflarestorage.com' }),
    );
  });

  it('sin accountId, el S3Client queda sin endpoint propio', () => {
    new R2EvidenceStorage(configured({ 'r2.accountId': undefined }));

    expect(S3Client).toHaveBeenCalledWith(expect.objectContaining({ endpoint: undefined }));
  });

  it('rechaza con 503 si falta bucket o publicUrlBase', async () => {
    const storage = new R2EvidenceStorage(configured({ 'r2.bucket': undefined }));

    await expect(
      storage.upload({ buffer: Buffer.from('x'), key: 'k1', contentType: 'image/png' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('traduce el error de S3 al subir en un 500 propio', async () => {
    sendMock.mockRejectedValue(new Error('s3 caído'));
    const storage = new R2EvidenceStorage(configured());

    await expect(
      storage.upload({ buffer: Buffer.from('x'), key: 'k1', contentType: 'image/png' }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('remove no hace nada si no hay bucket configurado', async () => {
    const storage = new R2EvidenceStorage(configured({ 'r2.bucket': undefined }));
    await storage.remove('k1');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('remove borra el objeto y no relanza si S3 falla', async () => {
    sendMock.mockRejectedValue(new Error('no existe'));
    const storage = new R2EvidenceStorage(configured());
    await expect(storage.remove('k1')).resolves.toBeUndefined();
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('remove borra el objeto sin error', async () => {
    sendMock.mockResolvedValue({});
    const storage = new R2EvidenceStorage(configured());
    await storage.remove('k1');
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
