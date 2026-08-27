import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Send, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/learn/messages")({ component: Messages });

type Message = { id: string; sender_id: string; body: string; created_at: string };

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function Messages() {
  const [userId, setUserId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) { setError("Please sign in to use Messages."); setLoading(false); return; }
    setUserId(user.id);
    const { data: id, error: conversationError } = await supabase.rpc("get_or_create_support_conversation");
    if (conversationError || !id) { setError(conversationError?.message || "Unable to open your support conversation."); setLoading(false); return; }
    setConversationId(id as string);
    const { data, error: messageError } = await supabase.from("messages").select("id,sender_id,body,created_at").eq("conversation_id", id).order("created_at", { ascending: true });
    if (messageError) setError(messageError.message); else setMessages((data ?? []) as Message[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase.channel(`messages:${conversationId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
      const message = payload.new as Message;
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId]);

  async function sendMessage() {
    const body = draft.trim();
    if (!body || !conversationId || !userId || sending) return;
    setSending(true); setError("");
    const { data, error: sendError } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: userId, body }).select("id,sender_id,body,created_at").single();
    if (sendError) setError(sendError.message); else { setMessages((current) => current.some((item) => item.id === data.id) ? current : [...current, data as Message]); setDraft(""); }
    setSending(false);
  }

  return <LearnShell>
    <SectionHeader eyebrow="Support" title="Messages" description="Send feedback, questions or course-access requests to the learning team." />
    <div className="reference-message-layout">
      <aside className="reference-message-list">
        <div className="reference-message-list-header"><span>Chatrooms</span><MessageCircle size={17} /></div>
        <button type="button" className="reference-message-room active"><span className="reference-message-avatar"><UserRound size={16} /></span><span className="min-w-0 flex-1 text-left"><strong className="block truncate">Learning Team</strong><small className="block truncate">Amit Soni · Support</small></span></button>
      </aside>
      <section className="reference-message-panel">
        <header className="reference-message-header"><div><h2 className="font-bold">Learning Team</h2><p className="mt-0.5 text-xs">Questions, feedback and learning support</p></div><span className="reference-online-dot">Online</span></header>
        <div className="reference-message-thread" aria-live="polite">
          {loading ? <div className="reference-message-empty">Loading conversation…</div> : messages.length === 0 ? <div className="reference-message-empty"><div className="mx-auto reference-message-empty-icon"><MessageCircle size={20}/></div><strong className="mt-3 block">Start the conversation</strong><span className="mt-1 block">Send your first message to the learning team.</span></div> : messages.map((message) => <div key={message.id} className={`reference-message-bubble-row ${message.sender_id === userId ? "mine" : ""}`}><div className="reference-message-bubble"><div>{message.body}</div><time>{formatTime(message.created_at)}</time></div></div>)}
        </div>
        <div className="reference-message-composer"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Write a message or feedback…" aria-label="Write a message" rows={2}/><button type="button" onClick={() => void sendMessage()} disabled={!draft.trim() || sending} className="learn-primary-button"><Send size={15}/>{sending ? "Sending…" : "Send"}</button></div>
        {error && <div className="reference-message-error">{error}</div>}
      </section>
    </div>
  </LearnShell>;
}
