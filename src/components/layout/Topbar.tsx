"use client";

export default function Topbar() {
  return (
    <header className="flex h-[50px] w-full items-center gap-[10px] border-b border-[#e5e7eb] bg-white px-5">
      <div className="flex flex-1">
        <input
          type="search"
          placeholder="Search clients, notes, documents…"
          className="h-9 w-full max-w-[280px] rounded-[7px] bg-[#F2F4F6] px-3 text-[12px] text-[#113238] outline-none placeholder:text-[#9ca3af]"
        />
      </div>
      <button
        type="button"
        className="h-8 rounded-[7px] border border-[#e5e7eb] px-3 text-[12px] text-[#6b7280]"
      >
        Filter
      </button>
      <button
        type="button"
        className="h-8 rounded-[7px] bg-[#FF8C42] px-3 text-[12px] font-medium text-white"
      >
        New Client
      </button>
    </header>
  );
}
