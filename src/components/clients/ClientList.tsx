"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ClientListItem } from "@/types/clients";

type FilterValue = "all" | "active" | "inactive";

type ClientListProps = {
  clients: ClientListItem[];
};

const filters: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getStatusClasses(status: string) {
  switch (status.toLowerCase()) {
    case "active":
      return "bg-[#E6F0EC] text-[#0F5C3A]";
    case "archived":
      return "bg-[#FDECEC] text-[#B42318]";
    default:
      return "bg-[#F3F4F6] text-[#6B7280]";
  }
}

export default function ClientList({ clients }: ClientListProps) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterValue>("all");

  const filteredClients =
    activeFilter === "all"
      ? clients
      : clients.filter((client) => client.status.toLowerCase() === activeFilter);

  const activeCount = clients.filter((client) => client.status.toLowerCase() === "active").length;

  return (
    <div className="p-6">
      <div className="mb-[18px] flex items-center gap-2">
        <h1 className="text-[17px] font-semibold text-[#113238]">Clients</h1>
        <p className="text-[12px] text-[#6b7280]">{clients.length} contacts</p>
      </div>

      <div className="mb-[18px] grid grid-cols-4 gap-[10px]">
        <div className="rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white px-[14px] py-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#6b7280]">Total Clients</p>
          <p className="mt-2 text-[21px] font-semibold text-[#113238]">{clients.length}</p>
        </div>
        <div className="rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white px-[14px] py-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#6b7280]">Active</p>
          <p className="mt-2 text-[21px] font-semibold text-[#113238]">{activeCount}</p>
        </div>
        <div className="rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white px-[14px] py-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#6b7280]">Prospects</p>
          <p className="mt-2 text-[21px] font-semibold text-[#113238]">0</p>
        </div>
        <div className="rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white px-[14px] py-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#6b7280]">Alerts</p>
          <p className="mt-2 text-[21px] font-semibold text-[#FF8C42]">0</p>
        </div>
      </div>

      <div className="mb-[14px] flex items-center gap-2">
        {filters.map((filter) => {
          const isActive = filter.value === activeFilter;

          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
              className={`cursor-pointer rounded-[20px] border-[0.5px] border-[#e5e7eb] px-[11px] py-1 text-[11px] ${
                isActive ? "bg-[#113238] text-white" : "bg-white text-[#113238]"
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white">
        <div className="grid grid-cols-[minmax(0,1.8fr)_140px_140px_110px] bg-[#F8FAFB] px-[14px] py-[9px] text-[10px] uppercase text-[#6b7280]">
          <span>Client</span>
          <span>Status</span>
          <span>Last updated</span>
          <span>Actions</span>
        </div>

        {filteredClients.map((client) => (
          <div
            key={client.id}
            onClick={() => router.push(`/clients/${client.id}`)}
            className="grid cursor-pointer grid-cols-[minmax(0,1.8fr)_140px_140px_110px] items-center border-b-[0.5px] border-[#e5e7eb] px-[14px] py-[11px] hover:bg-[#F5F7FA]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#EAF0F1] text-[11px] font-semibold text-[#113238]">
                {getInitials(client.fullName)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[#113238]">{client.fullName}</p>
                <p className="mt-0.5 text-[11px] text-[#9ca3af]">{client.partyType}</p>
              </div>
            </div>
            <div>
              <span
                className={`inline-flex rounded-[999px] px-[8px] py-[3px] text-[11px] ${getStatusClasses(client.status)}`}
              >
                {client.status}
              </span>
            </div>
            <div className="text-[11px] text-[#9ca3af]">{formatUpdatedAt(client.updatedAt)}</div>
            <div>
              <Link
                href={`/clients/${client.id}`}
                onClick={(event) => event.stopPropagation()}
                className="inline-flex rounded-[6px] border-[0.5px] border-[#e5e7eb] px-[10px] py-1 text-[11px] text-[#113238]"
              >
                View
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}