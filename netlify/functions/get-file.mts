import { getStore } from '@netlify/blobs'
import type { Config, Context } from '@netlify/functions'
import { STORE_NAME, type FileMetadata } from './_shared/files.ts'

const safeFilename = (name: string) => name.replace(/[\r\n"\\/]/g, '_')

export default async (request: Request, context: Context) => {
  const id = context.params.id
  if (!id) return new Response('Not found', { status: 404 })

  const store = getStore({ name: STORE_NAME, consistency: 'strong' })
  const entry = await store.getWithMetadata(id, {
    consistency: 'strong',
    type: 'stream',
  })
  if (!entry) return new Response('Not found', { status: 404 })

  const metadata = entry.metadata as FileMetadata
  if (metadata.expiresAt <= Date.now()) {
    await store.delete(id)
    return new Response('This file has expired.', { status: 410 })
  }

  const url = new URL(request.url)
  const forceDownload = url.searchParams.has('download') || metadata.kind === 'word'
  const disposition = forceDownload ? 'attachment' : 'inline'
  const filename = safeFilename(metadata.name)

  return new Response(entry.data, {
    headers: {
      'Content-Type': metadata.type,
      'Content-Length': String(metadata.size),
      'Content-Disposition': `${disposition}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(metadata.name)}`,
      'Cache-Control': 'private, max-age=60',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; media-src 'self'; img-src 'self' data:",
    },
  })
}

export const config: Config = {
  path: '/f/:id',
  method: 'GET',
}
