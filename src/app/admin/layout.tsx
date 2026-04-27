import Link from "next/link"

import { requireAdmin } from "@/lib/auth"

const adminNavItems = [
  { href: "/admin/templates", label: "Templates", enabled: true },
  { href: "/admin/email-templates", label: "Email templates", enabled: false },
  { href: "/admin/nudges", label: "Nudges", enabled: false },
  { href: "/admin/calendly-event-types", label: "Calendly event types", enabled: false },
  { href: "/admin/driver-actions", label: "Driver actions", enabled: false },
  { href: "/admin/constants", label: "Constants", enabled: false },
  { href: "/admin/users", label: "Users", enabled: true },
] as const

function initialsForName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A"
}

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const adminUser = await requireAdmin()

  return (
    <div className="flex min-h-screen bg-[#F7F9FB]">
      <aside className="flex w-[238px] shrink-0 flex-col border-r border-[#d9e2e7] bg-white px-4 py-5">
        <div className="flex items-center gap-3 border-b border-[#e5e7eb] pb-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#113238] text-[13px] font-semibold text-[#BFE3D3]">
            AD
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[#113238]">Admin</p>
            <p className="text-[11px] text-[#6b7280]">Read-only console</p>
          </div>
        </div>

        <nav className="mt-5 flex flex-1 flex-col gap-1.5">
          {adminNavItems.map((item) =>
            item.enabled ? (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-[7px] px-3 py-2 text-[13px] font-medium text-[#113238] hover:bg-[#EAF0F1]"
              >
                <span>{item.label}</span>
              </Link>
            ) : (
              <div
                key={item.href}
                className="flex items-center justify-between rounded-[7px] px-3 py-2 text-[13px] text-[#9ca3af]"
              >
                <span>{item.label}</span>
                <span className="rounded-[999px] bg-[#F3F4F6] px-2 py-0.5 text-[10px] text-[#6b7280]">
                  Soon
                </span>
              </div>
            ),
          )}
        </nav>

        <div className="mt-5 flex items-center gap-3 border-t border-[#e5e7eb] pt-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF8C42] text-[11px] font-semibold text-white">
            {initialsForName(adminUser.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-[#113238]">{adminUser.name}</p>
            <p className="truncate text-[11px] text-[#6b7280]">{adminUser.role}</p>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
