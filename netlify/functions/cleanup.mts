import { getStore } from '@netlify/blobs'
import type { Config } from '@netlify/functions'
import { STORE_NAME, type FileMetadata } from './_shared/files.ts'

export default async () => {
  const store = getStore({ name: STORE_NAME, consistency: 'strong' })
  const { blobs } = await store.list()
  let deleted = 0

  for (const { key } of blobs) {
    const entry = await store.getMetadata(key, { consistency: 'strong' })
    const metadata = entry?.metadata as FileMetadata | undefined
    if (metadata && metadata.expiresAt <= Date.now()) {
      await store.delete(key)
      deleted += 1
    }
  }

  console.log(`file9 cleanup deleted ${deleted} expired files`)
}

export const config: Config = {
  schedule: '@hourly',
}
