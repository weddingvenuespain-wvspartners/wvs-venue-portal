"use client"

import * as React from "react"
import { Upload, X, ImageIcon, Loader2, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  value?: string | null
  onUpload: (file: File) => Promise<void> | void
  onRemove?: () => void
  beforeUpload?: (file: File) => Promise<File | null>
  accept?: string
  maxSizeMb?: number
  aspectRatio?: number
  height?: number | string
  label?: string
  hint?: string
  disabled?: boolean
  hasError?: boolean
  alt?: string
  className?: string
  objectFit?: "cover" | "contain"
}

const DEFAULT_ACCEPT = "image/jpeg,image/png,image/webp"
const DEFAULT_MAX_MB = 10

export function ImageUploader({
  value,
  onUpload,
  onRemove,
  beforeUpload,
  accept = DEFAULT_ACCEPT,
  maxSizeMb = DEFAULT_MAX_MB,
  aspectRatio,
  height,
  label = "Sube una imagen",
  hint,
  disabled = false,
  hasError = false,
  alt = "",
  className,
  objectFit = "cover",
}: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [dragOver, setDragOver] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const acceptList = React.useMemo(
    () => accept.split(",").map((s) => s.trim().toLowerCase()),
    [accept]
  )

  const validate = (file: File): string | null => {
    if (!acceptList.some((a) => (a.startsWith(".") ? file.name.toLowerCase().endsWith(a) : file.type === a || a === "image/*"))) {
      return `Formato no admitido. Acepta: ${accept.replaceAll("image/", "").toUpperCase()}`
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      return `Archivo demasiado grande (máx. ${maxSizeMb} MB)`
    }
    return null
  }

  const handleFile = async (raw: File) => {
    setError(null)
    const err = validate(raw)
    if (err) {
      setError(err)
      return
    }
    const file = beforeUpload ? await beforeUpload(raw) : raw
    if (!file) return
    setUploading(true)
    try {
      await onUpload(file)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir el archivo")
    } finally {
      setUploading(false)
    }
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) void handleFile(f)
    e.target.value = ""
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled || uploading) return
    const f = e.dataTransfer.files?.[0]
    if (f) void handleFile(f)
  }

  const previewStyle: React.CSSProperties = aspectRatio
    ? { aspectRatio: String(aspectRatio) }
    : { height: typeof height === "number" ? `${height}px` : height || "200px" }

  const showPreview = !!value

  return (
    <div className={cn("w-full", className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled && !uploading) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "group relative overflow-hidden rounded-lg border bg-muted/30 transition-colors",
          hasError || error ? "border-destructive" : "border-border",
          dragOver && !disabled && !uploading && "border-primary bg-primary/5",
          disabled && "cursor-not-allowed opacity-60"
        )}
        style={previewStyle}
      >
        {showPreview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value!}
              alt={alt}
              className={cn("h-full w-full", objectFit === "contain" ? "object-contain" : "object-cover")}
            />

            {!disabled && (
              <div className="absolute inset-0 flex items-end justify-end gap-2 bg-gradient-to-t from-black/45 via-transparent to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-white/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-white"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Cambiar
                </button>
                {onRemove && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      onRemove()
                    }}
                    disabled={uploading}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/95 text-destructive shadow-sm transition-colors hover:bg-white"
                    aria-label="Eliminar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
            className={cn(
              "flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center",
              !disabled && !uploading && "cursor-pointer hover:bg-muted/60"
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full",
                hasError || error ? "bg-destructive/10 text-destructive" : "bg-background text-muted-foreground"
              )}
            >
              <ImageIcon className="h-5 w-5" />
            </div>
            <div className="text-sm font-medium text-foreground">{label}</div>
            <div className="text-xs text-muted-foreground">
              {hint ?? `Arrastra una imagen o haz clic — ${accept.replaceAll("image/", "").toUpperCase()} (máx. ${maxSizeMb} MB)`}
            </div>
          </button>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-md bg-white/95 px-3 py-1.5 text-xs font-medium shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Subiendo…
            </div>
          </div>
        )}
      </div>

      {error && <div className="mt-1.5 text-xs text-destructive">{error}</div>}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled || uploading}
        onChange={onInputChange}
      />
    </div>
  )
}

ImageUploader.displayName = "ImageUploader"
