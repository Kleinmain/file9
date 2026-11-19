import { timingSafeEqual } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import type { Config, Context } from '@netlify/functions'
import {
  hashToken,
  json,
  STORE_NAME,
  type FileMetadata,
} from './_shared/files.ts'

const equals = (left: string, right: string) => {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export default async (request: Request, context: Context) => {
  const id = context.params.id
  if (!id) return json({ error: 'File not found.' }, 404)

  const store = getStore({ name: STORE_NAME, consistency: 'strong' })
  const entry = await store.getMetadata(id, { consistency: 'strong' })
  if (!entry) return json({ error: 'File not found.' }, 404)

  const metadata = entry.metadata as FileMetadata
  let deleteToken = ''
  try {
    const body = (await request.json()) as { deleteToken?: string }
    deleteToken = body.deleteToken ?? ''
  } catch {
    // The admin flow may send an empty JSON body.
  }

  const adminToken = process.env.ADMIN_TOKEN ?? ''
  const suppliedAdminToken = request.headers.get('x-admin-token') ?? ''
  const canDelete =
    (deleteToken !== '' && equals(hashToken(deleteToken), metadata.deleteHash)) ||
    (adminToken !== '' && equals(suppliedAdminToken, adminToken))

  if (!canDelete) return json({ error: 'You do not have permission to delete this file.' }, 403)

  await store.delete(id)
  return json({ deleted: true })
}

export const config: Config = {
  path: '/api/files/:id',
  method: 'DELETE',
}
