'use client';

import { useQuery } from '@tanstack/react-query';

type IngestStatus = {
  status: 'idle' | 'queued' | 'processing' | 'completed' | 'indexed' | 'failed';
  progress: number;
  message?: string;
};

async function fetchIngestStatus(): Promise<IngestStatus> {
  const res = await fetch('/api/proxy?endpoint=/ingest/status');
  if (!res.ok) throw new Error('Failed to fetch ingest status');
  return res.json();
}

export default function IngestStatusPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['ingest-status'],
    queryFn: fetchIngestStatus,
    refetchInterval: (query) => query.state.data?.status === 'processing' ? 2000 : false,
  });

  if (isLoading) return <p className="p-10 text-white">Đang tải...</p>;
  if (isError) return <p className="p-10 text-red-400">Lỗi: {(error as Error).message}</p>;

  const statusColor =
    data?.status === 'completed' || data?.status === 'indexed' ? 'text-emerald-300'
    : data?.status === 'processing' || data?.status === 'queued' ? 'text-amber-300'
    : data?.status === 'failed' ? 'text-rose-300'
    : 'text-slate-400';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.9),_rgba(2,6,23,1)_55%,_rgba(0,0,0,1)_100%)] px-6 py-10 text-slate-100 md:px-10">
      <h1 className="mb-8 text-3xl font-semibold text-white">Ingest Status</h1>

      <div className="max-w-xl space-y-6 rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-3">
          <span className="text-slate-300 font-medium">Trạng thái:</span>
          <span className={`font-semibold capitalize ${statusColor}`}>{data?.status}</span>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm text-slate-400">
            <span>Tiến độ</span>
            <span>{data?.progress ?? 0}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
            <div
              className="bg-cyan-400 h-full transition-all duration-500"
              style={{ width: `${data?.progress ?? 0}%` }}
            />
          </div>
        </div>

        {data?.message && (
          <p className="text-sm text-slate-300 border-t border-white/10 pt-4">{data.message}</p>
        )}
      </div>
    </div>
  );
}
