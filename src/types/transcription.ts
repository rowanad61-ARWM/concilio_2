export type SpeakerSegment = {
  speaker_id: number
  start: number
  end: number
  text: string
}

export type TranscriptionResult = {
  text: string
  speaker_segments: SpeakerSegment[]
  duration_seconds: number | null
}

export type MeetingTranscriptCreateInput = {
  transcript_text: string
  speaker_segments: SpeakerSegment[]
  speaker_name_map: Record<string, string>
  recording_url: string
  transcription_model: string
  transcription_at: Date
  calendly_event_uuid?: string | null
  engagement_id?: string | null
}
