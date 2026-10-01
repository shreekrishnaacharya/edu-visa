import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AddCommentOutlinedIcon from "@mui/icons-material/AddCommentOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
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

/** One row of the thread list — mirrors AssistantService.ConversationSummary. */
interface ConversationSummary {
  id: string;
  title: string | null;
  created_at: string;
  last_message_at: string | null;
  message_count: number;
  preview: string | null;
}

const threadLabel = (c: ConversationSummary) => c.title?.trim() || "New conversation";

const STARTER_QUESTIONS = [
  "Which of our matched courses gives the best visa outcome?",
  "What funds do I need to show for the student visa?",
  "Am I eligible for any scholarships?",
  "What documents will I need to apply?",
];

/**
 * A student's AI-consultant threads.
 *
 * Was single-threaded: the tab loaded the student's most recent conversation
 * and every question went into it, so a visa question, a course shortlist and a
 * financial question piled into one scroll with no way to start a clean thread
 * or return to an earlier one. Threads are named from their first question, so
 * the list is readable without anyone titling anything by hand.
 */
/**
 * A student's AI-consultant threads, as a drill-down: the history list OR one
 * conversation, never both at once.
 *
 * Was single-threaded — the tab reopened the student's newest conversation and
 * every question piled into it. The first attempt at fixing that put the list
 * in a side pane, which left the chat squeezed into the remaining width and the
 * history permanently half-visible. One view at a time, with a back button, is
 * what this actually is: a list of past conversations you open one of.
 */
