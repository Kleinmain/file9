import { getStore } from '@netlify/blobs'
import type { Config } from '@netlify/functions'
import {
  json,
  publicFile,
  STORE_NAME,
  type FileMetadata,
} from './_shared/files.ts'

export default async () => {
  try {
    const store = getStore({ name: STORE_NAME, consistency: 'strong' })
    const { blobs } = await store.list()
    const entries = await Promise.all(
      blobs.map(async ({ key }) => {
        const entry = await store.getMetadata(key, { consistency: 'strong' })
        if (!entry) return null
        const metadata = entry.metadata as FileMetadata
        if (metadata.expiresAt <= Date.now()) {
          await store.delete(key)
          return null
        }
        return publicFile(key, metadata)
      }),
    )

    const files = entries
      .filter((entry) => entry !== null)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 100)
    return json({ files })
  } catch (error) {
    console.error('Could not list files', error)
    return json({ error: 'The public shelf could not be loaded.' }, 500)
  }
}

export const config: Config = {
  path: '/api/files',
  method: 'GET',
}
