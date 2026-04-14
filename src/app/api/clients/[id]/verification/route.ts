import { NextResponse } from "next/server"
import { db } from "@/lib/db"

const PLACEHOLDER_VERIFIED_BY = "00000000-0000-0000-0000-000000000001"
const VALID_RESULTS = ["verified", "pending", "failed", "expired"]

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const payload = await request.json()
    const documentType = typeof payload.documentType === "string" ? payload.documentType.trim() : ""
    const documentReference = typeof payload.documentReference === "string" ? payload.documentReference.trim() : ""
    const expiryDate = typeof payload.expiryDate === "string" ? payload.expiryDate.trim() : ""
    const notes = typeof payload.notes === "string" ? payload.notes.trim() : ""
    let result = typeof payload.result === "string" ? payload.result.toLowerCase() : "pending"
    if (result === "pass") result = "verified"
    if (result === "fail") result = "failed"
    if (!documentType || !VALID_RESULTS.includes(result)) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 })
    }
    let parsedExpiryDate: Date | null = null
    if (expiryDate) {
      parsedExpiryDate = new Date(expiryDate)
      if (Number.isNaN(parsedExpiryDate.getTime())) {
        return NextResponse.json({ error: "invalid expiry date" }, { status: 400 })
      }
    }
    const verificationCheck = await db.verification_check.create({
      data: {
        party_id: id,
        check_type: "identity_document",
        identity_document_type: documentType,
        document_reference: documentReference || null,
        verification_method: "manual",
        result,
        verified_at: result === "verified" ? new Date() : null,
        verified_by: PLACEHOLDER_VERIFIED_BY,
        expiry_date: parsedExpiryDate,
        notes: notes || null,
      },
    })
    return NextResponse.json(verificationCheck)
  } catch (err) {
    console.error("[client verification create error]", err)
    return NextResponse.json({ error: "failed to create verification check" }, { status: 500 })
  }
}
