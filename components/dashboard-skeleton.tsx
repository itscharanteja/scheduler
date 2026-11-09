import React from "react";

export interface DashboardSkeletonProps {
  type?: "schedule" | "gantt-canvas" | "grid" | "table";
  className?: string;
}

function GanttCanvasSkeleton() {
  const rowOffsets = [
    { left: "12%", width: "28%" },
    { left: "26%", width: "36%" },
    { left: "8%", width: "42%" },
    { left: "44%", width: "30%" },
    { left: "20%", width: "34%" },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E8D9CB] bg-[#FFFDFB]">
      {/* Time header row */}
      <div className="flex border-b border-[#E8D9CB] bg-[#FAF2E9]/70" style={{ minWidth: 820 }}>
        <div className="shrink-0 border-r border-[#E8D9CB] px-4 py-2" style={{ width: 220, minWidth: 220 }}>
          <div className="h-3 w-16 rounded bg-[#EBDDCF] animate-pulse" />
        </div>
        <div className="relative flex-1 flex items-center justify-between px-3" style={{ height: 28 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-2.5 w-7 rounded bg-[#E8D9CB]/70 animate-pulse" />
          ))}
        </div>
      </div>

      {/* 5-row Gantt track skeleton */}
      <div style={{ minWidth: 820 }}>
        {rowOffsets.map((bar, index) => (
          <div
            key={index}
            className="flex items-stretch border-b border-[#E8D9CB]/60 last:border-0"
            style={{ height: 56 }}
          >
            {/* Employee column */}
            <div
              className="flex shrink-0 items-center gap-2.5 border-r border-[#E8D9CB] bg-white px-4 py-2"
              style={{ width: 220, minWidth: 220 }}
            >
              <div className="h-8 w-8 shrink-0 rounded-full bg-[#EBDDCF] animate-pulse" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3.5 w-24 rounded bg-[#EBDDCF] animate-pulse" />
                <div className="h-2.5 w-14 rounded bg-[#F2E5D8] animate-pulse" />
              </div>
            </div>

            {/* Timeline bar column */}
            <div className="relative flex-1 bg-[#FAF5EE]">
              <div
                className="absolute rounded-md border border-[#E8CDB5] bg-[#F4DDC8] animate-pulse"
                style={{
                  top: 8,
                  bottom: 8,
                  left: bar.left,
                  width: bar.width,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-[#E8D9CB] bg-[#FFFDFB] p-5 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-24 rounded bg-[#EBDDCF] animate-pulse" />
            <div className="h-6 w-6 rounded-lg bg-[#FBEAD9] animate-pulse" />
          </div>
          <div className="h-8 w-32 rounded bg-[#DFCBB8] animate-pulse" />
          <div className="h-3 w-40 rounded bg-[#F4E6D8] animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  const rowWidths = [
    ["w-28", "w-36", "w-20", "w-24", "w-16"],
    ["w-32", "w-28", "w-24", "w-20", "w-16"],
    ["w-24", "w-40", "w-20", "w-28", "w-16"],
    ["w-36", "w-32", "w-24", "w-20", "w-16"],
    ["w-28", "w-24", "w-20", "w-32", "w-16"],
    ["w-30", "w-36", "w-24", "w-24", "w-16"],
    ["w-24", "w-28", "w-20", "w-20", "w-16"],
    ["w-32", "w-36", "w-24", "w-28", "w-16"],
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E8D9CB] bg-[#FFFDFB] shadow-sm">
      {/* Header row with 5 columns */}
      <div className="flex items-center justify-between border-b border-[#E8D9CB] bg-[#FAF2E9] px-5 py-3.5">
        <div className="h-3.5 w-24 rounded bg-[#DFCBB8] animate-pulse" />
        <div className="h-3.5 w-32 rounded bg-[#DFCBB8] animate-pulse" />
        <div className="h-3.5 w-20 rounded bg-[#DFCBB8] animate-pulse" />
        <div className="h-3.5 w-28 rounded bg-[#DFCBB8] animate-pulse" />
        <div className="h-3.5 w-16 rounded bg-[#DFCBB8] animate-pulse" />
      </div>

      {/* 8 skeleton rows */}
      <div className="divide-y divide-[#E8D9CB]/50">
        {rowWidths.map((cols, idx) => (
          <div key={idx} className="flex items-center justify-between px-5 py-3.5">
            <div className={`h-3 ${cols[0]} rounded bg-[#EBDDCF] animate-pulse`} />
            <div className={`h-3 ${cols[1]} rounded bg-[#F2E5D8] animate-pulse`} />
            <div className={`h-3 ${cols[2]} rounded bg-[#F2E5D8] animate-pulse`} />
            <div className={`h-3 ${cols[3]} rounded bg-[#EBDDCF] animate-pulse`} />
            <div className={`h-3 ${cols[4]} rounded bg-[#F2E5D8] animate-pulse`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ScheduleFullSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header panel */}
      <div className="rounded-2xl border border-[#E8D9CB] bg-[#FFFDFB] p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[#FAF2E9] animate-pulse" />
            <div className="h-7 w-44 rounded-lg bg-[#FBEAD9] animate-pulse" />
            <div className="h-8 w-8 rounded-lg bg-[#FAF2E9] animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 rounded-lg bg-[#FAF2E9] animate-pulse" />
            <div className="h-8 w-28 rounded-lg bg-[#EBDDCF] animate-pulse" />
          </div>
        </div>

        {/* Week picker strip */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="flex min-w-[58px] flex-col items-center rounded-xl border border-[#E8D9CB]/60 bg-[#FAF2E9] px-2.5 py-2.5 animate-pulse space-y-1.5"
            >
              <div className="h-2.5 w-6 rounded bg-[#DFCBB8]" />
              <div className="h-4 w-4 rounded bg-[#DFCBB8]" />
              <div className="h-1 w-2 rounded-full bg-[#E8D9CB]" />
            </div>
          ))}
        </div>

        {/* 3 KPI stats */}
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#E8D9CB] bg-[#FAF5EE] p-4 space-y-2">
              <div className="h-3 w-20 rounded bg-[#DFCBB8] animate-pulse" />
              <div className="h-6 w-16 rounded bg-[#C65B3B]/40 animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Day panel */}
      <div className="rounded-2xl border border-[#E8D9CB] bg-[#FFFDFB] p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#E8D9CB] pb-3">
          <div className="space-y-1">
            <div className="h-6 w-48 rounded bg-[#DFCBB8] animate-pulse" />
            <div className="h-3.5 w-32 rounded bg-[#F2E5D8] animate-pulse" />
          </div>
          <div className="h-8 w-36 rounded-lg bg-[#FAF2E9] animate-pulse" />
        </div>
        <GanttCanvasSkeleton />
      </div>
    </div>
  );
}

export function DashboardSkeleton({
  type = "grid",
  className = "",
}: DashboardSkeletonProps) {
  return (
    <div className={`w-full ${className}`}>
      {type === "gantt-canvas" && <GanttCanvasSkeleton />}
      {type === "schedule" && <ScheduleFullSkeleton />}
      {type === "grid" && <GridSkeleton />}
      {type === "table" && <TableSkeleton />}
    </div>
  );
}

export default DashboardSkeleton;
