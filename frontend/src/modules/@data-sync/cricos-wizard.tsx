import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import BlockIcon from "@mui/icons-material/Block";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";

import { RefineCreateView } from "@components/view/create";
import { AppBreadcrumbs } from "@components/breadcrumb/app.breadcrumb";
import {
  applyRun,
  cancelRun,
  ChangeType,
  CricosStatus,
  decideChanges,
  EntityType,
  formatDate,
  getCricosStatus,
  getRun,
  getSummary,
  isRunActive,
  listChanges,
  renderValue,
  StalenessWindow,
  STALENESS_LABELS,
  startCricosRun,
  SummaryRow,
  SyncChange,
  SyncRun,
} from "./api";

const STEPS = ["Source & scope", "Fetch & compare", "Review changes", "Apply"];

const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

const CHANGE_COLOURS: Record<ChangeType, "success" | "info" | "warning" | "default"> = {
  create: "success",
  update: "info",
  disappeared: "warning",
  unchanged: "default",
};

/**
 * Pulls the official CRICOS register from data.gov.au, diffs it against the
 * catalogue, and applies only what the user accepts.
 *
 * Register-sourced facts (fee, title, campus city) auto-apply — data.gov.au is
 * the legal source of truth for those, so confirming each one adds clicks, not
 * safety. Anything touching an entry requirement is never auto-applied, because
 * the register doesn't publish entry requirements at all.
 */
