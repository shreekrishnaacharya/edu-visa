import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Link,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import LinkIcon from "@mui/icons-material/Link";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import BlockIcon from "@mui/icons-material/Block";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";

import { RefineListView } from "@components/view/list";
import { AppBreadcrumbs } from "@components/breadcrumb/app.breadcrumb";
import {
  applyRun,
  CurationMessage,
  CurationSession,
  decideChanges,
  formatDate,
  getCurationSession,
  ProposedChange,
  renderValue,
  sendCurationMessage,
} from "./api";

/**
 * Conversational curation. Hand the AI a URL, a document or an instruction and
 * it proposes field changes with a quote for each.
 *
 * This is the fallback for the ~half of large providers whose sites block
 * automated reading, so the alternative would be typing every requirement in by
 * hand. Nothing the AI proposes is written until it's accepted here, and each
 * proposal carries the quote and source it came from.
 */
export function CurationChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<CurationSession | null>(null);
  const [messages, setMessages] = useState<CurationMessage[]>([]);
  const [subject, setSubject] = useState<Record<string, unknown> | null>(null);
  const [content, setContent] = useState("");
  const [urlDraft, setUrlDraft] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    if (!id) return;
    try {
      const d = await getCurationSession(id);
      setSession(d.session);
      setMessages(d.messages);
      setSubject(d.subject);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Could not load this session");
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  const addUrl = () => {
    const u = urlDraft.trim();
    if (!u) return;
    setUrls((prev) => [...new Set([...prev, u])]);
    setUrlDraft("");
  };

  const send = async () => {
    if (!id || (!content.trim() && !urls.length && !files.length)) return;
    setSending(true);
    setError(null);
    try {
      await sendCurationMessage(id, { content, urls, files });
      setContent("");
      setUrls([]);
      setFiles([]);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "That turn failed");
    } finally {
      setSending(false);
    }
  };

  /** Accept or reject one proposal, then apply it so the chat reflects reality. */
  const decide = async (p: ProposedChange, decision: "accepted" | "rejected") => {
    if (!session?.sync_run_id || !p.sync_change_id) return;
    setBusy(true);
    setNotice(null);
    try {
      await decideChanges(session.sync_run_id, { ids: [p.sync_change_id], decision });
      if (decision === "accepted") {
        const run = await applyRun(session.sync_run_id);
        setNotice(
          `Applied ${run.totals?.applied ?? 0} change${(run.totals?.applied ?? 0) === 1 ? "" : "s"} to the catalogue.`,
        );
      } else {
        setNotice("Rejected — nothing was written.");
      }
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Could not record that decision");
    } finally {
      setBusy(false);
    }
  };

  const subjectName =
    (subject?.name as string) ?? (subject?.title as string) ?? (subject?.institution as string) ?? null;

  return (
    <RefineListView
      title={session?.title || "Data curation"}
      breadcrumb={
        <AppBreadcrumbs
          items={[{ label: "Data sync", href: "/data-sync" }, { label: "Curation" }]}
        />
      }
      headerButtons={
        <Button startIcon={<CloseIcon />} onClick={() => navigate("/data-sync")}>
          Close
        </Button>
      }
    >
      <Box sx={{ p: { xs: 1, sm: 2 }, maxWidth: 940, mx: "auto" }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {notice && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>
            {notice}
          </Alert>
        )}

        {!session && !error && <CircularProgress size={24} />}

        {session && (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              Paste a URL, attach a document, or just describe what to change.{" "}
              {session.entity_type ? (
                <>
                  Editing <b>{subjectName ?? session.entity_type}</b>.
                </>
              ) : (
                "This session isn't tied to a specific record."
              )}{" "}
              Every proposal quotes the material it came from, and nothing is written until you
              accept it.
            </Alert>

            <Stack spacing={2} sx={{ mb: 2 }}>
              {messages.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No messages yet — give it something to work from.
                </Typography>
              )}

              {messages.map((m) => (
                <Paper
                  key={m.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    ml: m.role === "user" ? 6 : 0,
                    mr: m.role === "user" ? 0 : 6,
                    bgcolor: m.role === "user" ? "action.hover" : "background.paper",
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      {m.role === "user" ? "You" : "Assistant"} · {formatDate(m.created_at)}
                    </Typography>
                  </Stack>

                  {m.content && (
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {m.content}
                    </Typography>
                  )}

                  {m.attachments.length > 0 && (
                    <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                      {m.attachments.map((a, i) => (
                        <Tooltip
                          key={i}
                          title={
                            a.status === "read"
                              ? `Read ${a.chars?.toLocaleString() ?? "?"} characters`
                              : `Could not read: ${a.reason}`
                          }
                        >
                          <Chip
                            size="small"
                            icon={a.kind === "url" ? <LinkIcon /> : <AttachFileIcon />}
                            color={a.status === "read" ? "success" : "error"}
                            variant="outlined"
                            label={a.label.replace(/^https?:\/\//, "").slice(0, 52)}
                          />
                        </Tooltip>
                      ))}
                    </Stack>
                  )}

                  {m.proposals.length > 0 && (
                    <>
                      <Divider sx={{ my: 1.5 }} />
                      <Stack spacing={1}>
                        {m.proposals.map((p, i) => (
                          <Paper key={i} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1}
                              alignItems={{ sm: "center" }}
                            >
                              <Box flex={1}>
                                <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                                  {p.field}: {renderValue(p.before)} → <b>{renderValue(p.after)}</b>
                                </Typography>
                                <Stack direction="row" spacing={0.5} alignItems="flex-start" sx={{ mt: 0.5 }}>
                                  <FormatQuoteIcon sx={{ fontSize: 13, mt: 0.2 }} color="disabled" />
                                  <Typography variant="caption" color="text.secondary">
                                    {p.quote}
                                  </Typography>
                                </Stack>
                                <Typography variant="caption" color="text.secondary">
                                  from{" "}
                                  {p.cited.startsWith("http") ? (
                                    <Link href={p.cited} target="_blank" rel="noopener noreferrer">
                                      {p.cited.replace(/^https?:\/\//, "").slice(0, 60)}
                                    </Link>
                                  ) : (
                                    p.cited
                                  )}
                                </Typography>
                              </Box>
                              <Stack direction="row" spacing={0.5}>
                                <Button
                                  size="small"
                                  startIcon={<BlockIcon />}
                                  disabled={busy}
                                  onClick={() => decide(p, "rejected")}
                                >
                                  Reject
                                </Button>
                                <Button
                                  size="small"
                                  variant="contained"
                                  startIcon={<CheckIcon />}
                                  disabled={busy}
                                  onClick={() => decide(p, "accepted")}
                                >
                                  Apply
                                </Button>
                              </Stack>
                            </Stack>
                          </Paper>
                        ))}
                      </Stack>
                    </>
                  )}
                </Paper>
              ))}
              {sending && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={16} />
                  <Typography variant="caption" color="text.secondary">
                    Reading the material and drafting proposals…
                  </Typography>
                </Stack>
              )}
              <div ref={bottom} />
            </Stack>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, position: "sticky", bottom: 8 }}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                maxRows={8}
                size="small"
                placeholder="What should change, and according to what?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
                <TextField
                  size="small"
                  placeholder="Paste a source URL and press Enter"
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addUrl();
                    }
                  }}
                  sx={{ flex: 1 }}
                />
                <Button component="label" size="small" startIcon={<AttachFileIcon />} variant="outlined">
                  Attach files
                  <input
                    type="file"
                    hidden
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.md,.html"
                    onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 5))}
                  />
                </Button>
                <Button
                  variant="contained"
                  endIcon={<SendIcon />}
                  disabled={sending || (!content.trim() && !urls.length && !files.length)}
                  onClick={send}
                >
                  Send
                </Button>
              </Stack>

              {(urls.length > 0 || files.length > 0) && (
                <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                  {urls.map((u) => (
                    <Chip
                      key={u}
                      size="small"
                      icon={<LinkIcon />}
                      label={u.replace(/^https?:\/\//, "").slice(0, 46)}
                      onDelete={() => setUrls((prev) => prev.filter((x) => x !== u))}
                    />
                  ))}
                  {files.map((f) => (
                    <Chip
                      key={f.name}
                      size="small"
                      icon={<AttachFileIcon />}
                      label={`${f.name} (${Math.round(f.size / 1024)} KB)`}
                      onDelete={() => setFiles((prev) => prev.filter((x) => x !== f))}
                    />
                  ))}
                </Stack>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                PDFs and images are read with OCR. Any URL you paste is fetched — its domain's trust
                level is recorded, and it's added to the source registry so it can be re-checked later.
              </Typography>
            </Paper>
          </>
        )}
      </Box>
    </RefineListView>
  );
}
