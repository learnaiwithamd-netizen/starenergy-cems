import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  AzureBlobConfigError,
  buildReadSasUrl,
  generateReadSasToken,
  getBlobServiceClient,
  resetBlobServiceClient,
} from './azure-blob.js'

const FAKE_ACCOUNT_KEY = Buffer.from('fake-key-for-tests-only-not-real').toString('base64')
const FAKE_CONNECTION_STRING = `DefaultEndpointsProtocol=https;AccountName=testaccount;AccountKey=${FAKE_ACCOUNT_KEY};EndpointSuffix=core.windows.net`
const FAKE_SAS_CONNECTION_STRING = 'BlobEndpoint=https://testaccount.blob.core.windows.net/;SharedAccessSignature=sv=2020-02-10&ss=b&sig=deadbeef'

describe('azure-blob', () => {
  let originalConnectionString: string | undefined

  beforeEach(() => {
    originalConnectionString = process.env['AZURE_STORAGE_CONNECTION_STRING']
    resetBlobServiceClient()
  })

  afterEach(() => {
    if (originalConnectionString === undefined) {
      delete process.env['AZURE_STORAGE_CONNECTION_STRING']
    } else {
      process.env['AZURE_STORAGE_CONNECTION_STRING'] = originalConnectionString
    }
    resetBlobServiceClient()
  })

  describe('getBlobServiceClient', () => {
    it('throws AzureBlobConfigError when connection string env is missing', () => {
      delete process.env['AZURE_STORAGE_CONNECTION_STRING']
      expect(() => getBlobServiceClient()).toThrow(AzureBlobConfigError)
    })

    it('throws AzureBlobConfigError when connection string is empty', () => {
      process.env['AZURE_STORAGE_CONNECTION_STRING'] = ''
      expect(() => getBlobServiceClient()).toThrow(AzureBlobConfigError)
    })

    it('returns the same instance on repeat calls (caches)', () => {
      process.env['AZURE_STORAGE_CONNECTION_STRING'] = FAKE_CONNECTION_STRING
      const a = getBlobServiceClient()
      const b = getBlobServiceClient()
      expect(a).toBe(b)
    })

    it('resetBlobServiceClient forces a new client instance', () => {
      process.env['AZURE_STORAGE_CONNECTION_STRING'] = FAKE_CONNECTION_STRING
      const a = getBlobServiceClient()
      resetBlobServiceClient()
      const b = getBlobServiceClient()
      expect(a).not.toBe(b)
    })
  })

  describe('generateReadSasToken', () => {
    beforeEach(() => {
      process.env['AZURE_STORAGE_CONNECTION_STRING'] = FAKE_CONNECTION_STRING
    })

    it('rejects ttl below 1 minute', () => {
      expect(() => generateReadSasToken('audit-photos', 'photo.jpg', 0)).toThrow()
    })

    it('rejects ttl above 60 minutes', () => {
      expect(() => generateReadSasToken('audit-photos', 'photo.jpg', 61)).toThrow()
    })

    it('rejects non-integer ttl', () => {
      expect(() => generateReadSasToken('audit-photos', 'photo.jpg', 1.5)).toThrow()
    })

    it('generates a SAS token string for a valid ttl', () => {
      const sas = generateReadSasToken('audit-photos', 'photo.jpg', 15)
      expect(typeof sas).toBe('string')
      expect(sas.length).toBeGreaterThan(0)
      expect(sas).toContain('sig=')
      expect(sas).toContain('se=')
      expect(sas).toContain('sp=r')
    })

    it('throws AzureBlobConfigError when connection string uses SAS credentials (no AccountKey)', () => {
      process.env['AZURE_STORAGE_CONNECTION_STRING'] = FAKE_SAS_CONNECTION_STRING
      resetBlobServiceClient()
      expect(() => generateReadSasToken('audit-photos', 'photo.jpg', 15)).toThrow(AzureBlobConfigError)
    })
  })

  describe('buildReadSasUrl', () => {
    beforeEach(() => {
      process.env['AZURE_STORAGE_CONNECTION_STRING'] = FAKE_CONNECTION_STRING
    })

    it('returns a blob URL with SAS query string appended', () => {
      const url = buildReadSasUrl('audit-photos', 'photo.jpg', 15)
      expect(url).toContain('https://testaccount.blob.core.windows.net/audit-photos/photo.jpg?')
      expect(url).toContain('sig=')
      expect(url).toContain('sp=r')
    })
  })
})
