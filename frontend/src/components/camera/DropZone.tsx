import { useState, useCallback } from 'react'
import { Package, Upload } from 'lucide-react'
import { useCameraStore } from '@/store/cameraStore'
import { generateTempId } from '@/lib/utils'

export function DropZone() {
  const [isDragging, setIsDragging] = useState(false)
  const { addToQueue, activeLocationId, activeSiteId } = useCameraStore()

  const handleFiles = useCallback(
    (files: File[]) => {
      if (!activeSiteId) return
      files
        .filter((f) => f.type.startsWith('image/'))
        .forEach((file) => {
          addToQueue({
            tempId: generateTempId(),
            blob: file,
            siteId: activeSiteId,
            locationId: activeLocationId,
            capturedAt: new Date().toISOString(),
            uploadStatus: 'pending',
            thumbnailUrl: URL.createObjectURL(file),
          })
        })
    },
    [activeSiteId, activeLocationId, addToQueue]
  )

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = () => setIsDragging(false)

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    handleFiles(files)
    e.target.value = ''
  }

  return (
    <label
      className={`
        flex flex-col items-center justify-center gap-3
        w-full min-h-[160px] rounded-xl cursor-pointer
        border-2 border-dashed transition-all duration-150
        ${isDragging
          ? 'border-kraft-500 bg-kraft-200'
          : 'border-kraft-300 bg-kraft-100 hover:border-kraft-400 hover:bg-kraft-100/80'
        }
      `}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <div className={`p-4 rounded-full transition-colors ${isDragging ? 'bg-kraft-300' : 'bg-kraft-200'}`}>
        {isDragging ? (
          <Upload className="w-6 h-6 text-kraft-600" />
        ) : (
          <Package className="w-6 h-6 text-kraft-500" />
        )}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-kraft-600">
          {isDragging ? 'Drop to add' : 'Drop photos here'}
        </p>
        <p className="text-xs text-kraft-400 mt-0.5">
          or click to browse · JPG, PNG, HEIC
        </p>
      </div>
      <input
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={onFileInput}
      />
    </label>
  )
}
