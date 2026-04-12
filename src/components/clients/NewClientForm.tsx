"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

type FormState = {
  firstName: string
  lastName: string
  preferredName: string
  dateOfBirth: string
  email: string
  mobile: string
  relationshipStatus: string
  countryOfResidence: string
}

const initialState: FormState = {
  firstName: "",
  lastName: "",
  preferredName: "",
  dateOfBirth: "",
  email: "",
  mobile: "",
  relationshipStatus: "",
  countryOfResidence: "AU",
}

const inputClassName =
  "w-full rounded-[7px] border-[0.5px] border-[#e5e7eb] px-[11px] py-2 text-[13px] text-[#113238] outline-none"

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] text-[#6b7280]">{label}</span>
      {children}
    </label>
  )
}

export default function NewClientForm() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(initialState)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        throw new Error("Failed to create client")
      }

      const result = await response.json()
      router.push(`/clients/${result.id}`)
    } catch (error) {
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-[600px]">
        <Link href="/clients" className="text-[11px] text-[#9ca3af]">
          {"\u2190"} Clients
        </Link>
        <h1 className="mt-2 text-[17px] font-semibold text-[#113238]">New Client</h1>
        <p className="mt-1 text-[12px] text-[#6b7280]">Add a new person to Concilio</p>

        <form onSubmit={handleSubmit} className="mx-auto mt-6 max-w-[600px] px-6 pb-6">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First name">
              <input
                required
                value={form.firstName}
                onChange={(event) => updateField("firstName", event.target.value)}
                className={inputClassName}
              />
            </Field>
            <Field label="Last name">
              <input
                required
                value={form.lastName}
                onChange={(event) => updateField("lastName", event.target.value)}
                className={inputClassName}
              />
            </Field>
          </div>

          <div className="mt-4 space-y-4">
            <Field label="Preferred name">
              <input
                value={form.preferredName}
                onChange={(event) => updateField("preferredName", event.target.value)}
                className={inputClassName}
              />
            </Field>
            <Field label="Date of birth">
              <input
                required
                type="date"
                value={form.dateOfBirth}
                onChange={(event) => updateField("dateOfBirth", event.target.value)}
                className={inputClassName}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className={inputClassName}
              />
            </Field>
            <Field label="Mobile">
              <input
                type="tel"
                value={form.mobile}
                onChange={(event) => updateField("mobile", event.target.value)}
                className={inputClassName}
              />
            </Field>
            <Field label="Relationship status">
              <select
                value={form.relationshipStatus}
                onChange={(event) => updateField("relationshipStatus", event.target.value)}
                className={inputClassName}
              >
                <option value="">Select</option>
                <option value="single">single</option>
                <option value="married">married</option>
                <option value="de_facto">de_facto</option>
                <option value="separated">separated</option>
                <option value="divorced">divorced</option>
                <option value="widowed">widowed</option>
              </select>
            </Field>
            <Field label="Country of residence">
              <input
                value={form.countryOfResidence}
                onChange={(event) => updateField("countryOfResidence", event.target.value)}
                className={inputClassName}
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 w-full rounded-[7px] bg-[#FF8C42] px-4 py-[10px] text-[13px] font-medium text-white disabled:opacity-60"
          >
            Create Client
          </button>
        </form>
      </div>
    </div>
  )
}