"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { HouseholdListItem } from "@/types/clients";

type FilterValue = "all" | "active" | "inactive" | "lapsed";

type ClientListProps = {
  householdItems: HouseholdListItem[];
  prospectCount: number;
  householdAwareTotal: number;
  householdAwareActive: number;
  contactCount: number;
};

const filters: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Lapsed", value: "lapsed" },
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

function getPrimaryMemberId(item: HouseholdListItem) {
  return item.members.find((member) => member.role === "primary")?.id ?? item.members[0]?.id ?? item.id;
}

function GroupAvatar({ item }: { item: HouseholdListItem }) {
  if (item.isHousehold && item.members.length > 1) {
    const first = item.members[0];
    const second = item.members[1];

    return (
      <div className="relative h-[30px] w-[46px] shrink-0">
        <div className="absolute left-0 top-0 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#EAF0F1] text-[11px] font-semibold text-[#113238]">
          {getInitials(first.displayName)}
        </div>
        <div className="absolute left-[16px] top-0 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#EAF0F1] text-[11px] font-semibold text-[#113238]">
          {getInitials(second.displayName)}
        </div>
      </div>
    );
  }

  const avatarName = item.members[0]?.displayName ?? item.displayName;

  return (
    <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#EAF0F1] text-[11px] font-semibold text-[#113238]">
      {getInitials(avatarName)}
    </div>
  );
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

function formatClassification(value: string) {
  if (value === "person") {
    return "person";
  }

  if (value === "wealth_manager_plus") {
    return "Wealth Manager+";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getClassificationClasses(value: string) {
  switch (value) {
    case "wealth_manager_plus":
      return "bg-[#FEF0E7] text-[#C45F1A]";
    case "wealth_manager":
      return "bg-[#EAF0F1] text-[#113238]";
    case "cashflow_manager":
      return "bg-[#E6F0EC] text-[#0F5C3A]";
    case "transaction":
      return "bg-[#E6F1FB] text-[#185FA5]";
    case "prospect":
    case "engagement":
    case "advising":
    case "implementation":
      return "bg-[#F1EDF8] text-[#7B4FA8]";
    default:
      return "bg-[#F3F4F6] text-[#6B7280]";
  }
}

export default function ClientList({
  householdItems,
  prospectCount,
  householdAwareTotal,
  householdAwareActive,
  contactCount,
}: ClientListProps) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterValue>("all");

  const filteredItems =
    activeFilter === "all"
      ? householdItems
      : activeFilter === "lapsed"
        ? householdItems.filter((item) => item.classification?.lifecycleStage?.toLowerCase() === "lapsed")
        : householdItems.filter((item) => item.status.toLowerCase() === activeFilter);

  return (
    <div className="p-6">
      <div className="mb-[18px] flex items-center gap-2">
        <h1 className="text-[17px] font-semibold text-[#113238]">Clients</h1>
        <p className="text-[12px] text-[#6b7280]">{contactCount} contacts</p>
      </div>

      <div className="mb-[18px] grid grid-cols-4 gap-[10px]">
        <div className="rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white px-[14px] py-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#6b7280]">Total Clients</p>
          <p className="mt-2 text-[21px] font-semibold text-[#113238]">{householdAwareTotal}</p>
        </div>
        <div className="rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white px-[14px] py-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#6b7280]">Active</p>
          <p className="mt-2 text-[21px] font-semibold text-[#113238]">{householdAwareActive}</p>
        </div>
        <div className="rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white px-[14px] py-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#6b7280]">Prospects</p>
          <p className="mt-2 text-[21px] font-semibold text-[#113238]">{prospectCount}</p>
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

        {filteredItems.map((item) => {
          const primaryMemberId = getPrimaryMemberId(item);

          return (
            <div
              key={item.id}
              onClick={() => router.push(`/clients/${primaryMemberId}`)}
            className="grid cursor-pointer grid-cols-[minmax(0,1.8fr)_140px_140px_110px] items-center border-b-[0.5px] border-[#e5e7eb] px-[14px] py-[11px] hover:bg-[#F5F7FA]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <GroupAvatar item={item} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[#113238]">{item.displayName}</p>
                  {item.isHousehold ? (
                    <p className="mt-1 truncate text-[10px] text-[#9ca3af]">
                      {item.members.map((member) => member.displayName).join(" · ")}
                    </p>
                  ) : null}
                  <div className="mt-1">
                    <span
                      className={`inline-flex rounded-[999px] px-[8px] py-[3px] text-[11px] ${
                        getClassificationClasses(
                          item.classification?.serviceTier ||
                            item.classification?.lifecycleStage ||
                            "person",
                        )
                      }`}
                    >
                      {formatClassification(
                        item.classification?.serviceTier ||
                          item.classification?.lifecycleStage ||
                          "person",
                      )}
                    </span>
                  </div>
                  {item.householdName && item.householdName !== item.displayName ? (
                    <p className="mt-1 text-[10px] text-[#9ca3af]">{item.householdName}</p>
                  ) : null}
                </div>
              </div>
              <div>
                <span
                  className={`inline-flex rounded-[999px] px-[8px] py-[3px] text-[11px] ${getStatusClasses(item.status)}`}
                >
                  {item.status}
                </span>
              </div>
              <div className="text-[11px] text-[#9ca3af]">{formatUpdatedAt(item.updatedAt)}</div>
              <div>
                <Link
                  href={`/clients/${primaryMemberId}`}
                  onClick={(event) => event.stopPropagation()}
                  className="inline-flex rounded-[6px] border-[0.5px] border-[#e5e7eb] px-[10px] py-1 text-[11px] text-[#113238]"
                >
                  View
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
