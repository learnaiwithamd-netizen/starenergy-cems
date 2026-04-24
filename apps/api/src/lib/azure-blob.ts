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

/**
 * Maximum clock-skew backoff for SAS startsOn. Microsoft recommends 15 minutes
 * to tolerate NTP drift across Azure regions.
 */
const SAS_CLOCK_SKEW_MS = 15 * 60 * 1000

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

/**
 * Reset the cached BlobServiceClient. Call when AZURE_STORAGE_CONNECTION_STRING
 * rotates (Key Vault secret rotation). Also used by test suites to ensure
 * isolation between tests.
 */
export function resetBlobServiceClient(): void {
  cachedClient = undefined
}

export interface UploadBlobResult {
  /** Absolute blob URL without SAS. Will 401 unless container permits public access. */
  blobUrl: string
  /** Azure ETag from the upload response. */
  etag: string | undefined
}

/**
 * Uploads a blob. Default content encoding for string input is UTF-8.
 * For binary data, pass a Buffer directly.
 */
export async function uploadBlob(
  container: string,
  blobName: string,
  data: Buffer | string,
  contentType: string,
): Promise<UploadBlobResult> {
  const svc = getBlobServiceClient()
  const client = svc.getContainerClient(container).getBlockBlobClient(blobName)
  const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data
  const upload = await client.upload(buffer, buffer.byteLength, {
    blobHTTPHeaders: { blobContentType: contentType },
  })
  return {
    blobUrl: client.url,
    etag: upload.etag,
  }
}

/**
 * Generates a read-only SAS token for a blob. TTL is 1-60 minutes.
 * Token starts 15 minutes in the past to tolerate NTP drift.
 */
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

  const startsOn = new Date(Date.now() - SAS_CLOCK_SKEW_MS)
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

/**
 * Returns the full signed read URL for a blob (blob URL + '?' + SAS). Use this
 * when handing an audit photo URL to a browser.
 */
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
