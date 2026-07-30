"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CloudUpload, ExternalLink, FileVideo, FolderOpen, Loader2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { GoogleDriveIcon } from "@/components/ui/google-drive-icon"
import { cn } from "@/lib/utils"
import { MAX_UPLOAD_FILES, type PostView } from "@/lib/content"
import { deleteAsset } from "../actions"

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const

/**
 * Uploading footage for one post.
 *
 * Files go to a route handler rather than a server action — actions cap the
 * request body at a couple of megabytes, which a single reel clears easily.
 * That also means XHR instead of fetch: it is the only way to get real upload
 * progress, and a client sending 800 MB over hotel wifi needs to see the bar
 * move or they will close the tab.
 */
export function RawUpload({
  postId,
  postTitle,
  folderUrl,
  assets,
  driveEnabled,
  /** Raised styling when the team is actively waiting on this footage. */
  urgent = false,
  kind = "RAW",
}: {
  postId: string
  postTitle: string
  folderUrl: string | null
  assets: PostView["assets"]
  driveEnabled: boolean
  urgent?: boolean
  kind?: "RAW" | "EDIT"
}) {
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [files, setFiles] = React.useState<File[]>([])
  const [progress, setProgress] = React.useState<number | null>(null)
  const [removing, startRemoving] = React.useTransition()

  const uploading = progress !== null

  const upload = () => {
    if (files.length === 0) return

    const formData = new FormData()
    formData.set("kind", kind)
    for (const file of files) formData.append("files", file)

    setProgress(0)
    const request = new XMLHttpRequest()
    request.open("POST", `/api/content/posts/${postId}/upload`)

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100))
    })

    request.addEventListener("load", () => {
      setProgress(null)
      let payload: { error?: string; uploaded?: unknown[] } = {}
      try {
        payload = JSON.parse(request.responseText)
      } catch {
        // A non-JSON body means something upstream failed — the status tells
        // the story well enough on its own.
      }

      if (request.status >= 200 && request.status < 300) {
        const count = payload.uploaded?.length ?? files.length
        toast.success(`${count} ${count === 1 ? "file" : "files"} uploaded. Your team is notified.`)
        setFiles([])
        if (inputRef.current) inputRef.current.value = ""
        router.refresh()
      } else {
        toast.error(payload.error ?? "The upload didn't go through. Try again.")
      }
    })

    request.addEventListener("error", () => {
      setProgress(null)
      toast.error("The upload was interrupted. Check your connection and try again.")
    })

    request.send(formData)
  }

  const onRemove = (assetId: string, name: string) => {
    if (!window.confirm(`Remove "${name}" from this post? The file stays in Drive.`)) return
    startRemoving(async () => {
      const formData = new FormData()
      formData.set("assetId", assetId)
      const result = await deleteAsset(formData)
      if (result.ok) {
        toast.success("Removed from the post.")
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  const readableSize =
    totalSize > 0
      ? `${totalSize >= 1024 ** 3 ? (totalSize / 1024 ** 3).toFixed(1) + " GB" : Math.round(totalSize / 1024 ** 2) + " MB"}`
      : ""

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        urgent ? "border-rose-200 bg-rose-50/60" : "bg-muted/30",
      )}
    >
      <p className={cn("flex items-center gap-2 text-sm font-semibold", urgent && "text-rose-700")}>
        <CloudUpload className="size-4 shrink-0" />
        {kind === "RAW" ? "Upload raw footage for this one" : "Upload the edit for this one"}
      </p>
      <p className={cn("mt-1 text-xs", urgent ? "text-rose-700/80" : "text-muted-foreground")}>
        Pick one or more files for <span className="font-medium">&ldquo;{postTitle}&rdquo;</span> —
        every file lands in this post&apos;s own folder on Drive. You can add more at any time, and
        your team is notified once the uploads finish.
      </p>

      {driveEnabled ? (
        <>
          {/* Two explicit steps — pick, then upload. The file input alone reads
              as "done" the moment a name appears next to it, which is how
              footage ends up sitting in a browser tab instead of in Drive. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <FolderOpen /> {files.length > 0 ? "Change files" : "Choose files"}
            </Button>

            <Button
              size="sm"
              disabled={uploading || files.length === 0}
              onClick={upload}
              className={cn(urgent && "bg-rose-600 text-white hover:bg-rose-600/90")}
            >
              {uploading ? <Loader2 className="animate-spin" /> : <CloudUpload />}
              {uploading
                ? `Uploading… ${progress}%`
                : files.length === 0
                  ? kind === "RAW"
                    ? "Upload raw video"
                    : "Upload edit"
                  : `Upload ${files.length} ${files.length === 1 ? "file" : "files"}${readableSize ? ` · ${readableSize}` : ""}`}
            </Button>

            <input
              ref={inputRef}
              type="file"
              multiple
              accept={kind === "RAW" ? "video/*,image/*" : "video/*"}
              disabled={uploading}
              onChange={(event) =>
                setFiles(Array.from(event.target.files ?? []).slice(0, MAX_UPLOAD_FILES))
              }
              aria-label={`Choose files for ${postTitle}`}
              className="sr-only"
            />

            {files.length === 0 ? (
              <span className="text-muted-foreground text-xs">No files chosen yet</span>
            ) : null}
          </div>

          {files.length > 0 && !uploading ? (
            <ul className="text-muted-foreground mt-2 space-y-0.5 text-xs">
              {files.map((file) => (
                <li key={`${file.name}-${file.size}`} className="flex items-center gap-1.5">
                  <FileVideo className="size-3 shrink-0" />
                  <span className="truncate">{file.name}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {uploading ? (
            <div
              className="bg-muted mt-3 h-1.5 w-full overflow-hidden rounded-full"
              role="progressbar"
              aria-valuenow={progress ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Upload progress"
            >
              <div
                className="bg-primary h-full rounded-full transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-muted-foreground mt-3 text-xs">
          In-portal uploads aren&apos;t switched on for this workspace. Add your files to the Drive
          folder below and tell your team — they pick it up from there.
        </p>
      )}

      {assets.length > 0 ? (
        <ul className="mt-4 space-y-1.5 border-t pt-3">
          {assets.map((asset) => (
            <li key={asset.id} className="flex items-center gap-2 text-sm">
              <FileVideo className="text-muted-foreground size-4 shrink-0" />
              {/* Name and meta share a wrapping row: on a phone the size/date
                  drops under the filename instead of squeezing it to nothing. */}
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                {asset.url ? (
                  <a
                    href={asset.url}
                    {...EXTERNAL}
                    className="min-w-0 max-w-full truncate hover:underline"
                    title={asset.name}
                  >
                    {asset.name}
                  </a>
                ) : (
                  <span className="min-w-0 max-w-full truncate">{asset.name}</span>
                )}
                <span className="text-muted-foreground text-xs">
                  {[asset.size, asset.uploadedAt].filter(Boolean).join(" · ")}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={removing}
                onClick={() => onRemove(asset.id, asset.name)}
                aria-label={`Remove ${asset.name}`}
                className="text-muted-foreground hover:text-destructive size-7 shrink-0"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {folderUrl ? (
        <div className="mt-3 border-t pt-3">
          <a
            href={folderUrl}
            {...EXTERNAL}
            className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-xs underline underline-offset-2"
          >
            <GoogleDriveIcon className="size-3.5" />
            Or open the folder in Drive manually
            <ExternalLink className="size-3" />
          </a>
        </div>
      ) : null}
    </div>
  )
}
