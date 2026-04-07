import { useState, useEffect } from 'react'
import { Download, Loader2, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { apiClient } from '@/api/client'
import toast from 'react-hot-toast'

interface ExportFilters {
  location_id?: string | null
  category?: string | null
  condition?: string | null
  verified_only?: boolean
}

interface ExportModalProps {
  siteId: string
  open: boolean
  onClose: () => void
  initialFilters?: ExportFilters
}

type ExportFormat = 'xlsx' | 'csv'
type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'

interface ExportJob {
  id: string
  status: JobStatus
  download_url?: string
  error_message?: string
}

export function ExportModal({ siteId, open, onClose, initialFilters = {} }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('xlsx')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [job, setJob] = useState<ExportJob | null>(null)
  const [polling, setPolling] = useState(false)

  // Poll job status
  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') {
      setPolling(false)
      return
    }
    setPolling(true)
    const interval = setInterval(async () => {
      try {
        const res = await apiClient.get<ExportJob>(`/api/v1/sites/${siteId}/export/${job.id}`)
        setJob(res.data)
        if (res.data.status === 'completed' || res.data.status === 'failed') {
          clearInterval(interval)
          setPolling(false)
        }
      } catch {
        clearInterval(interval)
        setPolling(false)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [job?.id, job?.status, siteId])

  const handleStart = async () => {
    try {
      const res = await apiClient.post<ExportJob>(`/api/v1/sites/${siteId}/export/`, {
        format,
        filters: { ...initialFilters, verified_only: verifiedOnly },
      })
      setJob(res.data)
      toast.success('Export started')
    } catch {
      toast.error('Failed to start export')
    }
  }

  const handleClose = () => {
    setJob(null)
    onClose()
  }

  const isRunning = job && (job.status === 'pending' || job.status === 'processing')

  return (
    <Modal open={open} onClose={handleClose} title="Export Inventory">
      <div className="space-y-4">
        {!job ? (
          <>
            {/* Format selector */}
            <div>
              <label className="block text-sm font-medium text-kraft-600 mb-2">Format</label>
              <div className="grid grid-cols-2 gap-2">
                {(['xlsx', 'csv'] as ExportFormat[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`p-3 rounded-xl border text-sm font-medium transition-colors ${
                      format === f
                        ? 'border-kraft-700 bg-kraft-700 text-kraft-50'
                        : 'border-kraft-200 bg-white text-kraft-600 hover:border-kraft-400'
                    }`}
                  >
                    <FileSpreadsheet size={16} className="mx-auto mb-1" />
                    {f.toUpperCase()}
                    {f === 'xlsx' && (
                      <span className="block text-xs opacity-70 mt-0.5">
                        5 sheets
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-kraft-600">Options</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={e => setVerifiedOnly(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-kraft-700">Verified items only</span>
              </label>
            </div>

            {format === 'xlsx' && (
              <div className="bg-kraft-100 rounded-xl p-3 text-xs text-kraft-500 space-y-1">
                <p className="font-medium text-kraft-600">XLSX includes sheets:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>Items — all fields</li>
                  <li>Locations — hierarchy</li>
                  <li>Movements — history log</li>
                  <li>Photos — linked photos</li>
                  <li>Audit — change log</li>
                </ul>
              </div>
            )}

            <Button variant="primary" onClick={handleStart} className="w-full">
              <Download size={14} /> Generate export
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-center py-6 gap-4">
            {isRunning && (
              <>
                <Loader2 size={32} className="animate-spin text-kraft-400" />
                <div className="text-center">
                  <p className="font-medium text-kraft-700">Generating export…</p>
                  <p className="text-sm text-kraft-400 mt-1">This may take a moment for large inventories</p>
                </div>
              </>
            )}

            {job.status === 'completed' && job.download_url && (
              <>
                <CheckCircle size={32} className="text-accent-sage" />
                <div className="text-center">
                  <p className="font-medium text-kraft-700">Export ready!</p>
                  <p className="text-sm text-kraft-400 mt-1">Link expires in 24 hours</p>
                </div>
                <a
                  href={job.download_url}
                  download
                  className="btn-primary flex items-center gap-2"
                >
                  <Download size={14} /> Download {format.toUpperCase()}
                </a>
              </>
            )}

            {job.status === 'failed' && (
              <>
                <AlertCircle size={32} className="text-accent-rust" />
                <div className="text-center">
                  <p className="font-medium text-kraft-700">Export failed</p>
                  <p className="text-sm text-kraft-400 mt-1">{job.error_message ?? 'Unknown error'}</p>
                </div>
                <Button variant="ghost" onClick={() => setJob(null)}>Try again</Button>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
