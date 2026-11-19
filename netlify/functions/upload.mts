import { getStore } from '@netlify/blobs'
import type { Config } from '@netlify/functions'
import {
  cleanText,
  createDeleteToken,
  decodeHeader,
  EXPIRY_HOURS,
  hashToken,
  json,
  publicFile,
  STORE_NAME,
  validateFile,
  type FileMetadata,
} from './_shared/files.ts'

export default async (request: Request) => {
  try {
    const url = new URL(request.url)
    const name = decodeHeader(request.headers.get('x-file-name')).slice(0, 180)
    const type = request.headers.get('content-type')?.split(';')[0].trim() ?? ''
    const bytes = await request.arrayBuffer()
    const file = { name, type, size: bytes.byteLength }
    if (!name) return json({ error: 'Choose a file to upload.' }, 400)

    const validation = validateFile(file)
    if ('error' in validation) return json({ error: validation.error }, 400)

    const expiresIn = Number(url.searchParams.get('expiresIn'))
    if (!EXPIRY_HOURS.has(expiresIn)) {
      return json({ error: 'Choose a valid expiration time.' }, 400)
    }

    const id = crypto.randomUUID()
    const deleteToken = createDeleteToken()
    const createdAt = Date.now()
    const metadata: FileMetadata = {
      name,
      type,
      kind: validation.kind,
      size: bytes.byteLength,
      title: cleanText(decodeHeader(request.headers.get('x-file-title')), 80) || undefined,
      description:
        cleanText(decodeHeader(request.headers.get('x-file-description')), 240) || undefined,
      createdAt,
      expiresAt: createdAt + expiresIn * 60 * 60 * 1000,
      deleteHash: hashToken(deleteToken),
    }

    const store = getStore({ name: STORE_NAME, consistency: 'strong' })
    await store.set(id, new Blob([bytes], { type }), { metadata, onlyIfNew: true })

    return json({ file: { ...publicFile(id, metadata), deleteToken } }, 201)
  } catch (error) {
    console.error('Upload failed', error)
    return json({ error: 'The upload could not be completed.' }, 500)
  }
}

export const config: Config = {
  path: '/api/upload',
  method: 'POST',
}
