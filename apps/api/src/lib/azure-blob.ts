import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
} from '@azure/storage-blob'
import { z } from 'zod'

const sasTtlSchema = z.number().int().min(1).max(60)
const connectionStringSchema = z.string().min(1, 'AZURE_STORAGE_CONNECTION_STRING must be set')

export class AzureBlobConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AzureBlobConfigError'
  }
}

let cachedClient: BlobServiceClient | undefined

export function getBlobServiceClient(): BlobServiceClient {
  if (cachedClient) return cachedClient
  const result = connectionStringSchema.safeParse(process.env['AZURE_STORAGE_CONNECTION_STRING'])
  if (!result.success) {
    throw new AzureBlobConfigError(result.error.errors[0]?.message ?? 'missing connection string')
  }
  cachedClient = BlobServiceClient.fromConnectionString(result.data)
  return cachedClient
}

export interface UploadBlobResult {
  url: string
  etag: string | undefined
}

export async function uploadBlob(
  container: string,
  blobName: string,
  data: Buffer | string,
  contentType: string,
): Promise<UploadBlobResult> {
  const svc = getBlobServiceClient()
  const client = svc.getContainerClient(container).getBlockBlobClient(blobName)
  const buffer = typeof data === 'string' ? Buffer.from(data) : data
  const upload = await client.upload(buffer, buffer.byteLength, {
    blobHTTPHeaders: { blobContentType: contentType },
  })
  return {
    url: client.url,
    etag: upload.etag,
  }
}

export function generateReadSasToken(
  container: string,
  blobName: string,
  ttlMinutes: number,
): string {
  const ttl = sasTtlSchema.parse(ttlMinutes)
  const svc = getBlobServiceClient()
  const credential = svc.credential
  if (!(credential instanceof StorageSharedKeyCredential)) {
    throw new AzureBlobConfigError(
      'Cannot generate SAS token: BlobServiceClient was built without a shared key credential. ' +
        'Ensure AZURE_STORAGE_CONNECTION_STRING contains AccountKey=... (not a SAS URL).',
    )
  }

  const startsOn = new Date(Date.now() - 60_000)
  const expiresOn = new Date(Date.now() + ttl * 60_000)

  const sas = generateBlobSASQueryParameters(
    {
      containerName: container,
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
    },
    credential,
  )

  return sas.toString()
}

export function buildReadSasUrl(
  container: string,
  blobName: string,
  ttlMinutes: number,
): string {
  const svc = getBlobServiceClient()
  const client = svc.getContainerClient(container).getBlockBlobClient(blobName)
  const sas = generateReadSasToken(container, blobName, ttlMinutes)
  return `${client.url}?${sas}`
}
