import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import dayjs from "dayjs";

import { AiMarkdown } from "@components/other/ai.markdown";
import { BASE_URL } from "@common/options";
import { axiosInstance } from "../../../_service/axious";

// ---------------------------------------------------------------------------
// types — mirrors server/src/modules/assistant/{message,conversation}.entity.ts
// and OrchestratorResult (server/src/modules/assistant/orchestrator.service.ts)
// ---------------------------------------------------------------------------

interface Cite {
  chunk_id: string;
  /** Real, clickable URL — empty when the source has no public link (an internal document, or a catalogue row). */
  source_url: string;
  /** Human-readable citation label — always present; the only thing shown when source_url is empty. */
  title?: string;
}

const isRealUrl = (url: string) => /^https?:\/\//i.test(url);

interface MessageMeta {
  cites?: Cite[];
  confidence?: number;
  degraded?: boolean;
  passes_run?: string[];
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  body: string;
  meta: MessageMeta | null;
  created_at: string;
}

const STARTER_QUESTIONS = [
  "Which of our matched courses gives the best visa outcome?",
  "What funds do I need to show for the student visa?",
  "Am I eligible for any scholarships?",
  "What documents will I need to apply?",
];

export function AiConsultantTab({
  studentId,
  initialQuestion,
}: {
  studentId: string;
  /** Pre-fills the input (not auto-sent) — e.g. deep-linked from the match report's "Ask AI" action. */
  initialQuestion?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState(initialQuestion ?? "");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Only apply a freshly-passed initialQuestion once — otherwise it would
  // stomp on whatever the counsellor is typing on every re-render.
  const appliedInitialQuestion = useRef(initialQuestion);
  useEffect(() => {
    if (initialQuestion && initialQuestion !== appliedInitialQuestion.current) {
      appliedInitialQuestion.current = initialQuestion;
      setInput(initialQuestion);
    }
  }, [initialQuestion]);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    setLoadingHistory(true);
    axiosInstance
      .get<{ conversation_id: string | null; messages: ChatMessage[] }>(
        `${BASE_URL}/assistant/students/${studentId}`,
      )
      .then(({ data }) => {
        if (cancelled) return;
        setConversationId(data.conversation_id);
        setMessages(data.messages ?? []);
      })
      .catch(() => {
        // No prior thread yet is not an error — starts blank.
      })
      .finally(() => !cancelled && setLoadingHistory(false));
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(body: string) {
    const text = body.trim();
    if (!text || sending) return;
    setError(null);
    setInput("");

    // Optimistic user bubble — server persists the real row, but we don't
    // wait on it to keep the input feeling responsive.
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      conversation_id: conversationId ?? "",
      role: "user",
      body: text,
      meta: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);

    try {
      const { data } = await axiosInstance.post<{ conversation_id: string; reply: ChatMessage }>(
        `${BASE_URL}/assistant/messages`,
        { conversation_id: conversationId ?? undefined, student_id: studentId, body: text },
      );
      setConversationId(data.conversation_id);
      setMessages((prev) => [...prev, data.reply]);
    } catch (e) {
      setError("Couldn't reach the AI consultant. Please try again.");
      // Roll back the optimistic bubble so it doesn't look like it sent.
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <Stack spacing={1.5} sx={{ height: "70vh", minHeight: 480 }}>
      <Paper
        variant="outlined"
        sx={{ flex: 1, overflowY: "auto", p: 2, bgcolor: "grey.50", borderRadius: 2 }}
      >
        {loadingHistory ? (
          <Stack alignItems="center" justifyContent="center" sx={{ height: "100%" }}>
            <CircularProgress size={28} />
          </Stack>
        ) : messages.length === 0 ? (
          <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ height: "100%", textAlign: "center" }}>
            <Avatar sx={{ bgcolor: "primary.main", width: 48, height: 48 }}>
              <SmartToyOutlinedIcon />
            </Avatar>
            <Typography variant="subtitle1" fontWeight={600}>
              Ask the AI consultant about this student
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
              Grounded in the real course catalogue and visa/immigration knowledge base — every
              claim it makes is cited. Try one of these, or type your own question below.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center" useFlexGap>
              {STARTER_QUESTIONS.map((q) => (
                <Chip key={q} label={q} onClick={() => send(q)} variant="outlined" clickable />
              ))}
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {sending && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ pl: 6 }}>
                <CircularProgress size={16} />
                <Typography variant="caption" color="text.secondary">
                  Thinking…
                </Typography>
              </Stack>
            )}
            <div ref={bottomRef} />
          </Stack>
        )}
      </Paper>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          size="small"
          placeholder="Ask about courses, fees, scholarships, visa requirements…"
          value={input}
          disabled={sending || loadingHistory}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <IconButton
          color="primary"
          disabled={sending || loadingHistory || !input.trim()}
          onClick={() => send(input)}
          sx={{ alignSelf: "flex-end" }}
        >
          <SendIcon />
        </IconButton>
      </Stack>
    </Stack>
  );
}

