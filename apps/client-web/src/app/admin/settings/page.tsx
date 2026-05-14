export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.9),_rgba(2,6,23,1)_55%,_rgba(0,0,0,1)_100%)] px-6 py-10 text-slate-100 md:px-10 lg:px-16">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-semibold text-white">Cấu hình</h1>
          <p className="text-base text-slate-300">Quản lý các thông số cho hệ thống RAG và chatbot.</p>
        </header>

        {/* Model Settings */}
        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Model Settings</h2>
              <p className="mt-1 text-sm text-slate-300">Cấu hình mô hình và các tham số sinh.</p>
            </div>
            <button type="button" className="h-10 shrink-0 rounded-lg bg-cyan-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">Lưu</button>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-200">Model</span>
              <select name="model" defaultValue="gpt-4o" className="h-10 rounded-lg border border-white/10 bg-slate-900/60 px-3 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none">
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o-mini</option>
                <option value="gpt-4.1">GPT-4.1</option>
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-200">Max tokens</span>
              <div className="flex items-center gap-3">
                <input name="maxTokens" type="number" placeholder="2048" className="h-10 w-32 rounded-lg border border-white/10 bg-slate-900/60 px-3 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none" />
                <input name="maxTokensSlider" type="range" min={256} max={8192} step={256} defaultValue={2048} className="h-2 w-full accent-cyan-400" />
              </div>
            </label>
            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-200">Temperature (0.0 - 2.0)</span>
              <div className="flex items-center gap-3">
                <input name="temperature" type="number" step="0.1" placeholder="0.7" className="h-10 w-24 rounded-lg border border-white/10 bg-slate-900/60 px-3 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none" />
                <input name="temperatureSlider" type="range" min={0} max={2} step={0.1} defaultValue={0.7} className="h-2 w-full accent-cyan-400" />
              </div>
            </label>
          </div>
        </section>

        {/* Chat Behavior */}
        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Chat Behavior</h2>
              <p className="mt-1 text-sm text-slate-300">Tuỳ chỉnh hành vi hội thoại của chatbot.</p>
            </div>
            <button type="button" className="h-10 shrink-0 rounded-lg bg-cyan-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">Lưu</button>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-200">System prompt</span>
              <textarea name="systemPrompt" rows={5} placeholder="Nhập chỉ thị hệ thống cho bot" className="resize-none rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none" />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-200">Tone</span>
              <select name="tone" defaultValue="professional" className="h-10 rounded-lg border border-white/10 bg-slate-900/60 px-3 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none">
                <option value="formal">Formal</option>
                <option value="casual">Casual</option>
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-200">Language</span>
              <select name="language" defaultValue="vi" className="h-10 rounded-lg border border-white/10 bg-slate-900/60 px-3 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none">
                <option value="vi">Vietnamese</option>
                <option value="en">English</option>
                <option value="ja">Japanese</option>
              </select>
            </label>
          </div>
        </section>

        {/* RAG Settings */}
        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">RAG Settings</h2>
              <p className="mt-1 text-sm text-slate-300">Cấu hình truy xuất vector và đồng bộ dữ liệu.</p>
            </div>
            <button type="button" className="h-10 shrink-0 rounded-lg border border-amber-300/40 bg-amber-500/15 px-5 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/25">Re-index / Sync Vector DB</button>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/60 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-200">Sử dụng RAG</p>
                <p className="text-xs text-slate-400">Bật/tắt truy xuất tài liệu từ vector DB.</p>
              </div>
              <input name="ragEnabled" type="checkbox" defaultChecked className="h-5 w-5 accent-cyan-400" />
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-200">Top K documents</span>
              <div className="flex items-center gap-3">
                <input name="topK" type="number" placeholder="5" className="h-10 w-24 rounded-lg border border-white/10 bg-slate-900/60 px-3 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none" />
                <input name="topKSlider" type="range" min={1} max={20} step={1} defaultValue={5} className="h-2 w-full accent-cyan-400" />
              </div>
            </div>
          </div>
        </section>

        {/* API Status */}
        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">API Status</h2>
              <p className="mt-1 text-sm text-slate-300">Trạng thái kết nối (chỉ đọc).</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Connected
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3 rounded-lg border border-white/10 bg-slate-900/60 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
            <span className="text-sm text-slate-200">API Gateway healthy</span>
          </div>
        </section>
      </div>
    </div>
  );
}
