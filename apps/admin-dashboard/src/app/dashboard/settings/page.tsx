export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.9),_rgba(2,6,23,1)_55%,_rgba(0,0,0,1)_100%)] px-6 py-10 text-slate-100 md:px-10 lg:px-16">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-semibold text-white">Cau hinh</h1>
          <p className="text-base text-slate-300">
            Quan ly cac thong so cho he thong RAG va chatbot.
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">
                Model Settings
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Cấu hình mô hình và các tham số sinh.
              </p>
            </div>
            <button
              type="button"
              className="h-10 shrink-0 rounded-lg bg-cyan-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Luu
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-200">Model</span>
              <select
                name="model"
                className="h-10 rounded-lg border border-white/10 bg-slate-900/60 px-3 text-sm text-slate-100 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                defaultValue="gpt-4o"
              >
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o-mini</option>
                <option value="gpt-4.1">GPT-4.1</option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-200">
                Max tokens
              </span>
              <div className="flex items-center gap-3">
                <input
                  name="maxTokens"
                  type="number"
                  placeholder="2048"
                  className="h-10 w-32 rounded-lg border border-white/10 bg-slate-900/60 px-3 text-sm text-slate-100 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                />
                <input
                  name="maxTokensSlider"
                  type="range"
                  min={256}
                  max={8192}
                  step={256}
                  defaultValue={2048}
                  className="h-2 w-full accent-cyan-400"
                />
              </div>
            </label>

            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-200">
                Temperature (0.0 - 2.0)
              </span>
              <div className="flex items-center gap-3">
                <input
                  name="temperature"
                  type="number"
                  step="0.1"
                  placeholder="0.7"
                  className="h-10 w-24 rounded-lg border border-white/10 bg-slate-900/60 px-3 text-sm text-slate-100 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                />
                <input
                  name="temperatureSlider"
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  defaultValue={0.7}
                  className="h-2 w-full accent-cyan-400"
                />
              </div>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">
                Chat Behavior
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Tuỳ chỉnh hành vi hội thoại của chatbot.
              </p>
            </div>
            <button
              type="button"
              className="h-10 shrink-0 rounded-lg bg-cyan-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Luu
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-200">
                System prompt
              </span>
              <textarea
                name="systemPrompt"
                rows={5}
                placeholder="Nhập chỉ thị hệ thống cho bot"
                className="resize-none rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-200">Tone</span>
              <select
                name="tone"
                className="h-10 rounded-lg border border-white/10 bg-slate-900/60 px-3 text-sm text-slate-100 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                defaultValue="professional"
              >
                <option value="formal">Formal</option>
                <option value="casual">Casual</option>
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-200">Language</span>
              <select
                name="language"
                className="h-10 rounded-lg border border-white/10 bg-slate-900/60 px-3 text-sm text-slate-100 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                defaultValue="vi"
              >
                <option value="vi">Vietnamese</option>
                <option value="en">English</option>
                <option value="ja">Japanese</option>
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">
                RAG Settings
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Cấu hình truy xuất vector và đồng bộ dữ liệu.
              </p>
            </div>
            <button
              type="button"
              className="h-10 shrink-0 rounded-lg border border-amber-300/40 bg-amber-500/15 px-5 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/25"
            >
              Re-index / Sync Vector DB
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/60 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-200">Su dung RAG</p>
                <p className="text-xs text-slate-400">
                  Bat/tat truy xuat tai lieu tu vector DB.
                </p>
              </div>
              <input
                name="ragEnabled"
                type="checkbox"
                defaultChecked
                className="h-5 w-5 accent-cyan-400"
              />
            </label>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-200">
                Top K documents
              </span>
              <div className="flex items-center gap-3">
                <input
                  name="topK"
                  type="number"
                  placeholder="5"
                  className="h-10 w-24 rounded-lg border border-white/10 bg-slate-900/60 px-3 text-sm text-slate-100 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                />
                <input
                  name="topKSlider"
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  defaultValue={5}
                  className="h-2 w-full accent-cyan-400"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-200">
                Similarity threshold
              </span>
              <div className="flex items-center gap-3">
                <input
                  name="similarityThreshold"
                  type="number"
                  step="0.05"
                  placeholder="0.25"
                  className="h-10 w-24 rounded-lg border border-white/10 bg-slate-900/60 px-3 text-sm text-slate-100 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                />
                <input
                  name="similarityThresholdSlider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  defaultValue={0.25}
                  className="h-2 w-full accent-cyan-400"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">API Status</h2>
              <p className="mt-1 text-sm text-slate-300">
                Trang thai ket noi va khoa API (chi doc).
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              Connected
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-200">API Key</span>
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/60 px-4 py-3">
                <span className="font-mono text-sm text-slate-200">sk-8f2a...****</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                  Read-only
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Key duoc cau hinh o backend, khong the chinh sua tai day.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-200">
                Connection status
              </span>
              <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-900/60 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="text-sm text-slate-200">API Gateway healthy</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Playground</h2>
              <p className="mt-1 text-sm text-slate-300">
                Thu nghiem nhanh cau hoi va kiem tra ket qua.
              </p>
            </div>
            <button
              type="button"
              className="h-10 shrink-0 rounded-lg bg-cyan-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Send / Test
            </button>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-200">Test prompt</span>
              <textarea
                name="testPrompt"
                rows={4}
                placeholder="Nhap cau hoi de thu"
                className="resize-none rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
              />
            </label>

            <div className="rounded-lg border border-white/10 bg-slate-900/60 p-4">
              <p className="text-xs font-semibold uppercase text-slate-400">Response</p>
              <p className="mt-2 text-sm text-slate-200">
                Cau tra loi se hien thi tai day sau khi test.
              </p>
            </div>

            <details className="rounded-lg border border-white/10 bg-slate-900/60 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-200">
                Show Retrieved Context
              </summary>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <div className="rounded-md border border-white/10 bg-slate-900/60 p-3">
                  Doc 1: Trich xuat noi dung tu vector DB.
                </div>
                <div className="rounded-md border border-white/10 bg-slate-900/60 p-3">
                  Doc 2: Trich xuat noi dung tu vector DB.
                </div>
              </div>
            </details>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Usage</h2>
              <p className="mt-1 text-sm text-slate-300">
                Thong ke su dung he thong.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-xs font-semibold uppercase text-slate-400">
                Total Requests
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">--</p>
              <p className="text-xs text-slate-400">Chua co du lieu</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-xs font-semibold uppercase text-slate-400">Tokens Used</p>
              <p className="mt-2 text-2xl font-semibold text-white">--</p>
              <p className="text-xs text-slate-400">Chua co du lieu</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-xs font-semibold uppercase text-slate-400">
                Estimated Cost
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">--</p>
              <p className="text-xs text-slate-400">Chua co du lieu</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