export function AiConsultantTab({
  studentId,
  initialQuestion,
}: {
  studentId: string;
  /** Pre-fills the input (not auto-sent) — e.g. deep-linked from the match report's "Ask AI" action. */
  initialQuestion?: string;
}) {
  const [view, setView] = useState<"list" | "chat">("list");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState(initialQuestion ?? "");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ el: HTMLElement; id: string } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [deleting, setDeleting] = useState<ConversationSummary | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Only apply a freshly-passed initialQuestion once — otherwise it would
  // stomp on whatever the counsellor is typing on every re-render.
  const appliedInitialQuestion = useRef(initialQuestion);
  useEffect(() => {
    if (initialQuestion && initialQuestion !== appliedInitialQuestion.current) {
      appliedInitialQuestion.current = initialQuestion;
      setInput(initialQuestion);
      // Deep-linked with a question to ask: go straight to the composer, or the
      // question would sit invisible behind the history list.
      setView("chat");
    }
  }, [initialQuestion]);

  const loadList = useCallback(async () => {
    const { data } = await axiosInstance.get<ConversationSummary[]>(
      `${BASE_URL}/assistant/students/${studentId}/conversations`,
    );
    setConversations(data ?? []);
    return data ?? [];
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    setLoadingList(true);
    loadList()
      .catch(() => {
        // No threads yet is not an error — the empty state invites the first one.
      })
      .finally(() => !cancelled && setLoadingList(false));
    return () => {
      cancelled = true;
    };
  }, [studentId, loadList]);

  useEffect(() => {
    if (view === "chat") bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, view]);

  async function openThread(id: string) {
    setLoadingThread(true);
    setError(null);
    setView("chat");
    try {
      const { data } = await axiosInstance.get<{ conversation: ConversationSummary; messages: ChatMessage[] }>(
        `${BASE_URL}/assistant/conversations/${id}`,
      );
      setConversationId(id);
      setMessages(data.messages ?? []);
    } catch {
      setError("Couldn't open that conversation.");
      setView("list");
    } finally {
      setLoadingThread(false);
    }
  }

  /**
   * Back to the history. The open thread is cleared deliberately: leaving it set
   * would make the next question land in a conversation the counsellor has
   * navigated away from.
   */
  async function backToList() {
    setView("list");
    setConversationId(null);
    setMessages([]);
    setError(null);
    await loadList().catch(() => undefined);
  }

  /** A fresh thread. Nothing is created server-side until the first message. */
  function newThread() {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setView("chat");
  }

  async function saveRename() {
    if (!renaming?.value.trim()) return;
    const { id, value } = renaming;
    setRenaming(null);
    try {
      await axiosInstance.patch(`${BASE_URL}/assistant/conversations/${id}`, { title: value.trim() });
      await loadList();
    } catch {
      setError("Couldn't rename that conversation.");
    }
  }

  async function confirmDelete() {
    const target = deleting;
    if (!target) return;
    setDeleting(null);
    try {
      await axiosInstance.delete(`${BASE_URL}/assistant/conversations/${target.id}`);
      await loadList();
      // Deleting the thread you are reading has to take you somewhere, and the
      // history is the honest destination.
      if (target.id === conversationId) {
        setConversationId(null);
        setMessages([]);
        setView("list");
      }
    } catch {
      setError("Couldn't delete that conversation.");
    }
  }

  async function send(body: string) {
    const text = body.trim();
    if (!text || sending) return;
    setError(null);
    setInput("");
    setView("chat");

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
      // This may be a brand-new thread, and the first message is what names it.
      await loadList();
    } catch (e) {
      setError("Couldn't reach the AI consultant. Please try again.");
      // Roll back the optimistic bubble so it doesn't look like it sent.
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  const current = conversations.find((c) => c.id === conversationId) ?? null;
  // Taller than the original 70vh/480: this is the primary working surface of
  // the tab, and a chat transcript with citations under each answer needs the
  // room — at 480px only two exchanges were visible at once.
  const frame = { height: "82vh", minHeight: 620 } as const;

  // Shared by both views: the row menu opens these from the history, and the
  // header menu opens the same ones from inside a conversation.
  const dialogs = (
    <>
      <Menu anchorEl={menu?.el ?? null} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            const c = conversations.find((x) => x.id === menu?.id);
            setRenaming({ id: menu!.id, value: c ? threadLabel(c) : "" });
            setMenu(null);
          }}
        >
          <DriveFileRenameOutlineIcon fontSize="small" sx={{ mr: 1 }} /> Rename
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            setDeleting(conversations.find((x) => x.id === menu?.id) ?? null);
            setMenu(null);
          }}
          sx={{ color: "error.main" }}
        >
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>

      <Dialog open={!!renaming} onClose={() => setRenaming(null)} fullWidth maxWidth="xs">
        <DialogTitle>Rename conversation</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            sx={{ mt: 0.5 }}
            value={renaming?.value ?? ""}
            onChange={(e) => setRenaming((r) => (r ? { ...r, value: e.target.value } : r))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void saveRename();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenaming(null)}>Cancel</Button>
          <Button variant="contained" disabled={!renaming?.value.trim()} onClick={saveRename}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete this conversation?</DialogTitle>
        <DialogContent>
          <DialogContentText variant="body2">
            &ldquo;{deleting ? threadLabel(deleting) : ""}&rdquo; and its{" "}
            {deleting?.message_count ?? 0} message{deleting?.message_count === 1 ? "" : "s"} will be
            removed. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );

  // ---- history ------------------------------------------------------------
  if (view === "list") {
    return (
      <>
        <Stack spacing={1.5} sx={frame}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="subtitle2" sx={{ flex: 1 }}>
              Conversations{conversations.length ? ` (${conversations.length})` : ""}
            </Typography>
            <Button size="small" variant="contained" startIcon={<AddCommentOutlinedIcon />} onClick={newThread}>
              New conversation
            </Button>
          </Stack>

          <Paper variant="outlined" sx={{ flex: 1, overflowY: "auto", borderRadius: 2 }}>
            {loadingList ? (
              <Stack alignItems="center" justifyContent="center" sx={{ height: "100%" }}>
                <CircularProgress size={28} />
              </Stack>
            ) : conversations.length === 0 ? (
              <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ height: "100%", textAlign: "center", p: 3 }}>
                <Avatar sx={{ bgcolor: "primary.main", width: 48, height: 48 }}>
                  <SmartToyOutlinedIcon />
                </Avatar>
                <Typography variant="subtitle1" fontWeight={600}>
                  No conversations yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440 }}>
                  Ask the AI consultant about this student — grounded in the real course catalogue
                  and visa knowledge base, with every claim cited. Start with one of these:
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center" useFlexGap>
                  {STARTER_QUESTIONS.map((q) => (
                    <Chip key={q} label={q} onClick={() => send(q)} variant="outlined" clickable />
                  ))}
                </Stack>
              </Stack>
            ) : (
              <List disablePadding>
                {conversations.map((c, i) => (
                  <Box key={c.id}>
                    {i > 0 && <Divider component="li" />}
                    <ListItemButton onClick={() => openThread(c.id)} sx={{ pr: 6, py: 1.25, alignItems: "flex-start" }}>
                      <ForumOutlinedIcon fontSize="small" color="action" sx={{ mt: 0.3, mr: 1.25 }} />
                      <ListItemText
                        disableTypography
                        primary={
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {threadLabel(c)}
                          </Typography>
                        }
                        secondary={
                          <>
                            {c.preview && (
                              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                                {c.preview}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.disabled">
                              {c.message_count} message{c.message_count === 1 ? "" : "s"} ·{" "}
                              {dayjs(c.last_message_at ?? c.created_at).fromNow()}
                            </Typography>
                          </>
                        }
                      />
                      <IconButton
                        size="small"
                        aria-label={`Options for ${threadLabel(c)}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenu({ el: e.currentTarget, id: c.id });
                        }}
                        sx={{ position: "absolute", right: 8, top: 10 }}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </ListItemButton>
                  </Box>
                ))}
              </List>
            )}
          </Paper>

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </Stack>
        {dialogs}
      </>
    );
  }

  // ---- one conversation ---------------------------------------------------
  return (
    <>
      <Stack spacing={1.5} sx={frame}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Tooltip title="Back to all conversations">
            <IconButton size="small" onClick={backToList} aria-label="Back to all conversations">
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Typography variant="subtitle2" noWrap sx={{ flex: 1 }}>
            {current ? threadLabel(current) : "New conversation"}
          </Typography>
          {conversationId && (
            <IconButton
              size="small"
              aria-label="Conversation options"
              onClick={(e) => setMenu({ el: e.currentTarget, id: conversationId })}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>

        <Paper variant="outlined" sx={{ flex: 1, overflowY: "auto", p: 2, bgcolor: "grey.50", borderRadius: 2 }}>
          {loadingThread ? (
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
            disabled={sending || loadingThread}
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
            disabled={sending || loadingThread || !input.trim()}
            onClick={() => send(input)}
            sx={{ alignSelf: "flex-end" }}
          >
            <SendIcon />
          </IconButton>
        </Stack>
      </Stack>
      {dialogs}
    </>
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