function dedupeCites(cites?: Cite[]): Cite[] {
  if (!cites?.length) return [];
  const seen = new Set<string>();
  return cites.filter((c) => {
    const key = c.source_url || c.title || c.chunk_id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  // Different retrieved chunks can point at the same source page — dedupe by
  // URL so the same reference doesn't show up as two or three chips.
  // (Also guards older stored messages saved before the backend deduped.)
  const cites = dedupeCites(message.meta?.cites);
  const degraded = message.meta?.degraded;
  const confidence = message.meta?.confidence;

  return (
    <Stack direction="row" spacing={1} justifyContent={isUser ? "flex-end" : "flex-start"}>
      {!isUser && (
        <Avatar sx={{ bgcolor: "primary.main", width: 32, height: 32 }}>
          <SmartToyOutlinedIcon fontSize="small" />
        </Avatar>
      )}
      <Stack spacing={0.5} sx={{ maxWidth: "78%" }} alignItems={isUser ? "flex-end" : "flex-start"}>
        <Paper
          variant={isUser ? "elevation" : "outlined"}
          elevation={isUser ? 2 : 0}
          sx={{
            px: 1.75,
            py: 1,
            borderRadius: 2,
            bgcolor: isUser ? "primary.main" : "background.paper",
            color: isUser ? "primary.contrastText" : "text.primary",
          }}
        >
          {isUser ? (
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
              {message.body}
            </Typography>
          ) : (
            <AiMarkdown>{message.body}</AiMarkdown>
          )}
        </Paper>

        {!isUser && degraded && (
          <Tooltip title="This answer may be less reliable — the AI routing or model call fell back to a simpler path.">
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              icon={<WarningAmberOutlinedIcon />}
              label="Degraded answer"
            />
          </Tooltip>
        )}

        {!isUser && cites.length > 0 && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {cites.map((c, i) => {
              const linkable = isRealUrl(c.source_url);
              return (
                <Tooltip key={c.chunk_id + i} title={c.title || c.source_url}>
                  <Chip
                    size="small"
                    variant="outlined"
                    clickable={linkable}
                    // Some sources (an internal document, a catalogue row)
                    // have no public URL — only make the chip clickable, and
                    // only show the "opens elsewhere" icon, when there's an
                    // actual link to open. Chip's `component`+`href`
                    // composition doesn't reliably forward to a real anchor
                    // here — it was falling through to the SPA router (404
                    // on our own domain) instead of navigating out, so open
                    // it explicitly on click instead.
                    onClick={linkable ? () => window.open(c.source_url, "_blank", "noopener,noreferrer") : undefined}
                    label={`[${i + 1}]`}
                    icon={linkable ? <OpenInNewIcon sx={{ fontSize: 14 }} /> : undefined}
                    sx={linkable ? undefined : { cursor: "default", opacity: 0.7 }}
                  />
                </Tooltip>
              );
            })}
          </Stack>
        )}

        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" color="text.disabled">
            {dayjs(message.created_at).format("HH:mm")}
          </Typography>
          {!isUser && typeof confidence === "number" && (
            <Typography variant="caption" color="text.disabled">
              · confidence {Math.round(confidence * 100)}%
            </Typography>
          )}
        </Stack>
      </Stack>
      {isUser && (
        <Avatar sx={{ bgcolor: "grey.400", width: 32, height: 32 }}>
          <PersonOutlineIcon fontSize="small" />
        </Avatar>
      )}
    </Stack>
  );
}

export default AiConsultantTab;
