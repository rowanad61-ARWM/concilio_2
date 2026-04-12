"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"

export default function Topbar() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const lastSubmittedRef = useRef("")

  function navigateToSearch(value: string) {
    const trimmed = value.trim()

    if (lastSubmittedRef.current === trimmed) {
      return
    }

    lastSubmittedRef.current = trimmed

    if (!trimmed) {
      router.push("/clients")
      return
    }

    router.push(`/clients?search=${encodeURIComponent(trimmed)}`)
  }

  useEffect(() => {
    const trimmed = query.trim()

    const timeoutId = setTimeout(() => {
      if (lastSubmittedRef.current === trimmed) {
        return
      }

      lastSubmittedRef.current = trimmed

      if (!trimmed) {
        router.push("/clients")
        return
      }

      router.push(`/clients?search=${encodeURIComponent(trimmed)}`)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query, router])

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault()
      navigateToSearch(query)
    }
  }

  function handleClearSearch() {
    setQuery("")
    navigateToSearch("")
  }

  return (
    <header className="flex h-[50px] w-full items-center gap-[10px] border-b border-[#e5e7eb] bg-white px-5">
      <div className="relative flex flex-1">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search clients, notes, documents…"
          className="h-9 w-full max-w-[280px] rounded-[7px] bg-[#F2F4F6] px-3 pr-8 text-[13px] text-[#113238] outline-none placeholder:text-[#9ca3af]"
        />
        {query ? (
          <button
            type="button"
            onClick={handleClearSearch}
            className="absolute right-0 top-1/2 -translate-y-1/2 px-2 text-[13px] text-[#6b7280]"
          >
            {"\u00D7"}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className="h-8 rounded-[7px] border border-[#e5e7eb] px-3 text-[13px] text-[#6b7280]"
      >
        Filter
      </button>
      <button
        type="button"
        onClick={() => router.push("/clients/new")}
        className="h-8 rounded-[7px] bg-[#FF8C42] px-3 text-[13px] font-medium text-white"
      >
        New Client
      </button>
    </header>
  )
}
