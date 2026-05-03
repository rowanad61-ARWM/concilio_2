import type { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { writeAuditEvent } from "@/lib/audit"
import { db } from "@/lib/db"
import {
  applyFactPublishDecisions,
  parsePublishFacts,
  type FactFieldAuditEvent,
  type PublishFactInput,
} from "@/lib/file-note-fact-publish"
import {
  canReviewFileNote,
  draftContentFromFileNote,
  isMeaningfulFileNoteText,
  loadFileNoteAccessContext,
  resolveReviewActor,
  toJsonCompatible,
} from "@/lib/file-note-review"
import { writeTimelineEntry } from "@/lib/timeline"

type RouteContext = {
  params: Promise<{ id: string }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function firstForwardedIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null
}

function clientIp(headers: Headers) {
  return (
    firstForwardedIp(headers) ??
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    headers.get("true-client-ip")
  )
}

type PublishTaskInput = {
  id: string
  ticked: boolean
  text: string
  owner_side: "us" | "client"
  task_type: string | null
  task_subtype: string | null
  due_date: string | null
  source_quote: string | null
}

function nullableString(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function parseDueDate(value: unknown) {
  const trimmed = nullableString(value)
  if (trimmed === undefined) {
    return undefined
  }

  if (!trimmed) {
    return null
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return undefined
  }

  return trimmed
}

function dueDateToDate(value: string | null) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null
}

function normalizePublishTask(value: unknown, index: number): PublishTaskInput | { error: string } {
  if (!isRecord(value)) {
    return { error: `task ${index + 1} must be an object` }
  }

  const id = nullableString(value.id) ?? `task-${index + 1}`
  const text = nullableString(value.text) ?? ""
  const ownerSide = value.owner_side === "client" ? "client" : "us"
  const taskType = nullableString(value.task_type)
  const taskSubtype = nullableString(value.task_subtype)
  const dueDate = parseDueDate(value.due_date)
  const sourceQuote = nullableString(value.source_quote)

  if (taskType === undefined || taskSubtype === undefined || sourceQuote === undefined || dueDate === undefined) {
    return { error: `task ${index + 1} contains invalid field types` }
  }

  return {
    id,
    ticked: value.ticked !== false,
    text,
    owner_side: ownerSide,
    task_type: taskType,
    task_subtype: taskSubtype,
    due_date: dueDate,
    source_quote: sourceQuote,
  }
}

async function parsePublishTasks(request: Request) {
  const bodyText = await request.text()
  if (!bodyText.trim()) {
    return { tasks: null as PublishTaskInput[] | null, facts: null as PublishFactInput[] | null }
  }

  let payload: unknown
  try {
    payload = JSON.parse(bodyText)
  } catch {
    return { error: "invalid json body" }
  }

  if (!isRecord(payload)) {
    return { error: "json body must be an object" }
  }

  let tasks: PublishTaskInput[] | null = null
  if (Object.prototype.hasOwnProperty.call(payload, "tasks")) {
    if (!Array.isArray(payload.tasks)) {
      return { error: "tasks must be an array" }
    }

    tasks = []
    for (let index = 0; index < payload.tasks.length; index += 1) {
      const normalized = normalizePublishTask(payload.tasks[index], index)
      if ("error" in normalized) {
        return { error: normalized.error }
      }
      if (normalized.ticked && !normalized.text.trim()) {
        return { error: `task ${index + 1} text is required when ticked` }
      }
      tasks.push(normalized)
    }
  }

  const factParseResult = parsePublishFacts(payload)
  if ("error" in factParseResult) {
    return { error: factParseResult.error }
  }

  return { tasks, facts: factParseResult.facts }
}

export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth()
  const actor = await resolveReviewActor(session)
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const accessContext = await loadFileNoteAccessContext(id)
  if (!accessContext || !canReviewFileNote(actor, accessContext)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const taskParseResult = await parsePublishTasks(request)
  if ("error" in taskParseResult) {
    return NextResponse.json({ error: taskParseResult.error }, { status: 400 })
  }
  const submittedTasks = taskParseResult.tasks
  const submittedFacts = taskParseResult.facts

  const fileNote = await db.file_note.findUnique({
    where: { id },
    select: {
      id: true,
      party_id: true,
      household_id: true,
      text: true,
      review_state: true,
      ai_draft_content: true,
      transcript_id: true,
      published_at: true,
      published_by: true,
      task_publish_decisions: true,
      fact_publish_decisions: true,
    },
  })

  if (!fileNote) {
    return NextResponse.json({ error: "file note not found" }, { status: 404 })
  }

  if (fileNote.review_state === "published") {
    return NextResponse.json({ error: "file note is already published" }, { status: 409 })
  }

  const publishedContent = draftContentFromFileNote(fileNote.text, fileNote.ai_draft_content).trim()
  if (!publishedContent) {
    return NextResponse.json({ error: "file note content is required before publishing" }, { status: 400 })
  }

  const acceptedTasks = submittedTasks?.filter((task) => task.ticked && task.text.trim()) ?? []
  if (acceptedTasks.length > 0 && !fileNote.party_id) {
    return NextResponse.json({ error: "file note must be linked to a client before tasks can be published" }, { status: 400 })
  }

  const publishedAt = new Date()
  const beforeSnapshot = {
    file_note_id: fileNote.id,
    review_state: fileNote.review_state,
    text: fileNote.text,
    ai_draft_content: fileNote.ai_draft_content,
    transcript_id: fileNote.transcript_id,
    published_at: fileNote.published_at?.toISOString() ?? null,
    published_by: fileNote.published_by,
    task_publish_decisions: fileNote.task_publish_decisions,
    fact_publish_decisions: fileNote.fact_publish_decisions,
  }

  const updated = await db.$transaction(async (tx) => {
    const createdTasks: Array<{
      id: string
      source_task_id: string
      title: string
      actor_side: "us" | "client"
      monday_sync_state: string | null
    }> = []

    for (const task of acceptedTasks) {
      const dueDate = dueDateToDate(task.due_date)
      const created = await tx.task.create({
        data: {
          clientId: fileNote.party_id as string,
          title: task.text.trim(),
          description: task.source_quote ? `Source quote: ${task.source_quote}` : null,
          type: task.task_type ?? "Adhoc",
          subtype: task.task_subtype,
          status: "NOT_STARTED",
          actor_side: task.owner_side,
          dueDateStart: dueDate,
          dueDateEnd: null,
          source_file_note_id: fileNote.id,
          monday_sync_state: task.owner_side === "us" ? "pending" : null,
        },
      })

      createdTasks.push({
        id: created.id,
        source_task_id: task.id,
        title: created.title,
        actor_side: task.owner_side,
        monday_sync_state: created.monday_sync_state,
      })

      await writeTimelineEntry(
        {
          party_id: created.clientId,
          kind: "task",
          title: `Task created: ${created.title}`,
          body: created.description,
          actor_user_id: actor.id,
          related_entity_type: "Task",
          related_entity_id: created.id,
          occurred_at: created.createdAt,
          metadata: {
            status: created.status,
            type: created.type,
            subtype: created.subtype,
            actor_side: task.owner_side,
            monday_sync_state: created.monday_sync_state,
            due_date_start: created.dueDateStart?.toISOString() ?? null,
            source_file_note_id: fileNote.id,
            source_quote: task.source_quote,
          },
        },
        { tx },
      )
    }

    const createdTaskBySourceId = new Map(createdTasks.map((task) => [task.source_task_id, task.id]))
    const taskPublishDecisions = submittedTasks
      ? submittedTasks.map((task) => ({
          ...task,
          created_task_id: createdTaskBySourceId.get(task.id) ?? null,
        }))
      : null
    const factPublishResult = await applyFactPublishDecisions({
      tx,
      fileNote: {
        id: fileNote.id,
        party_id: fileNote.party_id,
        household_id: fileNote.household_id,
      },
      actorId: actor.id,
      facts: submittedFacts,
    })

    const nextFileNote = await tx.file_note.update({
      where: { id: fileNote.id },
      data: {
        text: publishedContent,
        review_state: "published",
        published_at: publishedAt,
        published_by: actor.id,
        task_publish_decisions: taskPublishDecisions ? toJsonCompatible(taskPublishDecisions) : undefined,
        fact_publish_decisions: submittedFacts ? toJsonCompatible(factPublishResult.decisions) : undefined,
        updated_at: publishedAt,
      },
      select: {
        id: true,
        text: true,
        review_state: true,
        published_at: true,
        published_by: true,
        transcript_id: true,
        task_publish_decisions: true,
        fact_publish_decisions: true,
      },
    })

    const timelineEntries = await tx.timeline_entry.findMany({
      where: {
        related_entity_type: "file_note",
        related_entity_id: fileNote.id,
      },
      select: {
        id: true,
        metadata: true,
      },
    })

    for (const entry of timelineEntries) {
      const currentMetadata = isRecord(entry.metadata) ? entry.metadata : {}
      await tx.timeline_entry.update({
        where: { id: entry.id },
        data: {
          title: "File note published",
          body: publishedContent,
          updated_at: publishedAt,
          metadata: toJsonCompatible({
            ...currentMetadata,
            review_state: "published",
            published_at: publishedAt.toISOString(),
            published_by: actor.id,
          }) as Prisma.InputJsonValue,
        },
      })
    }

    await tx.alert_instance.updateMany({
      where: {
        alert_type: "file_note_review_outstanding",
        entity_type: "file_note",
        entity_id: fileNote.id,
        cleared_at: null,
      },
      data: {
        cleared_at: publishedAt,
      },
    })

    return {
      fileNote: nextFileNote,
      createdTasks,
      taskPublishDecisions,
      factPublishResult,
    }
  })

  const afterSnapshot = {
    file_note_id: updated.fileNote.id,
    review_state: updated.fileNote.review_state,
    content_published: updated.fileNote.text,
    ai_draft_content: fileNote.ai_draft_content,
    transcript_id: updated.fileNote.transcript_id,
    published_at: updated.fileNote.published_at?.toISOString() ?? null,
    published_by: updated.fileNote.published_by,
    task_publish_decisions: updated.fileNote.task_publish_decisions,
    fact_publish_decisions: updated.fileNote.fact_publish_decisions,
    created_tasks: updated.createdTasks,
  }
  const taskCounts = submittedTasks
    ? {
        tasks_extracted: submittedTasks.length,
        tasks_accepted: acceptedTasks.length,
        tasks_us: acceptedTasks.filter((task) => task.owner_side === "us").length,
        tasks_client: acceptedTasks.filter((task) => task.owner_side === "client").length,
      }
    : {
        tasks_extracted: 0,
        tasks_accepted: 0,
        tasks_us: 0,
        tasks_client: 0,
      }
  const factCounts = updated.factPublishResult.counts
  const fieldAuditEvents: FactFieldAuditEvent[] = updated.factPublishResult.auditEvents

  await writeAuditEvent({
    userId: actor.id,
    action: "UPDATE",
    entityType: "file_note",
    entityId: updated.fileNote.id,
    channel: "staff_ui",
    actor_ip: clientIp(request.headers),
    actor_user_agent: request.headers.get("user-agent"),
    request_id: request.headers.get("x-request-id"),
    beforeState: beforeSnapshot,
    afterState: afterSnapshot,
    metadata: {
      event: "file_note.published",
      file_note_id: updated.fileNote.id,
      transcript_id: updated.fileNote.transcript_id,
      published_by: actor.id,
      content_published: updated.fileNote.text,
      ai_draft_content: fileNote.ai_draft_content,
      had_adviser_edits: isMeaningfulFileNoteText(fileNote.text),
      ...taskCounts,
      ...factCounts,
    },
  })

  for (const event of fieldAuditEvents) {
    await writeAuditEvent({
      userId: actor.id,
      action: "UPDATE",
      entityType: event.entityType,
      entityId: event.entityId,
      channel: "staff_ui",
      actor_ip: clientIp(request.headers),
      actor_user_agent: request.headers.get("user-agent"),
      request_id: request.headers.get("x-request-id"),
      beforeState: event.beforeState,
      afterState: event.afterState,
      metadata: event.metadata,
    })
  }

  return NextResponse.json({
    id: updated.fileNote.id,
    review_state: updated.fileNote.review_state,
    published_at: updated.fileNote.published_at?.toISOString() ?? null,
    published_by: updated.fileNote.published_by,
    created_task_count: updated.createdTasks.length,
    fact_counts: factCounts,
  })
}
