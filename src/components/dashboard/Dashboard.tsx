"use client"

type DashboardProps = {
  totalCount: number
  activeCount: number
  prospectCount: number
  workflowCount: number
}

function formatToday() {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date())
}

function StatCard({
  label,
  value,
  accentClassName,
  valueColor = "#113238",
}: {
  label: string
  value: number
  accentClassName?: string
  valueColor?: string
}) {
  return (
    <div
      className={`rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white px-[14px] py-3 ${
        accentClassName ?? ""
      }`}
    >
      <p className="text-[11px] uppercase tracking-[0.4px] text-[#6b7280]">{label}</p>
      <p className="mt-2 text-[22px] font-semibold" style={{ color: valueColor }}>
        {value}
      </p>
    </div>
  )
}

function CardHeader({
  title,
  action,
}: {
  title: string
  action: string
}) {
  return (
    <div className="flex items-center justify-between border-b-[0.5px] border-[#e5e7eb] px-[14px] py-[11px]">
      <h2 className="text-[13px] font-semibold text-[#113238]">{title}</h2>
      <button type="button" className="text-[11px] text-[#FF8C42]">
        {action}
      </button>
    </div>
  )
}

function EmptyCardBody({
  text,
  className,
}: {
  text: string
  className: string
}) {
  return <div className={className}>{text}</div>
}

export default function Dashboard({
  totalCount,
  activeCount,
  prospectCount,
  workflowCount,
}: DashboardProps) {
  const today = formatToday()

  return (
    <div className="p-6">
      <div className="mb-[18px] flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold tracking-[-0.3px] text-[#113238]">
            Good morning, Andrew
          </h1>
          <p className="mt-[2px] text-[13px] text-[#6b7280]">
            Here is what is happening at ARWM today
          </p>
        </div>
        <div className="rounded-[7px] border-[0.5px] border-[#e5e7eb] bg-white px-3 py-[6px] text-[12px] text-[#6b7280]">
          {today}
        </div>
      </div>

      <div className="mb-[18px] grid grid-cols-6 gap-[10px]">
        <StatCard label="Active Clients" value={activeCount} accentClassName="border-l-[2.5px] border-l-[#BFE3D3]" />
        <StatCard label="Total Contacts" value={totalCount} />
        <StatCard label="Prospects" value={prospectCount} />
        <StatCard
          label="Active Alerts"
          value={0}
          accentClassName="border-l-[2.5px] border-l-[#FF8C42]"
          valueColor="#FF8C42"
        />
        <StatCard
          label="Reviews Due"
          value={0}
          accentClassName="border-l-[2.5px] border-l-[#FF8C42]"
          valueColor="#FF8C42"
        />
        <StatCard label="Open Workflows" value={workflowCount} />
      </div>

      <div className="grid grid-cols-2 gap-[14px]">
        <div className="overflow-hidden rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white">
          <CardHeader title="Today's agenda" action="Open Outlook →" />
          <EmptyCardBody
            text="Connect Outlook to see today's meetings"
            className="px-[14px] py-3 text-center text-[13px] text-[#9ca3af]"
          />
        </div>

        <div className="overflow-hidden rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white">
          <CardHeader title="Active alerts" action="View all →" />
          <EmptyCardBody
            text="No active alerts"
            className="px-[14px] py-6 text-center text-[13px] text-[#9ca3af]"
          />
        </div>
      </div>

      <div className="mt-[14px] grid grid-cols-[1.3fr_1fr] gap-[14px]">
        <div className="overflow-hidden rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white">
          <CardHeader title="Reviews due — next 30 days" action="View all →" />
          <EmptyCardBody
            text="No reviews due"
            className="px-[14px] py-6 text-center text-[13px] text-[#9ca3af]"
          />
        </div>

        <div className="overflow-hidden rounded-[12px] border-[0.5px] border-[#e5e7eb] bg-white">
          <CardHeader title="Recent activity" action="All activity →" />
          <EmptyCardBody
            text="No recent activity"
            className="px-[14px] py-6 text-center text-[13px] text-[#9ca3af]"
          />
        </div>
      </div>
    </div>
  )
}
