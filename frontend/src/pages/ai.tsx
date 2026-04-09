import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, Plus, Trash2, Loader2, Radio, ChevronRight, User } from "lucide-react";

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
}

interface Message {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: string;
}

function getBase() {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${getBase()}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

function formatContent(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("**") && line.endsWith("**")) {
      return <p key={i} className="font-bold text-foreground mt-2 mb-1">{line.slice(2, -2)}</p>;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      return (
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span className="text-violet-400 mt-1 shrink-0">•</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
    }
    if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\.\s(.*)/)!;
      return (
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span className="text-violet-400 shrink-0 font-mono text-[11px]">{num[1]}.</span>
          <span>{renderInline(num[2])}</span>
        </div>
      );
    }
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return <p key={i} className="my-0.5 leading-relaxed">{renderInline(line)}</p>;
  });
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i} className="font-semibold text-foreground/90">{p.slice(2, -2)}</strong>;
    }
    return <span key={i}>{p}</span>;
  });
}

const QUICK_PROMPTS = [
  "How do I report a pothole to the right authority?",
  "What's the difference between NH, SH, and MDR roads?",
  "How can I check if a road project has been funded?",
  "Draft a formal complaint for a severe pothole on a city road",
  "How do I file an RTI for road budget transparency?",
];

export default function AI() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [loadingConvs, setLoadingConvs] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const loadConversations = useCallback(async () => {
    try {
      const res = await apiFetch("/anthropic/conversations");
      const data: Conversation[] = await res.json();
      setConversations(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch { }
    setLoadingConvs(false);
  }, []);

  const loadMessages = useCallback(async (id: number) => {
    try {
      const res = await apiFetch(`/anthropic/conversations/${id}`);
      const data = await res.json();
      setMessages(data.messages ?? []);
      scrollToBottom();
    } catch { }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (activeId !== null) loadMessages(activeId);
    else setMessages([]);
  }, [activeId, loadMessages]);

  useEffect(() => { scrollToBottom(); }, [messages, streamText]);

  const createConversation = async (firstMessage?: string) => {
    const title = firstMessage ? firstMessage.slice(0, 48) : "New Conversation";
    try {
      const res = await apiFetch("/anthropic/conversations", {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      const conv: Conversation = await res.json();
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
      setMessages([]);
      return conv.id;
    } catch { return null; }
  };

  const deleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(`/anthropic/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) { setActiveId(null); setMessages([]); }
    } catch { }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || streaming) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    let convId = activeId;
    if (!convId) {
      convId = await createConversation(content);
      if (!convId) return;
    }

    const userMsg: Message = { id: Date.now(), conversationId: convId, role: "user", content, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);
    setStreamText("");
    scrollToBottom();

    try {
      abortRef.current = new AbortController();
      const res = await fetch(`${getBase()}/api/anthropic/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        signal: abortRef.current.signal,
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              accumulated += data.content;
              setStreamText(accumulated);
            }
            if (data.done || data.error) {
              setStreaming(false);
              setStreamText("");
              if (accumulated) {
                const aiMsg: Message = { id: Date.now() + 1, conversationId: convId, role: "assistant", content: accumulated, createdAt: new Date().toISOString() };
                setMessages((prev) => [...prev, aiMsg]);
              }
              loadConversations();
            }
          } catch { }
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setMessages((prev) => [...prev, { id: Date.now() + 2, conversationId: convId!, role: "assistant", content: "Sorry, I encountered an error. Please try again.", createdAt: new Date().toISOString() }]);
      }
      setStreaming(false);
      setStreamText("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const allMessages = streaming
    ? [...messages, { id: -1, conversationId: activeId ?? -1, role: "assistant", content: streamText, createdAt: "" }]
    : messages;

  return (
    <div className="flex-1 flex overflow-hidden h-full">
      {/* Sidebar - conversation list (desktop only) */}
      <div className="hidden md:flex w-64 shrink-0 flex-col border-r border-white/[0.05]" style={{ background: "var(--surface-sidebar)" }}>
        <div className="p-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}>
              <Bot size={13} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">RoadWatch AI</p>
              <p className="text-[9px] text-muted-foreground leading-tight">Infrastructure Intelligence</p>
            </div>
          </div>
          <button
            onClick={() => createConversation()}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all duration-200 hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "white", boxShadow: "0 4px 12px rgba(124,58,237,0.3)" }}>
            <Plus size={12} />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2">
          {loadingConvs ? (
            <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-violet-400" /></div>
          ) : conversations.length === 0 ? (
            <p className="text-[10px] text-muted-foreground text-center py-4">No conversations yet</p>
          ) : conversations.map((c) => (
            <button key={c.id} onClick={() => setActiveId(c.id)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl mb-1 text-left group transition-all"
              style={activeId === c.id
                ? { background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.3)" }
                : { background: "transparent", border: "1px solid transparent" }}>
              <ChevronRight size={10} className={`shrink-0 transition-colors ${activeId === c.id ? "text-violet-400" : "text-muted-foreground/40"}`} />
              <span className="flex-1 text-[11px] truncate font-medium" style={{ color: activeId === c.id ? "#a78bfa" : "#64748b" }}>{c.title}</span>
              <button onClick={(e) => deleteConversation(c.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-red-400 text-muted-foreground transition-all">
                <Trash2 size={10} />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile-only top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-2.5 shrink-0" style={{ background: "var(--surface-sidebar)", borderBottom: "1px solid var(--border-section)" }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}>
              <Bot size={11} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">RoadWatch AI</p>
            </div>
          </div>
          <button
            onClick={() => createConversation()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold"
            style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "white", boxShadow: "0 2px 8px rgba(124,58,237,0.3)" }}>
            <Plus size={11} />
            New Chat
          </button>
        </div>

        {activeId === null ? (
          /* Welcome screen */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #0ea5e9 100%)", boxShadow: "0 8px 32px rgba(124,58,237,0.4)" }}>
                <Radio size={28} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold mb-2" style={{ background: "linear-gradient(135deg, #a78bfa, #818cf8, #38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                RoadWatch AI
              </h1>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Your intelligent assistant for monitoring road quality, reporting potholes, filing complaints with the right authorities, and tracking public infrastructure spending.
              </p>
              <div className="space-y-2 text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Try asking</p>
                {QUICK_PROMPTS.map((prompt) => (
                  <button key={prompt} onClick={() => sendMessage(prompt)}
                    className="w-full text-left px-4 py-2.5 rounded-xl text-sm text-muted-foreground transition-all hover:text-foreground"
                    style={{ background: "var(--surface-subtle)", border: "1px solid var(--border-section)" }}>
                    {prompt}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        ) : (
          /* Messages */
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <AnimatePresence initial={false}>
              {allMessages.map((msg, i) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 * Math.min(i, 5) }}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center"
                    style={msg.role === "user"
                      ? { background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)" }
                      : { background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}>
                    {msg.role === "user" ? <User size={12} className="text-violet-400" /> : <Bot size={12} className="text-white" />}
                  </div>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user" ? "rounded-tr-sm" : "rounded-tl-sm"}`}
                    style={msg.role === "user"
                      ? { background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)", color: "#e2e8f0" }
                      : { background: "var(--surface-1)", border: "1px solid var(--border-card)", color: "#94a3b8" }}>
                    {msg.role === "assistant" ? (
                      <div className="text-[13px]">{formatContent(msg.content)}</div>
                    ) : (
                      <span>{msg.content}</span>
                    )}
                    {msg.id === -1 && (
                      <span className="inline-flex items-center gap-1 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {allMessages.length === 0 && !streaming && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Bot size={32} className="text-violet-400/40 mb-3" />
                <p className="text-sm text-muted-foreground">Ask RoadWatch AI anything about road infrastructure</p>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Input area */}
        <div className="px-6 py-4" style={{ borderTop: "1px solid var(--border-section)" }}>
          <div className="flex gap-3 items-end rounded-2xl px-4 py-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border-input)" }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              disabled={streaming}
              rows={1}
              placeholder={streaming ? "RoadWatch is thinking…" : "Ask about road conditions, complaint routing, budget transparency…"}
              className="flex-1 bg-transparent text-sm text-foreground resize-none outline-none placeholder:text-muted-foreground/50 max-h-28"
              style={{ lineHeight: "1.5" }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={streaming || !input.trim()}
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", boxShadow: input.trim() ? "0 4px 12px rgba(124,58,237,0.3)" : "none" }}>
              {streaming ? <Loader2 size={14} className="text-white animate-spin" /> : <Send size={14} className="text-white" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/40 text-center mt-2">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}
