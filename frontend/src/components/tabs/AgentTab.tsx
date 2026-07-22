import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Wrench } from "lucide-react";
import { api } from "../../api";

interface Msg { role: "user" | "agent"; text: string; tools?: string[]; loading?: boolean }

const SUGGESTIONS = [
  "Who leads the top ring and why?",
  "Trace the money to the ringleader",
  "Why is this ring cross-jurisdiction?",
];

export default function AgentTab({ ringId }: { ringId: string | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "agent", text: "Ask me about any ring or entity — I cite entity IDs for every claim." },
  ]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight); }, [msgs]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setQ("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", text }, { role: "agent", text: "", loading: true }]);
    try {
      const r = await api.ask(text);
      setMsgs((m) => [...m.slice(0, -1), { role: "agent", text: r.answer, tools: r.tool_calls }]);
    } catch {
      setMsgs((m) => [...m.slice(0, -1), { role: "agent", text: "Request failed — is the backend running?" }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 210px)" }}>
      <div ref={logRef} className="flex-1 overflow-y-auto card p-3 space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className="flex gap-2.5">
            <div className="shrink-0 mt-0.5 w-6 h-6 rounded-lg grid place-items-center"
              style={{ background: m.role === "user" ? "var(--color-ink-700)" : "linear-gradient(135deg,#2b4d9e,#4f8cff)" }}>
              {m.role === "user" ? <User size={13} /> : <Bot size={13} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[9.5px] uppercase tracking-wide text-faint mb-0.5">
                {m.role === "user" ? "Investigator" : "Agent"}
              </div>
              {m.loading ? (
                <div className="flex gap-1 py-1.5">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full live-dot"
                      style={{ background: "var(--color-brand)", animationDelay: `${d * 0.2}s` }} />
                  ))}
                </div>
              ) : (
                <div className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.text}</div>
              )}
              {m.tools && m.tools.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-faint">
                  <Wrench size={10} /> {m.tools.join(" · ")}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => send(s)} disabled={busy}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-line text-muted hover:border-brand hover:text-txt transition-colors disabled:opacity-40">
            {s}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mt-2.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(q)}
          placeholder={ringId ? `Ask about ${ringId}…` : "Ask the investigation agent…"}
          className="flex-1 bg-ink-800 border border-line rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-brand transition-colors"
        />
        <button onClick={() => send(q)} disabled={busy}
          className="px-3.5 rounded-xl grid place-items-center disabled:opacity-40"
          style={{ background: "linear-gradient(135deg,#2b4d9e,#4f8cff)" }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
