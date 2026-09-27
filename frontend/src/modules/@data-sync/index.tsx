import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import ChatIcon from "@mui/icons-material/Chat";

import { RefineListView } from "@components/view/list";
import {
  CricosStatus,
  formatDate,
  getCricosStatus,
  isRunActive,
  listRuns,
  SyncRun,
  SyncStatus,
} from "./api";

const STATUS_COLOUR: Record<SyncStatus, "default" | "info" | "warning" | "success" | "error"> = {
  queued: "default",
  running: "info",
  awaiting_review: "warning",
  applying: "info",
  done: "success",
  failed: "error",
  cancelled: "default",
};

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "warning" | "default";
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: "100%" }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" color={tone === "warning" ? "warning.main" : "text.primary"}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Paper>
  );
}

/**
 * Landing page for catalogue sourcing: how fresh the data is, what's missing,
 * and the history of every run. The point of the freshness numbers is that
 * nobody has to guess whether a sync is worth doing.
 */
export function DataSyncDashboard() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<CricosStatus | null>(null);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [s, r] = await Promise.all([getCricosStatus(), listRuns(undefined, 15)]);
      setStatus(s);
      setRuns(r);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Could not load sync status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Keep the list live while a run is in flight.
  const hasActive = runs.some((r) => isRunActive(r.status));
  useEffect(() => {
    if (!hasActive) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [hasActive]);

  const c = status?.catalogue;

  return (
    <RefineListView
      title="Data sync"
      headerButtons={
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<ChatIcon />}
            onClick={() => navigate("/data-sync/curation")}
          >
            Curate with AI
          </Button>
          <Button
            variant="outlined"
            startIcon={<TravelExploreIcon />}
            onClick={() => navigate("/data-sync/sources")}
          >
            Requirement sources
          </Button>
          <Button
            variant="contained"
            startIcon={<SyncIcon />}
            onClick={() => navigate("/data-sync/cricos")}
          >
            Sync CRICOS register
          </Button>
        </Stack>
      }
    >
      <Box sx={{ p: { xs: 1, sm: 2 } }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading && <CircularProgress size={24} />}

        {status && (
          <>
            {status.source_unchanged ? (
              <Alert severity="success" sx={{ mb: 2 }}>
                Up to date — data.gov.au hasn't republished the CRICOS register since your last sync.
              </Alert>
            ) : (
              <Alert severity="info" sx={{ mb: 2 }}>
                The register was last published upstream on{" "}
                {formatDate(status.upstream?.courses?.last_modified)}
                {status.last_sync
                  ? `, and you last synced ${formatDate(status.last_sync.finished_at)}.`
                  : " — you have never run a sync."}
              </Alert>
            )}

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} md={3}>
                <StatCard label="Institutions" value={c!.universities} hint="from the register" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="Courses" value={c!.courses} hint="higher-ed, non-expired" />
              </Grid>
              <Grid item xs={6} md={3}>
                <Tooltip title="CRICOS publishes no entry requirements, so these are read from each institution's own admissions page. Until then the matching engine reports the English gate as unknown rather than assuming a bar.">
                  <Box
                    sx={{ cursor: "pointer", height: "100%" }}
                    onClick={() => navigate("/data-sync/sources")}
                  >
                    <StatCard
                      label="Missing English band"
                      value={c!.courses_without_sourced_english}
                      hint="not yet sourced — click to source"
                      tone="warning"
                    />
                  </Box>
                </Tooltip>
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Tracked source pages"
                  value={status.tracked_sources}
                  hint="known-good URLs on record"
                />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Recent runs
            </Typography>
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Kind</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Started</TableCell>
                    <TableCell>Result</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {runs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          No syncs yet. Start with the CRICOS register.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {runs.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>{r.kind.replace(/_/g, " ")}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={r.status.replace(/_/g, " ")}
                          color={STATUS_COLOUR[r.status]}
                          variant={r.status === "done" ? "filled" : "outlined"}
                        />
                        {isRunActive(r.status) && (
                          <LinearProgress
                            sx={{ mt: 0.5, width: 90, height: 4, borderRadius: 1 }}
                            variant={r.totals?.total ? "determinate" : "indeterminate"}
                            value={
                              r.totals?.total
                                ? Math.round(((r.totals.processed ?? 0) / r.totals.total) * 100)
                                : 0
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell>{formatDate(r.started_at ?? r.created_at)}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {!!r.totals?.created && (
                            <Chip size="small" variant="outlined" color="success" label={`${r.totals.created} new`} />
                          )}
                          {!!r.totals?.updated && (
                            <Chip size="small" variant="outlined" color="info" label={`${r.totals.updated} changed`} />
                          )}
                          {!!r.totals?.applied && (
                            <Chip size="small" label={`${r.totals.applied} applied`} />
                          )}
                          {!!r.totals?.disappeared && (
                            <Chip
                              size="small"
                              variant="outlined"
                              color="warning"
                              label={`${r.totals.disappeared} delisted`}
                            />
                          )}
                          {!r.totals?.created && !r.totals?.updated && !r.totals?.disappeared && (
                            <Typography variant="caption" color="text.secondary">
                              no changes
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => navigate(`/data-sync/runs/${r.id}`)}>
                          {r.status === "awaiting_review" ? "Review" : "Details"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </>
        )}
      </Box>
    </RefineListView>
  );
}
