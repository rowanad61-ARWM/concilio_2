"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
};

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
        <path
          d="M2.5 2.5H6.5V6.5H2.5V2.5ZM9.5 2.5H13.5V9H9.5V2.5ZM2.5 9.5H6.5V13.5H2.5V9.5ZM9.5 12H13.5V13.5H9.5V12Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/clients",
    label: "Clients",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
        <path
          d="M5.5 7A2.5 2.5 0 1 0 5.5 2a2.5 2.5 0 0 0 0 5ZM10.75 8.5A2.25 2.25 0 1 0 10.75 4a2.25 2.25 0 0 0 0 4.5ZM2 12.75C2.55 10.95 4.08 10 5.5 10c1.42 0 2.95.95 3.5 2.75M9 12.75c.35-1.2 1.39-1.9 2.45-1.9 1.06 0 2.1.7 2.55 1.9"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/workflows",
    label: "Workflows",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
        <path
          d="M3 4h4M9 4h4M6.5 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM12.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM9.5 12H3M12 4v4M4 12V8h8"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/communications",
    label: "Communications",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
        <path
          d="M2.5 4.25A1.75 1.75 0 0 1 4.25 2.5h7.5A1.75 1.75 0 0 1 13.5 4.25v5.5A1.75 1.75 0 0 1 11.75 11.5h-4.5l-2.75 2v-2H4.25A1.75 1.75 0 0 1 2.5 9.75v-5.5Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/alerts",
    label: "Alerts",
    badge: "3",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
        <path
          d="M8 2.25a2.5 2.5 0 0 0-2.5 2.5v1.07c0 .53-.2 1.05-.57 1.42L4 8.17v.58h8v-.58l-.93-.93A2 2 0 0 1 10.5 5.82V4.75A2.5 2.5 0 0 0 8 2.25ZM6.5 10.5a1.5 1.5 0 0 0 3 0"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/documents",
    label: "Documents",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
        <path
          d="M5 2.5h4l2 2v7A1.5 1.5 0 0 1 9.5 13h-4A1.5 1.5 0 0 1 4 11.5v-7A1.5 1.5 0 0 1 5.5 3h3.25M9 2.75V5h2.25M6 8h4M6 10.5h4"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
        <path
          d="M8 3.25v-1M8 13.75v-1M12.75 8h1M2.25 8h1M11.36 4.64l.7-.7M3.94 12.06l.7-.7M11.36 11.36l.7.7M3.94 3.94l.7.7M10 8A2 2 0 1 1 6 8a2 2 0 0 1 4 0Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

function LogoMark() {
  return (
    <svg viewBox="0 0 52 32" fill="none" className="h-8 w-[52px]">
      <path
        d="M22 4C14.268 4 8 10.268 8 18C8 25.732 14.268 32 22 32C27.694 32 32.594 28.601 34.783 23.722"
        stroke="#BFE3D3"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M32.602 9.148C30.056 6.008 26.166 4 21.807 4"
        stroke="#FF8C42"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M39.5 18H51"
        stroke="#BFE3D3"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-[210px] shrink-0 flex-col bg-[#113238] px-4 py-5">
      <div className="flex items-center gap-2.5">
        <LogoMark />
        <span className="text-xs font-semibold tracking-[0.8px] text-[#BFE3D3]">
          CONCILIO
        </span>
      </div>

      <nav className="mt-9 flex flex-1 flex-col gap-1.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-[9px] rounded-[7px] px-[9px] py-[7px] text-[12px] ${
                isActive
                  ? "bg-[rgba(191,227,211,0.11)] font-medium text-[#BFE3D3]"
                  : "text-[rgba(191,227,211,0.55)]"
              }`}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="rounded-[10px] bg-[#FF8C42] px-[6px] py-[1px] text-[10px] text-white">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#FF8C42] text-[11px] font-medium text-white">
          AR
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[#BFE3D3]">Andrew Rowan</p>
          <p className="text-[10px] text-[rgba(191,227,211,0.4)]">Owner · Adviser</p>
        </div>
      </div>
    </aside>
  );
}

