import {
  ArrowDownToLine,
  Clock3,
  FileAudio,
  FileText,
  FileType2,
  Image as ImageIcon,
  LoaderCircle,
  LockKeyhole,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const MAX_FILE_SIZE = 4 * 1024 * 1024
const MAX_BATCH_SIZE = 5
const ACCEPTED_EXTENSION_LIST = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.mp3',
  '.wav',
  '.ogg',
  '.m4a',
  '.pdf',
  '.txt',
  '.md',
  '.doc',
  '.docx',
]
const ACCEPTED_EXTENSIONS = ACCEPTED_EXTENSION_LIST.join(',')

type FileKind = 'image' | 'audio' | 'pdf' | 'text' | 'word'

type PublicFile = {
  id: string
  name: string
  type: string
  kind: FileKind
  size: number
  title?: string
  description?: string
  createdAt: number
  expiresAt: number
}

type ManagedFile = PublicFile & { deleteToken: string }
type UploadState = 'ready' | 'uploading' | 'done' | 'error'
type QueuedFile = { file: File; state: UploadState; error?: string }
type View = 'discover' | 'uploads'

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const timeLeft = (expiresAt: number) => {
  const minutes = Math.max(0, Math.round((expiresAt - Date.now()) / 60_000))
  if (minutes < 60) return `${minutes}m left`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h left`
  return `${Math.round(hours / 24)}d left`
}

const iconFor = (kind: FileKind, size = 20) => {
  if (kind === 'image') return <ImageIcon size={size} />
  if (kind === 'audio') return <FileAudio size={size} />
  if (kind === 'word') return <FileType2 size={size} />
  return <FileText size={size} />
}

const readManagedFiles = (): ManagedFile[] => {
  try {
    return JSON.parse(localStorage.getItem('file9-uploads') ?? '[]') as ManagedFile[]
  } catch {
    return []
  }
}

function App() {
  const [view, setView] = useState<View>('discover')
  const [files, setFiles] = useState<PublicFile[]>([])
  const [managedFiles, setManagedFiles] = useState<ManagedFile[]>(readManagedFiles)
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [expiresIn, setExpiresIn] = useState('24')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState<PublicFile | null>(null)
  const [adminToken, setAdminToken] = useState(
    () => sessionStorage.getItem('file9-admin-token') ?? '',
  )
  const fileInput = useRef<HTMLInputElement>(null)
  const isAdmin = new URLSearchParams(window.location.search).has('admin')

  const loadFiles = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/files')
      if (!response.ok) throw new Error('Could not load files')
      const payload = (await response.json()) as { files: PublicFile[] }
      setFiles(payload.files)
    } catch {
      setNotice('The gallery is unavailable right now. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial remote data synchronization belongs in an effect.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadFiles()
  }, [loadFiles])

  useEffect(() => {
    localStorage.setItem('file9-uploads', JSON.stringify(managedFiles))
  }, [managedFiles])

  useEffect(() => {
    sessionStorage.setItem('file9-admin-token', adminToken)
  }, [adminToken])

  const addFiles = (incoming: File[]) => {
    const available = MAX_BATCH_SIZE - queue.length
    const selected = incoming.slice(0, available)
    const next = selected.map((file): QueuedFile => {
      if (file.size > MAX_FILE_SIZE) {
        return { file, state: 'error', error: 'Larger than 4 MB' }
      }
      const extension = `.${file.name.split('.').pop()?.toLowerCase()}`
      if (!ACCEPTED_EXTENSION_LIST.includes(extension)) {
        return { file, state: 'error', error: 'File type not supported' }
      }
      return { file, state: 'ready' }
    })
    setQueue((current) => [...current, ...next])
    if (incoming.length > available) {
      setNotice(`You can upload up to ${MAX_BATCH_SIZE} files at a time.`)
    }
  }

  const upload = async () => {
    const uploadable = queue
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.state === 'ready')
    if (!uploadable.length) return

    setIsUploading(true)
    setNotice('')
    const completed: ManagedFile[] = []

    for (const { item, index } of uploadable) {
      setQueue((current) =>
        current.map((queued, queuedIndex) =>
          queuedIndex === index ? { ...queued, state: 'uploading' } : queued,
        ),
      )
      try {
        const response = await fetch(`/api/upload?expiresIn=${expiresIn}`, {
          method: 'POST',
          headers: {
            'Content-Type': item.file.type,
            'x-file-name': encodeURIComponent(item.file.name),
            'x-file-title': encodeURIComponent(title),
            'x-file-description': encodeURIComponent(description),
          },
          body: item.file,
        })
        const payload = (await response.json()) as {
          file?: ManagedFile
          error?: string
        }
        if (!response.ok || !payload.file) {
          throw new Error(payload.error ?? 'Upload failed')
        }
        completed.push(payload.file)
        setQueue((current) =>
          current.map((queued, queuedIndex) =>
            queuedIndex === index ? { ...queued, state: 'done' } : queued,
          ),
        )
      } catch (error) {
        setQueue((current) =>
          current.map((queued, queuedIndex) =>
            queuedIndex === index
              ? {
                  ...queued,
                  state: 'error',
                  error: error instanceof Error ? error.message : 'Upload failed',
                }
              : queued,
          ),
        )
      }
    }

    if (completed.length) {
      setManagedFiles((current) => [...completed, ...current])
      setNotice(
        `${completed.length} ${completed.length === 1 ? 'file' : 'files'} uploaded.`,
      )
      await loadFiles()
    }
    setIsUploading(false)
  }

  const removeFile = async (file: PublicFile, deleteToken?: string) => {
    if (!window.confirm(`Delete “${file.name}” now?`)) return
    try {
      const response = await fetch(`/api/files/${file.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'x-admin-token': adminToken } : {}),
        },
        body: JSON.stringify({ deleteToken }),
      })
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        throw new Error(payload.error ?? 'Delete failed')
      }
      setFiles((current) => current.filter(({ id }) => id !== file.id))
      setManagedFiles((current) => current.filter(({ id }) => id !== file.id))
      setNotice('File deleted.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Delete failed')
    }
  }

  const visibleFiles = useMemo(() => {
    const source =
      view === 'uploads'
        ? managedFiles.filter((managed) => files.some(({ id }) => id === managed.id))
        : files
    const term = search.trim().toLowerCase()
    if (!term) return source
    return source.filter(
      (file) =>
        file.name.toLowerCase().includes(term) ||
        file.title?.toLowerCase().includes(term) ||
        file.description?.toLowerCase().includes(term),
    )
  }, [files, managedFiles, search, view])

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" type="button" onClick={() => setView('discover')}>
          <span className="brand-mark">9</span>
          <span>file9</span>
        </button>
        <nav aria-label="Main navigation">
          <button
            className={view === 'discover' ? 'active' : ''}
            type="button"
            onClick={() => setView('discover')}
          >
            Discover
          </button>
          <button
            className={view === 'uploads' ? 'active' : ''}
            type="button"
            onClick={() => setView('uploads')}
          >
            My uploads
            {managedFiles.length > 0 && <span className="nav-count">{managedFiles.length}</span>}
          </button>
        </nav>
        <a className="header-cta" href="#upload">
          <UploadCloud size={17} />
          Upload
        </a>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow">
              <span />
              Temporary by design
            </p>
            <h1>
              Drop it. Share it.
              <br />
              <em>Gone soon.</em>
            </h1>
            <p className="hero-description">
              A small, public shelf for files that do not need to live forever.
              Upload up to 4 MB and choose when they disappear.
            </p>
            <div className="trust-row">
              <span>
                <ShieldCheck size={17} /> Strict file types
              </span>
              <span>
                <Clock3 size={17} /> Auto-expiring
              </span>
            </div>
          </div>

          <div className="upload-card" id="upload">
            <div
              className={`drop-zone ${isDragging ? 'dragging' : ''}`}
              onDragEnter={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setIsDragging(false)
                addFiles(Array.from(event.dataTransfer.files))
              }}
            >
              <div className="upload-icon">
                <UploadCloud size={28} />
              </div>
              <strong>Drop files here</strong>
              <span>or</span>
              <button type="button" onClick={() => fileInput.current?.click()}>
                Browse files
              </button>
              <small>Up to 5 files · 4 MB each</small>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept={ACCEPTED_EXTENSIONS}
                hidden
                onChange={(event) => {
                  addFiles(Array.from(event.target.files ?? []))
                  event.target.value = ''
                }}
              />
            </div>

            {queue.length > 0 && (
              <div className="upload-queue">
                {queue.map((item, index) => (
                  <div className="queue-item" key={`${item.file.name}-${index}`}>
                    <span className="queue-icon">
                      {iconFor(
                        item.file.type.startsWith('image/')
                          ? 'image'
                          : item.file.type.startsWith('audio/')
                            ? 'audio'
                            : item.file.name.endsWith('.pdf')
                              ? 'pdf'
                              : item.file.name.match(/\.docx?$/i)
                                ? 'word'
                                : 'text',
                      )}
                    </span>
                    <span className="queue-name">
                      <strong>{item.file.name}</strong>
                      <small className={item.state === 'error' ? 'error' : ''}>
                        {item.error ?? formatBytes(item.file.size)}
                      </small>
                    </span>
                    {item.state === 'uploading' && <LoaderCircle className="spin" size={18} />}
                    {item.state === 'done' && <span className="done-mark">✓</span>}
                    {!isUploading && item.state !== 'done' && (
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Remove ${item.file.name}`}
                        onClick={() =>
                          setQueue((current) => current.filter((_, itemIndex) => itemIndex !== index))
                        }
                      >
                        <X size={17} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="upload-options">
              <label>
                Disappears after
                <select value={expiresIn} onChange={(event) => setExpiresIn(event.target.value)}>
                  <option value="1">1 hour</option>
                  <option value="24">24 hours</option>
                  <option value="72">3 days</option>
                  <option value="168">7 days</option>
                </select>
              </label>
              <label>
                Title <span>optional</span>
                <input
                  value={title}
                  maxLength={80}
                  placeholder="A short label"
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label className="full-field">
                Note <span>optional</span>
                <input
                  value={description}
                  maxLength={240}
                  placeholder="What should people know?"
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
            </div>
            <button
              className="upload-button"
              type="button"
              disabled={isUploading || !queue.some(({ state }) => state === 'ready')}
              onClick={() => void upload()}
            >
              {isUploading ? <LoaderCircle className="spin" size={19} /> : <UploadCloud size={19} />}
              {isUploading ? 'Uploading…' : 'Upload to the public shelf'}
            </button>
            <p className="upload-note">
              By uploading, you confirm the file is safe and yours to share.
            </p>
          </div>
        </section>

        <section className="gallery-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                <span />
                {view === 'uploads' ? 'Saved in this browser' : 'Public shelf'}
              </p>
              <h2>{view === 'uploads' ? 'My uploads' : 'Freshly dropped'}</h2>
            </div>
            <label className="search-box">
              <Search size={18} />
              <input
                value={search}
                placeholder="Search files"
                aria-label="Search files"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>

          {isAdmin && (
            <div className="admin-bar">
              <LockKeyhole size={18} />
              <strong>Moderator mode</strong>
              <input
                type="password"
                value={adminToken}
                placeholder="Enter ADMIN_TOKEN"
                onChange={(event) => setAdminToken(event.target.value)}
              />
            </div>
          )}

          {isLoading ? (
            <div className="empty-state">
              <LoaderCircle className="spin" />
              <p>Checking the shelf…</p>
            </div>
          ) : visibleFiles.length === 0 ? (
            <div className="empty-state">
              <UploadCloud size={34} />
              <h3>{view === 'uploads' ? 'Nothing saved here yet' : 'The shelf is empty'}</h3>
              <p>
                {view === 'uploads'
                  ? 'Files uploaded from this browser will appear here.'
                  : 'Be the first to drop something temporary.'}
              </p>
            </div>
          ) : (
            <div className="file-grid">
              {visibleFiles.map((file) => {
                const managed = managedFiles.find(({ id }) => id === file.id)
                return (
                  <article className="file-card" key={file.id}>
                    <div className={`file-preview ${file.kind}`}>
                      {file.kind === 'image' ? (
                        <img src={`/f/${file.id}`} alt="" loading="lazy" />
                      ) : file.kind === 'audio' ? (
                        <>
                          <FileAudio size={38} />
                          <audio controls preload="none" src={`/f/${file.id}`} />
                        </>
                      ) : (
                        <>
                          {iconFor(file.kind, 42)}
                          <span>{file.name.split('.').pop()?.toUpperCase()}</span>
                          {(file.kind === 'pdf' || file.kind === 'text') && (
                            <button type="button" onClick={() => setPreview(file)}>
                              Preview
                            </button>
                          )}
                        </>
                      )}
                      <span className="expiry-badge">
                        <Clock3 size={13} /> {timeLeft(file.expiresAt)}
                      </span>
                    </div>
                    <div className="file-details">
                      <div className="file-type-icon">{iconFor(file.kind)}</div>
                      <div className="file-copy">
                        <h3 title={file.name}>{file.title || file.name}</h3>
                        <p>
                          {formatBytes(file.size)}
                          {file.title && ` · ${file.name}`}
                        </p>
                        {file.description && <p className="file-description">{file.description}</p>}
                      </div>
                    </div>
                    <div className="file-actions">
                      <a href={`/f/${file.id}?download=1`}>
                        <ArrowDownToLine size={16} /> Download
                      </a>
                      {(managed || (isAdmin && adminToken)) && (
                        <button
                          type="button"
                          aria-label={`Delete ${file.name}`}
                          onClick={() => void removeFile(file, managed?.deleteToken)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </main>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark">9</span>
          <span>file9</span>
        </div>
        <p>Temporary storage for small things worth sharing.</p>
        <span>Files expire automatically · 4 MB max</span>
      </footer>

      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}>
            <X size={16} />
          </button>
        </div>
      )}

      {preview && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setPreview(null)}>
          <section
            className="preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Preview ${preview.name}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                {iconFor(preview.kind)}
                <strong>{preview.name}</strong>
              </div>
              <button type="button" aria-label="Close preview" onClick={() => setPreview(null)}>
                <X />
              </button>
            </header>
            <iframe title={`Preview of ${preview.name}`} src={`/f/${preview.id}`} />
          </section>
        </div>
      )}
    </div>
  )
}

export default App
