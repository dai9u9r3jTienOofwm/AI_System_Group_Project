"use client";

import { useQuery } from "@tanstack/react-query";

type IngestStatus = {
  status: "idle" | "processing" | "completed" | "failed";
  progress: number; // 0 - 100
  message?: string;
};

async function fetchIngestStatus(): Promise<IngestStatus> {
  const res = await fetch("/api/proxy?endpoint=/ingest-status");

  if (!res.ok) {
    throw new Error("Failed to fetch ingest status");
  }

  return res.json();
}

export default function IngestStatusPage() {
  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["ingest-status"],
    queryFn: fetchIngestStatus,

    // 👇 polling mỗi 2s khi đang processing
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "processing" ? 2000 : false;
    },
  });

  if (isLoading) {
    return <p>Loading ingest status...</p>;
  }

  if (isError) {
    return <p>Error: {(error as Error).message}</p>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.9),_rgba(2,6,23,1)_55%,_rgba(0,0,0,1)_100%)] px-6 py-10 text-slate-100 md:px-10">
      <h1 className="text-2xl font-semibold text-white">Ingest Status</h1>

      {/* Status */}
      <div>
        <span className="font-medium">Status: </span>
        <span
          className={
            data?.status === "completed"
              ? "text-emerald-300"
              : data?.status === "processing"
              ? "text-amber-300"
              : data?.status === "failed"
              ? "text-rose-300"
              : "text-slate-400"
          }
        >
          {data?.status}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-white/10 rounded h-4 overflow-hidden">
        <div
          className="bg-cyan-400 h-full transition-all"
          style={{ width: `${data?.progress ?? 0}%` }}
        />
      </div>

      <p>{data?.progress ?? 0}%</p>

      {/* Message */}
      {data?.message && (
        <p className="text-sm text-slate-300">{data.message}</p>
      )}
    </div>
  );
}