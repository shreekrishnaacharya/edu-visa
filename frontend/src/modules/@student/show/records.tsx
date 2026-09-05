import { useEffect, useState } from "react";
import { useCreate, useDelete, useList } from "@refinedev/core";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import StickyNote2OutlinedIcon from "@mui/icons-material/StickyNote2Outlined";
import dayjs from "dayjs";

import { Card as SectionCard, ProfileItemCard } from "@components/card";
import NoDataLabel from "@components/other/no.data";
import { getDemoUser } from "src/authProvider";
import { DOC_TYPE_PRESETS } from "@mocks/db/documents";
import type { Attachment, FollowUp, FollowUpKind, StudentDocument } from "@mocks/types";

// ---------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------

const MAX_BYTES = 4 * 1024 * 1024;
const fmtSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

async function fileToAttachment(file: File): Promise<Attachment | { error: string }> {
  if (file.size > MAX_BYTES) return { error: `"${file.name}" is larger than 4 MB` };
  const data_url = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("read failed"));
    r.readAsDataURL(file);
  });
  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    data_url,
  };
}

const relTime = (iso: string) => dayjs(iso).fromNow();

function SectionShell({
  title,
  blurb,
  action,
  children,
}: {
  title: string;
  blurb: string;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SectionCard title={title} sx={{ mb: 2 }}>
      <Box sx={{ p: 2 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {blurb}
          </Typography>
          {action}
        </Stack>
        {children}
      </Box>
    </SectionCard>
  );
}

function DeleteAction({ onDelete }: { onDelete: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return armed ? (
    <Button size="small" color="error" variant="outlined" onClick={onDelete}>
      Confirm delete
    </Button>
  ) : (
    <IconButton size="small" onClick={() => setArmed(true)} aria-label="delete entry">
      <DeleteOutlineIcon fontSize="small" />
    </IconButton>
  );
}

function AttachmentChip({ att, onOpen }: { att: Attachment; onOpen: (a: Attachment) => void }) {
  const isImg = att.type.startsWith("image/");
  return (
    <Box
      onClick={() => onOpen(att)}
      sx={{
        cursor: "pointer",
        border: 1,
        borderColor: "divider",
        borderRadius: 1.5,
        overflow: "hidden",
        width: 128,
        flexShrink: 0,
        "&:hover": { boxShadow: 1 },
      }}
    >
      {isImg ? (
        <Box component="img" src={att.data_url} alt={att.name} sx={{ width: 128, height: 84, objectFit: "cover", display: "block" }} />
      ) : (
        <Stack alignItems="center" justifyContent="center" sx={{ width: 128, height: 84, bgcolor: "action.hover" }}>
          <InsertDriveFileOutlinedIcon color="action" />
        </Stack>
      )}
      <Box sx={{ px: 0.75, py: 0.5 }}>
        <Typography variant="caption" noWrap sx={{ display: "block" }}>
          {att.name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {fmtSize(att.size)}
        </Typography>
      </Box>
    </Box>
  );
}

function AttachmentViewer({ att, onClose }: { att: Attachment | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(att)} onClose={onClose} maxWidth="md" fullWidth>
      {att && (
        <DialogContent sx={{ p: 1, position: "relative" }}>
          <IconButton onClick={onClose} sx={{ position: "absolute", right: 8, top: 8, bgcolor: "background.paper", zIndex: 1 }}>
            <CloseIcon />
          </IconButton>
          {att.type.startsWith("image/") ? (
            <Box component="img" src={att.data_url} alt={att.name} sx={{ width: "100%", display: "block", borderRadius: 1 }} />
          ) : att.type === "application/pdf" ? (
            <Box component="iframe" title={att.name} src={att.data_url} sx={{ width: "100%", height: "75vh", border: 0 }} />
          ) : (
            <Stack alignItems="center" spacing={1} sx={{ py: 6 }}>
              <InsertDriveFileOutlinedIcon fontSize="large" color="action" />
              <Typography variant="body2">{att.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {att.type} · {fmtSize(att.size)} — preview not available in the prototype
              </Typography>
            </Stack>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}

function FileButton({
  label,
  accept,
  multiple,
  disabled,
  onPick,
}: {
  label: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onPick: (files: FileList | null) => void;
}) {
  return (
    <Button component="label" size="small" variant="outlined" startIcon={<AttachFileIcon />} disabled={disabled}>
      {label}
      <input
        hidden
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Follow-up history
// ---------------------------------------------------------------------------

const KIND_META: Record<FollowUpKind, { label: string; icon: JSX.Element }> = {
  note: { label: "Note", icon: <StickyNote2OutlinedIcon fontSize="small" /> },
  call: { label: "Call", icon: <PhoneOutlinedIcon fontSize="small" /> },
  email: { label: "Email", icon: <EmailOutlinedIcon fontSize="small" /> },
  meeting: { label: "Meeting", icon: <GroupsOutlinedIcon fontSize="small" /> },
  document: { label: "Document", icon: <DescriptionOutlinedIcon fontSize="small" /> },
};

function FollowUpDialog({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const user = getDemoUser();
  const { mutate: create, isLoading: creating } = useCreate();
  const [kind, setKind] = useState<FollowUpKind>("note");
  const [body, setBody] = useState("");
  const [staged, setStaged] = useState<Attachment[]>([]);
  const [reading, setReading] = useState(false);
  const [err, setErr] = useState("");

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setReading(true);
    setErr("");
    for (const f of Array.from(files)) {
      const r = await fileToAttachment(f);
      if ("error" in r) setErr(r.error);
      else setStaged((p) => [...p, r]);
    }
    setReading(false);
  };

  const submit = () => {
    if (!body.trim() && staged.length === 0) return;
    create(
      {
        resource: "follow-ups",
        values: { student_id: studentId, kind, body: body.trim(), author: user.name, attachments: staged },
        successNotification: false,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        Add follow-up
        <IconButton onClick={onClose} sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField select size="small" label="Type" value={kind} onChange={(e) => setKind(e.target.value as FollowUpKind)}>
            {(Object.keys(KIND_META) as FollowUpKind[]).map((k) => (
              <MenuItem key={k} value={k}>
                {KIND_META[k].label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Note / feedback"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            multiline
            minRows={4}
            autoFocus
            placeholder="What happened, what's next…"
          />
          {staged.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {staged.map((a) => (
                <Chip
                  key={a.id}
                  label={`${a.name} · ${fmtSize(a.size)}`}
                  onDelete={() => setStaged((p) => p.filter((x) => x.id !== a.id))}
                  variant="outlined"
                  size="small"
                />
              ))}
            </Stack>
          )}
          {err && (
            <Alert severity="warning" onClose={() => setErr("")}>
              {err}
            </Alert>
          )}
          <Box>
            <FileButton label="Attach image" accept="image/*" multiple disabled={reading} onPick={addFiles} />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={creating || reading || (!body.trim() && staged.length === 0)}>
          {creating ? "Adding…" : "Add entry"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function FollowUpTab({ studentId }: { studentId: string }) {
  const { data, isLoading } = useList<FollowUp>({
    resource: "follow-ups",
    filters: [{ field: "student_id", operator: "eq", value: studentId }],
    sorters: [{ field: "created_at", order: "desc" }],
    pagination: { pageSize: 100 },
  });
  const { mutate: remove } = useDelete();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<Attachment | null>(null);
  const entries = data?.data ?? [];

  return (
    <SectionShell
      title="Follow-up history"
      blurb="Log calls, meetings and status changes for this student. Not part of the intake form."
      action={
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setAdding(true)} sx={{ flexShrink: 0 }}>
          Add follow-up
        </Button>
      }
    >
      {isLoading ? (
        <LinearProgress />
      ) : entries.length === 0 ? (
        <NoDataLabel message="No follow-up entries yet" />
      ) : (
        <Stack spacing={2}>
          {entries.map((f) => (
            <ProfileItemCard key={f.id} sx={{ alignItems: "flex-start" }}>
              <Chip icon={KIND_META[f.kind]?.icon} label={KIND_META[f.kind]?.label ?? f.kind} size="small" variant="outlined" />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">
                    {f.author} · {relTime(f.created_at)}
                  </Typography>
                  <DeleteAction onDelete={() => remove({ resource: "follow-ups", id: f.id, successNotification: false })} />
                </Stack>
                {f.body && (
                  <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>
                    {f.body}
                  </Typography>
                )}
                {f.attachments?.length > 0 && (
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                    {f.attachments.map((a) => (
                      <AttachmentChip key={a.id} att={a} onOpen={setOpen} />
                    ))}
                  </Stack>
                )}
              </Box>
            </ProfileItemCard>
          ))}
        </Stack>
      )}

      {adding && <FollowUpDialog studentId={studentId} onClose={() => setAdding(false)} />}
      <AttachmentViewer att={open} onClose={() => setOpen(null)} />
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

function DocumentDialog({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const user = getDemoUser();
  const { mutate: create, isLoading: creating } = useCreate();
  const [docType, setDocType] = useState("");
  const [remark, setRemark] = useState("");
  const [file, setFile] = useState<Attachment | null>(null);
  const [reading, setReading] = useState(false);
  const [err, setErr] = useState("");

  const pickFile = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setReading(true);
    setErr("");
    const r = await fileToAttachment(f);
    setReading(false);
    if ("error" in r) setErr(r.error);
    else setFile(r);
  };

  const submit = () => {
    if (!docType.trim() || !file) return;
    create(
      {
        resource: "documents",
        values: { student_id: studentId, doc_type: docType.trim(), remark: remark.trim(), file, uploaded_by: user.name },
        successNotification: false,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        Add document
        <IconButton onClick={onClose} sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Autocomplete
            freeSolo
            size="small"
            options={DOC_TYPE_PRESETS}
            value={docType}
            onChange={(_, v) => setDocType(v ?? "")}
            onInputChange={(_, v) => setDocType(v)}
            renderInput={(p) => (
              <TextField
                {...p}
                label="Document type"
                required
                autoFocus
                placeholder="Pick one or type your own"
                helperText="e.g. Bank statement, Financial document, or anything else"
              />
            )}
          />
          <TextField
            size="small"
            label="Remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            multiline
            minRows={2}
            placeholder="Context — which account, date range, whose name…"
          />
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <FileButton label={file ? "Change file" : "Select file"} accept="*/*" disabled={reading} onPick={pickFile} />
            {file && (
              <Chip label={`${file.name} · ${fmtSize(file.size)}`} onDelete={() => setFile(null)} variant="outlined" size="small" />
            )}
          </Stack>
          {err && (
            <Alert severity="warning" onClose={() => setErr("")}>
              {err}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={creating || reading || !docType.trim() || !file}>
          {creating ? "Uploading…" : "Add document"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function DocumentsTab({ studentId }: { studentId: string }) {
  const { data, isLoading } = useList<StudentDocument>({
    resource: "documents",
    filters: [{ field: "student_id", operator: "eq", value: studentId }],
    sorters: [{ field: "created_at", order: "desc" }],
    pagination: { pageSize: 100 },
  });
  const { mutate: remove } = useDelete();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<Attachment | null>(null);
  const docs = data?.data ?? [];

  return (
    <SectionShell
      title="Documents"
      blurb="Files supplied by the student — transcripts, financial evidence, passport, and so on."
      action={
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setAdding(true)} sx={{ flexShrink: 0 }}>
          Add document
        </Button>
      }
    >
      {isLoading ? (
        <LinearProgress />
      ) : docs.length === 0 ? (
        <NoDataLabel message="No documents uploaded yet" />
      ) : (
        <Stack spacing={2}>
          {docs.map((d) => (
            <ProfileItemCard key={d.id} sx={{ alignItems: "flex-start" }}>
              <AttachmentChip att={d.file} onOpen={setOpen} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Chip label={d.doc_type} size="small" color="primary" variant="outlined" />
                  <DeleteAction onDelete={() => remove({ resource: "documents", id: d.id, successNotification: false })} />
                </Stack>
                {d.remark && (
                  <Typography variant="body2" sx={{ mt: 0.75, whiteSpace: "pre-wrap" }}>
                    {d.remark}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                  {d.uploaded_by} · {relTime(d.created_at)}
                </Typography>
              </Box>
            </ProfileItemCard>
          ))}
        </Stack>
      )}

      {adding && <DocumentDialog studentId={studentId} onClose={() => setAdding(false)} />}
      <AttachmentViewer att={open} onClose={() => setOpen(null)} />
    </SectionShell>
  );
}
