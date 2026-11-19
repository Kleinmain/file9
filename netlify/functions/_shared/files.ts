import { createHash, randomBytes } from 'node:crypto'

export const MAX_FILE_SIZE = 4 * 1024 * 1024
export const STORE_NAME = 'file9-uploads'
export const EXPIRY_HOURS = new Set([1, 24, 72, 168])

export type FileKind = 'image' | 'audio' | 'pdf' | 'text' | 'word'

export type FileMetadata = {
  name: string
  type: string
  kind: FileKind
  size: number
  title?: string
  description?: string
  createdAt: number
  expiresAt: number
  deleteHash: string
}

const allowedFiles: Record<string, { kind: FileKind; types: string[] }> = {
  jpg: { kind: 'image', types: ['image/jpeg'] },
  jpeg: { kind: 'image', types: ['image/jpeg'] },
  png: { kind: 'image', types: ['image/png'] },
  gif: { kind: 'image', types: ['image/gif'] },
  webp: { kind: 'image', types: ['image/webp'] },
  mp3: { kind: 'audio', types: ['audio/mpeg', 'audio/mp3'] },
  wav: { kind: 'audio', types: ['audio/wav', 'audio/x-wav'] },
  ogg: { kind: 'audio', types: ['audio/ogg', 'application/ogg'] },
  m4a: { kind: 'audio', types: ['audio/mp4', 'audio/x-m4a'] },
  pdf: { kind: 'pdf', types: ['application/pdf'] },
  txt: { kind: 'text', types: ['text/plain'] },
  md: { kind: 'text', types: ['text/markdown', 'text/plain'] },
  doc: { kind: 'word', types: ['application/msword'] },
  docx: {
    kind: 'word',
    types: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  },
}

type UploadFile = {
  name: string
  type: string
  size: number
}

export const validateFile = (file: UploadFile) => {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const rule = allowedFiles[extension]
  if (!rule || !rule.types.includes(file.type)) {
    return { error: 'This file type is not supported.' } as const
  }
  if (file.size === 0) return { error: 'The file is empty.' } as const
  if (file.size > MAX_FILE_SIZE) {
    return { error: 'Files must be no larger than 4 MB.' } as const
  }
  return { kind: rule.kind } as const
}

export const createDeleteToken = () => randomBytes(24).toString('base64url')

export const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex')

export const cleanText = (value: string, max: number) => value.trim().slice(0, max)

export const decodeHeader = (value: string | null) => {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return ''
  }
}

export const publicFile = (id: string, metadata: FileMetadata) => ({
  id,
  name: metadata.name,
  type: metadata.type,
  kind: metadata.kind,
  size: metadata.size,
  ...(metadata.title ? { title: metadata.title } : {}),
  ...(metadata.description ? { description: metadata.description } : {}),
  createdAt: metadata.createdAt,
  expiresAt: metadata.expiresAt,
})

export const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
