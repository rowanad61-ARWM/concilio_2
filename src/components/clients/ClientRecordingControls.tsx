"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type RecordingEngagement = {
  id: string
  title: string
  startsAt: string | null
}

type ClientRecordingControlsProps = {
  partyId: string
  clientDisplayName: string
  isVisible: boolean
  engagement: RecordingEngagement | null
  onClose: () => void
  onSaved: () => void
  onToast?: (message: string, kind?: "success" | "error" | "warning") => void
}

type RecordingStatus = "idle" | "recording" | "paused" | "uploading" | "uploaded" | "error"

const MIME_TYPE_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
]

function chooseMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return ""
  }

  return MIME_TYPE_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? ""
}

function fileExtensionForMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase()
  if (normalized.includes("ogg")) {
    return "ogg"
  }
  if (normalized.includes("mp4") || normalized.includes("mpeg")) {
    return "m4a"
  }
  return "webm"
}

function formatElapsed(totalMs: number) {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function formatMeetingTime(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed)
}

function filenameForRecording(params: {
  clientDisplayName: string
  mimeType: string
  partial?: boolean
}) {
  const extension = fileExtensionForMimeType(params.mimeType)
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const prefix = params.partial ? "partial-recording" : "recording"
  const safeName = params.clientDisplayName.replace(/[\\/:"*?<>|]+/g, "_").trim() || "client"
  return `${safeName}-${prefix}-${timestamp}.${extension}`
}

export default function ClientRecordingControls({
  partyId,
  clientDisplayName,
  isVisible,
  engagement,
  onClose,
  onSaved,
  onToast,
}: ClientRecordingControlsProps) {
  const [status, setStatus] = useState<RecordingStatus>("idle")
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [uploadedNoteId, setUploadedNoteId] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const mimeTypeRef = useRef("")
  const recordingStartedAtRef = useRef<number | null>(null)
  const accumulatedMsRef = useRef(0)
  const uploadStartedRef = useRef(false)

  const isActive = status === "recording" || status === "paused"
  const shouldRender = isVisible || isActive || status === "uploading" || status === "uploaded" || status === "error"

  const currentElapsedMs = useCallback(() => {
    const startedAt = recordingStartedAtRef.current
    if (status === "recording" && startedAt !== null) {
      return accumulatedMsRef.current + Date.now() - startedAt
    }
    return accumulatedMsRef.current
  }, [status])

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const uploadBlob = useCallback(
    async (blob: Blob, params?: { partial?: boolean }) => {
      const formData = new FormData()
      formData.append(
        "recording",
        blob,
        filenameForRecording({
          clientDisplayName,
          mimeType: blob.type || mimeTypeRef.current || "audio/webm",
          partial: params?.partial,
        }),
      )
      if (engagement?.id) {
        formData.append("engagement_id", engagement.id)
      }
      formData.append("duration_seconds", String(Math.round(currentElapsedMs() / 1000)))
      if (params?.partial) {
        formData.append("is_partial", "true")
      }

      const response = await fetch(`/api/clients/${encodeURIComponent(partyId)}/recordings`, {
        method: "POST",
        body: formData,
      })
      const payload = (await response.json().catch(() => null)) as { id?: string; error?: string } | null
      if (response.status !== 201) {
        throw new Error(payload?.error ?? "Failed to upload recording")
      }
      return payload?.id ?? null
    },
    [clientDisplayName, currentElapsedMs, engagement?.id, partyId],
  )

  const sendPartialRecordingBeacon = useCallback(() => {
    if (uploadStartedRef.current || chunksRef.current.length === 0 || typeof navigator === "undefined") {
      return
    }

    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" })
    if (blob.size === 0) {
      return
    }

    const formData = new FormData()
    formData.append(
      "recording",
      blob,
      filenameForRecording({
        clientDisplayName,
        mimeType: blob.type || mimeTypeRef.current || "audio/webm",
        partial: true,
      }),
    )
    if (engagement?.id) {
      formData.append("engagement_id", engagement.id)
    }
    formData.append("duration_seconds", String(Math.round(currentElapsedMs() / 1000)))
    formData.append("is_partial", "true")

    uploadStartedRef.current = navigator.sendBeacon(
      `/api/clients/${encodeURIComponent(partyId)}/recordings`,
      formData,
    )
  }, [clientDisplayName, currentElapsedMs, engagement?.id, partyId])

  const resetRecording = useCallback(() => {
    chunksRef.current = []
    mediaRecorderRef.current = null
    recordingStartedAtRef.current = null
    accumulatedMsRef.current = 0
    uploadStartedRef.current = false
    setElapsedMs(0)
    setUploadedNoteId(null)
    stopTracks()
  }, [stopTracks])

  async function handleStart() {
    setError(null)
    setUploadedNoteId(null)

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("error")
      setError("This browser does not support microphone recording.")
      return
    }

    if (typeof MediaRecorder === "undefined") {
      setStatus("error")
      setError("This browser does not support MediaRecorder.")
      return
    }

    try {
      resetRecording()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = chooseMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      streamRef.current = stream
      mediaRecorderRef.current = recorder
      mimeTypeRef.current = recorder.mimeType || mimeType || "audio/webm"

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        void (async () => {
          const finalElapsed = currentElapsedMs()
          accumulatedMsRef.current = finalElapsed
          recordingStartedAtRef.current = null
          setElapsedMs(finalElapsed)
          stopTracks()

          const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" })
          if (blob.size === 0) {
            setStatus("error")
            setError("No audio was captured.")
            return
          }

          try {
            setStatus("uploading")
            const noteId = await uploadBlob(blob)
            setUploadedNoteId(noteId)
            setStatus("uploaded")
            onSaved()
            onToast?.("Recording uploaded and draft file note created.", "success")
          } catch (uploadError) {
            setStatus("error")
            setError(uploadError instanceof Error ? uploadError.message : "Failed to upload recording.")
            onToast?.("Recording upload failed.", "error")
          }
        })()
      }

      recorder.start(1000)
      recordingStartedAtRef.current = Date.now()
      setStatus("recording")
    } catch (startError) {
      stopTracks()
      setStatus("error")
      setError(startError instanceof Error ? startError.message : "Could not start recording.")
    }
  }

  function handlePause() {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== "recording") {
      return
    }

    accumulatedMsRef.current = currentElapsedMs()
    recordingStartedAtRef.current = null
    recorder.pause()
    setElapsedMs(accumulatedMsRef.current)
    setStatus("paused")
  }

  function handleResume() {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== "paused") {
      return
    }

    recorder.resume()
    recordingStartedAtRef.current = Date.now()
    setStatus("recording")
  }

  function handleStop() {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === "inactive") {
      return
    }

    uploadStartedRef.current = true
    accumulatedMsRef.current = currentElapsedMs()
    recordingStartedAtRef.current = null
    setElapsedMs(accumulatedMsRef.current)
    setStatus("uploading")
    recorder.stop()
  }

  useEffect(() => {
    if (status !== "recording") {
      return
    }

    const intervalId = window.setInterval(() => {
      setElapsedMs(currentElapsedMs())
    }, 500)

    return () => window.clearInterval(intervalId)
  }, [currentElapsedMs, status])

  useEffect(() => {
    if (!isActive) {
      return
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = "A recording is in progress. Leaving will attempt to save a partial recording."
      return event.returnValue
    }

    function handlePageHide() {
      try {
        mediaRecorderRef.current?.requestData()
      } catch {
        // Best effort only during browser unload.
      }
      sendPartialRecordingBeacon()
      stopTracks()
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    window.addEventListener("pagehide", handlePageHide)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      window.removeEventListener("pagehide", handlePageHide)
    }
  }, [isActive, sendPartialRecordingBeacon, stopTracks])

  useEffect(() => {
    return () => {
      stopTracks()
    }
  }, [stopTracks])

  if (!shouldRender) {
    return null
  }

  const meetingTime = formatMeetingTime(engagement?.startsAt ?? null)
  const canClose = status === "idle" || status === "uploaded" || status === "error"

  return (
    <section className="rounded-[8px] border-[0.5px] border-[#e5e7eb] bg-white px-4 py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                status === "recording"
                  ? "bg-[#E24B4A]"
                  : status === "paused"
                    ? "bg-[#B45309]"
                    : "bg-[#9ca3af]"
              }`}
            />
            <h2 className="text-[13px] font-semibold text-[#113238]">
              {engagement ? "Meeting recorder" : "Ad-hoc recorder"}
            </h2>
            <span className="rounded-[999px] border-[0.5px] border-[#e5e7eb] px-2 py-[2px] text-[11px] text-[#6b7280]">
              {formatElapsed(elapsedMs)}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-[#6b7280]">
            {engagement
              ? `${engagement.title}${meetingTime ? ` · ${meetingTime}` : ""}`
              : `Recording for ${clientDisplayName}`}
          </p>
          {status === "uploaded" ? (
            <p className="mt-1 text-[12px] text-[#0F5C3A]">
              Draft file note created{uploadedNoteId ? ` (${uploadedNoteId})` : ""}.
            </p>
          ) : null}
          {error ? <p className="mt-1 text-[12px] text-[#B42318]">{error}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {status === "idle" || status === "uploaded" || status === "error" ? (
            <button
              type="button"
              onClick={() => void handleStart()}
              className="rounded-[7px] border-[0.5px] border-[#113238] bg-[#113238] px-[10px] py-[6px] text-[12px] text-white"
            >
              Start recording
            </button>
          ) : null}
          {status === "recording" ? (
            <button
              type="button"
              onClick={handlePause}
              className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[6px] text-[12px] text-[#113238]"
            >
              Pause
            </button>
          ) : null}
          {status === "paused" ? (
            <button
              type="button"
              onClick={handleResume}
              className="rounded-[7px] border-[0.5px] border-[#113238] bg-[#113238] px-[10px] py-[6px] text-[12px] text-white"
            >
              Resume
            </button>
          ) : null}
          {status === "recording" || status === "paused" ? (
            <button
              type="button"
              onClick={handleStop}
              className="rounded-[7px] border-[0.5px] border-[#E24B4A] bg-[#E24B4A] px-[10px] py-[6px] text-[12px] text-white"
            >
              Stop and upload
            </button>
          ) : null}
          {status === "uploading" ? (
            <span className="rounded-[7px] border-[0.5px] border-[#e5e7eb] px-[10px] py-[6px] text-[12px] text-[#6b7280]">
              Uploading...
            </span>
          ) : null}
          {canClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-[10px] py-[6px] text-[12px] text-[#113238]"
            >
              Close
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