export function CricosSyncWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<CricosStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Step 1 scope
  const [window, setWindow] = useState<StalenessWindow>("all");
  const [includeVet, setIncludeVet] = useState(false);
  const [states, setStates] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);

  // Run state
  const [run, setRun] = useState<SyncRun | null>(null);
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 3 review
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [entityTab, setEntityTab] = useState<EntityType>("course");
  const [changeFilter, setChangeFilter] = useState<ChangeType | "">("");
  const [query, setQuery] = useState("");
  const [changes, setChanges] = useState<SyncChange[]>([]);
  const [changeTotal, setChangeTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    getCricosStatus()
      .then(setStatus)
      .catch((e) => setStatusError(e?.message ?? "Could not read sync status"));
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // The run happens on a queue, so the only way to follow it is to poll.
  useEffect(() => {
    if (!run || !isRunActive(run.status)) return;
    pollRef.current = setInterval(async () => {
      try {
        const fresh = await getRun(run.id);
        setRun(fresh);
        if (!isRunActive(fresh.status)) stopPolling();
      } catch {
        /* transient — keep polling */
      }
    }, 2000);
    return stopPolling;
  }, [run?.id, run?.status, stopPolling]);

  // Once the diff is built, move to review.
  useEffect(() => {
    if (!run) return;
    if (run.status === "awaiting_review") {
      setStep(2);
      void refreshReview();
    } else if (run.status === "done" && step < 3) {
      setStep(3);
    } else if (run.status === "failed") {
      setError(run.error ?? "The run failed");
    }
  }, [run?.status]);

  const refreshReview = useCallback(async () => {
    if (!run) return;
    const [s, c] = await Promise.all([
      getSummary(run.id),
      listChanges(run.id, {
        entity_type: entityTab,
        change_type: changeFilter || undefined,
        q: query || undefined,
        take: 100,
      }),
    ]);
    setSummary(s);
    setChanges(c.items);
    setChangeTotal(c.total);
    setSelected(new Set());
  }, [run?.id, entityTab, changeFilter, query]);

  useEffect(() => {
    if (step === 2) void refreshReview();
  }, [step, entityTab, changeFilter, refreshReview]);

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const created = await startCricosRun({
        window,
        include_vet: includeVet,
        states: states.length ? states : undefined,
        institution_types: types.length ? types : undefined,
      });
      setRun(created);
      setStep(1);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Could not start the run");
    } finally {
      setStarting(false);
    }
  };

  const decide = async (decision: "accepted" | "rejected", all = false) => {
    if (!run) return;
    setBusy(true);
    try {
      await decideChanges(run.id, {
        decision,
        ...(all
          ? { all: true, entity_type: entityTab, change_type: changeFilter || undefined }
          : { ids: [...selected] }),
      });
      await refreshReview();
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!run) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await applyRun(run.id);
      setRun(updated);
      setStep(3);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Apply failed");
    } finally {
      setBusy(false);
    }
  };

  const abandon = async () => {
    if (run && isRunActive(run.status)) await cancelRun(run.id);
    navigate("/data-sync");
  };

  const counts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const r of summary) {
      if (r.entity_type !== entityTab) continue;
      acc[r.change_type] = (acc[r.change_type] ?? 0) + Number(r.count);
      acc[`decision:${r.decision}`] = (acc[`decision:${r.decision}`] ?? 0) + Number(r.count);
    }
    return acc;
  }, [summary, entityTab]);

  const pendingAll = useMemo(
    () =>
      summary
        .filter((r) => r.decision === "pending")
        .reduce((n, r) => n + Number(r.count), 0),
    [summary],
  );
  const acceptedAll = useMemo(
    () =>
      summary
        .filter((r) => r.decision === "accepted")
        .reduce((n, r) => n + Number(r.count), 0),
    [summary],
  );

  const progress = run?.totals?.total
    ? Math.min(100, Math.round(((run.totals.processed ?? 0) / run.totals.total) * 100))
    : 0;

  return (
    <RefineCreateView
      title="Sync the CRICOS register"
      breadcrumb={
        <AppBreadcrumbs
          items={[{ label: "Data sync", href: "/data-sync" }, { label: "CRICOS register" }]}
        />
      }
      headerButtons={
        <Button startIcon={<CloseIcon />} onClick={abandon}>
          {run && isRunActive(run.status) ? "Cancel run" : "Close"}
        </Button>
      }
      footerButtons={<></>}
      goBack={false}
    >
      <Box sx={{ maxWidth: 1100, mx: "auto", p: { xs: 1, sm: 2 } }}>
        <Stepper activeStep={step} sx={{ mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* ---------------------------------------------------- step 1: scope */}
        {step === 0 && (
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                Source
              </Typography>
              {statusError && <Alert severity="warning">{statusError}</Alert>}
              {!status && !statusError && <CircularProgress size={22} />}
              {status && (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Commonwealth Register of Institutions and Courses for Overseas Students, published
                    as open data by the Department of Education on data.gov.au — the same monthly
                    PRISMS export that backs the CRICOS website.
                  </Typography>
                  {status.upstream_error ? (
                    <Alert severity="error" sx={{ mb: 1 }}>
                      Could not reach data.gov.au: {status.upstream_error}
                    </Alert>
                  ) : (
                    <Table size="small" sx={{ mb: 1 }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>File</TableCell>
                          <TableCell>Published upstream</TableCell>
                          <TableCell align="right">Size</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(status.upstream ?? {}).map(([key, meta]) => (
                          <TableRow key={key}>
                            <TableCell>{meta?.name ?? key}</TableCell>
                            <TableCell>{formatDate(meta?.last_modified)}</TableCell>
                            <TableCell align="right">
                              {meta?.size ? `${(meta.size / 1e6).toFixed(1)} MB` : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  <Divider sx={{ my: 1.5 }} />
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      label={`Last synced: ${formatDate(status.last_sync?.finished_at)}`}
                    />
                    <Chip size="small" label={`${status.catalogue.universities} institutions`} />
                    <Chip size="small" label={`${status.catalogue.courses} courses`} />
                    <Chip
                      size="small"
                      color="warning"
                      variant="outlined"
                      label={`${status.catalogue.courses_without_sourced_english} without a sourced English band`}
                    />
                  </Stack>
                  {status.source_unchanged && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      <AlertTitle>Nothing new upstream</AlertTitle>
                      data.gov.au hasn't republished the register since your last sync. Running now is
                      safe but will almost certainly find no changes.
                    </Alert>
                  )}
                </>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Re-check records older than
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                The register is a single monthly file, so this doesn't reduce the download — it
                narrows which of your existing records get compared, so you review a short list
                instead of all {status?.catalogue.courses ?? "12,000+"}.
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={window}
                onChange={(_, v) => v && setWindow(v)}
                sx={{ flexWrap: "wrap" }}
              >
                {(Object.keys(STALENESS_LABELS) as StalenessWindow[]).map((w) => (
                  <ToggleButton key={w} value={w}>
                    {STALENESS_LABELS[w]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                Scope
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>States</InputLabel>
                  <Select
                    multiple
                    value={states}
                    onChange={(e) => setStates(e.target.value as string[])}
                    input={<OutlinedInput label="States" />}
                    renderValue={(v) => (v as string[]).join(", ") || "All"}
                  >
                    {AU_STATES.map((s) => (
                      <MenuItem key={s} value={s}>
                        <Checkbox size="small" checked={states.includes(s)} />
                        {s}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Provider type</InputLabel>
                  <Select
                    multiple
                    value={types}
                    onChange={(e) => setTypes(e.target.value as string[])}
                    input={<OutlinedInput label="Provider type" />}
                    renderValue={(v) => (v as string[]).join(", ") || "All"}
                  >
                    {["Government", "Private"].map((t) => (
                      <MenuItem key={t} value={t}>
                        <Checkbox size="small" checked={types.includes(t)} />
                        {t}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <Tooltip title="Diploma, Advanced Diploma, Associate Degree and Certificate III/IV. Real registrations, but these providers publish far less usable admissions data.">
                <FormControlLabel
                  sx={{ mt: 1 }}
                  control={
                    <Checkbox
                      checked={includeVet}
                      onChange={(e) => setIncludeVet(e.target.checked)}
                    />
                  }
                  label="Also include VET / Diploma levels"
                />
              </Tooltip>
            </Paper>

            <Alert severity="info">
              Fees, titles and campus locations from the register apply automatically — it's the legal
              source of truth for those. Entry requirements are never touched here: the register
              doesn't publish them, so they stay unsourced until read from each institution's own
              admissions page.
            </Alert>

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button color="inherit" onClick={() => navigate("/data-sync")}>
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={<CloudDownloadIcon />}
                disabled={starting || !status}
                onClick={start}
              >
                {starting ? "Starting…" : "Fetch & compare"}
              </Button>
            </Stack>
          </Stack>
        )}

        {/* -------------------------------------------------- step 2: running */}
        {step === 1 && run && (
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {run.totals?.step ?? "Working"}…
            </Typography>
            <LinearProgress
              variant={run.totals?.total ? "determinate" : "indeterminate"}
              value={progress}
              sx={{ mb: 1.5, height: 8, borderRadius: 1 }}
            />
            <Typography variant="caption" color="text.secondary">
              {run.totals?.total
                ? `${(run.totals.processed ?? 0).toLocaleString()} of ${run.totals.total.toLocaleString()} records compared`
                : "Downloading the register from data.gov.au — this takes a moment (~7 MB)."}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={0.5}>
              {run.log.map((l, i) => (
                <Typography
                  key={i}
                  variant="caption"
                  color={l.level === "error" ? "error.main" : "text.secondary"}
                  sx={{ fontFamily: "monospace" }}
                >
                  {l.message}
                </Typography>
              ))}
            </Stack>
          </Paper>
        )}

        {/* --------------------------------------------------- step 3: review */}
        {step === 2 && run && (
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
                <Chip size="small" color="success" variant="outlined" label={`${counts.create ?? 0} new`} />
                <Chip size="small" color="info" variant="outlined" label={`${counts.update ?? 0} changed`} />
                <Chip
                  size="small"
                  color="warning"
                  variant="outlined"
                  label={`${counts.disappeared ?? 0} no longer in the register`}
                />
                <Chip size="small" label={`${run.totals?.unchanged ?? 0} unchanged`} />
                {!!run.totals?.auto_applied && (
                  <Chip
                    size="small"
                    color="primary"
                    label={`${run.totals.auto_applied} auto-applied`}
                  />
                )}
              </Stack>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="center">
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={entityTab}
                  onChange={(_, v) => v && setEntityTab(v)}
                >
                  <ToggleButton value="course">Courses</ToggleButton>
                  <ToggleButton value="university">Institutions</ToggleButton>
                </ToggleButtonGroup>
                <FormControl size="small" sx={{ minWidth: 170 }}>
                  <InputLabel>Change type</InputLabel>
                  <Select
                    label="Change type"
                    value={changeFilter}
                    onChange={(e) => setChangeFilter(e.target.value as ChangeType | "")}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="create">New</MenuItem>
                    <MenuItem value="update">Changed</MenuItem>
                    <MenuItem value="disappeared">No longer listed</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  placeholder="Search title or CRICOS code"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && refreshReview()}
                  sx={{ minWidth: 240 }}
                />
                <Box flex={1} />
                <Typography variant="caption" color="text.secondary">
                  {changeTotal} row{changeTotal === 1 ? "" : "s"}
                </Typography>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={changes.length > 0 && selected.size === changes.length}
                        indeterminate={selected.size > 0 && selected.size < changes.length}
                        onChange={(e) =>
                          setSelected(e.target.checked ? new Set(changes.map((c) => c.id)) : new Set())
                        }
                      />
                    </TableCell>
                    <TableCell>Record</TableCell>
                    <TableCell>Change</TableCell>
                    <TableCell>What moved</TableCell>
                    <TableCell>Decision</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {changes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          Nothing to review here.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {changes.map((c) => (
                    <TableRow key={c.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={selected.has(c.id)}
                          disabled={c.decision === "applied"}
                          onChange={(e) => {
                            const next = new Set(selected);
                            e.target.checked ? next.add(c.id) : next.delete(c.id);
                            setSelected(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{c.label || "—"}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {c.natural_key}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={CHANGE_COLOURS[c.change_type]}
                          variant="outlined"
                          label={c.change_type === "disappeared" ? "not in register" : c.change_type}
                        />
                      </TableCell>
                      <TableCell>
                        {c.change_type === "disappeared" ? (
                          <Typography variant="caption" color="text.secondary">
                            Still in our catalogue but absent from this export. Never deleted
                            automatically — accepting only acknowledges it.
                          </Typography>
                        ) : c.field_diffs.length === 0 ? (
                          <Typography variant="caption" color="text.secondary">
                            New record
                          </Typography>
                        ) : (
                          <Stack spacing={0.25}>
                            {c.field_diffs.map((d) => (
                              <Typography key={d.field} variant="caption" sx={{ fontFamily: "monospace" }}>
                                {d.field}: {renderValue(d.before)} → <b>{renderValue(d.after)}</b>
                              </Typography>
                            ))}
                          </Stack>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={c.auto_applied ? "auto-applied" : c.decision}
                          color={
                            c.decision === "accepted" || c.decision === "applied"
                              ? "success"
                              : c.decision === "rejected"
                                ? "default"
                                : "warning"
                          }
                          variant={c.decision === "pending" ? "outlined" : "filled"}
                        />
                        {c.apply_error && (
                          <Typography variant="caption" color="error.main" display="block">
                            {c.apply_error}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
              <Button color="inherit" onClick={abandon}>
                Discard run
              </Button>
              <Button
                size="small"
                startIcon={<BlockIcon />}
                disabled={busy || selected.size === 0}
                onClick={() => decide("rejected")}
              >
                Reject selected ({selected.size})
              </Button>
              <Button
                size="small"
                startIcon={<CheckIcon />}
                disabled={busy || selected.size === 0}
                onClick={() => decide("accepted")}
              >
                Accept selected ({selected.size})
              </Button>
              <Button size="small" variant="outlined" disabled={busy} onClick={() => decide("accepted", true)}>
                Accept all shown
              </Button>
              <Button
                variant="contained"
                disabled={busy || acceptedAll === 0}
                onClick={apply}
              >
                Apply {acceptedAll} accepted change{acceptedAll === 1 ? "" : "s"}
              </Button>
            </Stack>
            {pendingAll > 0 && (
              <Typography variant="caption" color="text.secondary" align="right">
                {pendingAll} change{pendingAll === 1 ? "" : "s"} still undecided — they stay staged and
                won't be written.
              </Typography>
            )}
          </Stack>
        )}

        {/* ---------------------------------------------------- step 4: done */}
        {step === 3 && run && (
          <Stack spacing={2}>
            <Alert severity={run.status === "failed" ? "error" : "success"}>
              <AlertTitle>
                {run.status === "failed" ? "Run failed" : "Sync complete"}
              </AlertTitle>
              {run.status !== "failed" && (
                <>
                  Applied {run.totals?.applied ?? 0} change
                  {(run.totals?.applied ?? 0) === 1 ? "" : "s"}
                  {run.totals?.failed ? `, ${run.totals.failed} failed` : ""}. The catalogue now
                  reflects the register as published {formatDate(run.source_meta?.courses?.last_modified)}.
                </>
              )}
              {run.error}
            </Alert>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack spacing={0.5}>
                {run.log.map((l, i) => (
                  <Typography
                    key={i}
                    variant="caption"
                    color={l.level === "error" ? "error.main" : "text.secondary"}
                    sx={{ fontFamily: "monospace" }}
                  >
                    {l.message}
                  </Typography>
                ))}
              </Stack>
            </Paper>
            <Alert severity="info">
              Entry requirements were not touched. {status?.catalogue.courses_without_sourced_english ?? 0} course
              {(status?.catalogue.courses_without_sourced_english ?? 0) === 1 ? "" : "s"} still have no
              English band sourced from the institution — the matching engine reports those as unknown
              rather than assuming a bar.
            </Alert>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button variant="contained" onClick={() => navigate("/data-sync")}>
                Back to data sync
              </Button>
            </Stack>
          </Stack>
        )}
      </Box>
    </RefineCreateView>
  );
}
