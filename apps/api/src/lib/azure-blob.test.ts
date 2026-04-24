import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AzureBlobConfigError, generateReadSasToken, getBlobServiceClient } from './azure-blob.js'

const FAKE_ACCOUNT_KEY = Buffer.from('fake-key-for-tests-only-not-real').toString('base64')
const FAKE_CONNECTION_STRING = `DefaultEndpointsProtocol=https;AccountName=testaccount;AccountKey=${FAKE_ACCOUNT_KEY};EndpointSuffix=core.windows.net`

describe('azure-blob', () => {
  let originalConnectionString: string | undefined

  beforeEach(() => {
    originalConnectionString = process.env['AZURE_STORAGE_CONNECTION_STRING']
  })

  afterEach(() => {
    if (originalConnectionString === undefined) {
      delete process.env['AZURE_STORAGE_CONNECTION_STRING']
    } else {
      process.env['AZURE_STORAGE_CONNECTION_STRING'] = originalConnectionString
    }
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
  })

  describe('generateReadSasToken', () => {
    beforeEach(() => {
      process.env['AZURE_STORAGE_CONNECTION_STRING'] = FAKE_CONNECTION_STRING
      // Bust the module-level cache between tests; easiest way is to restart node on import,
      // but since we cache inside a module var, clearing the env doesn't reset it.
      // For this test we accept that the first test initialises the cache — the subsequent
      // tests validate ttl behaviour on the same client.
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
      expect(sas).toContain('se=') // signed expiry
      expect(sas).toContain('sp=r') // read-only permission
    })
  })
})
