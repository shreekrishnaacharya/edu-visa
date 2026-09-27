import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { RefineListView } from "@components/view/list";
import { AppBreadcrumbs } from "@components/breadcrumb/app.breadcrumb";
import { formatDate, getRun, isRunActive, SyncRun } from "./api";

/**
 * Read-only view of a single run: progress, totals and the full log. The audit
 * record for auto-applied changes, which nobody saw before they were written.
 */
export function SyncRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<SyncRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let live = true;
    const load = async () => {
      try {
        const r = await getRun(id);
        if (live) setRun(r);
        return r;
      } catch (e: any) {
        if (live) setError(e?.response?.data?.message ?? e?.message ?? "Could not load the run");
        return null;
      }
    };
    void load();
    const t = setInterval(async () => {
      const r = await load();
      if (r && !isRunActive(r.status)) clearInterval(t);
    }, 3000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [id]);

  const t = run?.totals;

  return (
    <RefineListView
      title="Sync run"
      breadcrumb={
        <AppBreadcrumbs items={[{ label: "Data sync", href: "/data-sync" }, { label: "Run" }]} />
      }
      headerButtons={
        run?.status === "awaiting_review" ? (
          <Button variant="contained" onClick={() => navigate("/data-sync/cricos")}>
            Review changes
          </Button>
        ) : (
          <Button onClick={() => navigate("/data-sync")}>Back</Button>
        )
      }
    >
      <Box sx={{ p: { xs: 1, sm: 2 }, maxWidth: 900 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {!run && !error && <CircularProgress size={24} />}

        {run && (
          <Stack spacing={2}>
            {run.status === "awaiting_review" && (
              <Alert severity="warning">
                This run has staged changes waiting on a decision. Nothing has been written for them
                yet.
              </Alert>
            )}
            {run.status === "failed" && <Alert severity="error">{run.error}</Alert>}

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
                <Chip size="small" label={run.kind.replace(/_/g, " ")} />
                <Chip size="small" color="primary" variant="outlined" label={run.status.replace(/_/g, " ")} />
                <Chip size="small" variant="outlined" label={`started ${formatDate(run.started_at ?? run.created_at)}`} />
                {run.finished_at && (
                  <Chip size="small" variant="outlined" label={`finished ${formatDate(run.finished_at)}`} />
                )}
              </Stack>

              {isRunActive(run.status) && (
                <LinearProgress
                  sx={{ mb: 1.5, height: 8, borderRadius: 1 }}
                  variant={t?.total ? "determinate" : "indeterminate"}
                  value={t?.total ? Math.round(((t.processed ?? 0) / t.total) * 100) : 0}
                />
              )}

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {(
                  [
                    ["compared", t?.processed],
                    ["new", t?.created],
                    ["changed", t?.updated],
                    ["unchanged", t?.unchanged],
                    ["delisted", t?.disappeared],
                    ["auto-applied", t?.auto_applied],
                    ["applied", t?.applied],
                    ["failed", t?.failed],
                  ] as const
                )
                  .filter(([, v]) => typeof v === "number")
                  .map(([label, v]) => (
                    <Chip key={label} size="small" variant="outlined" label={`${label}: ${v!.toLocaleString()}`} />
                  ))}
              </Stack>

              {run.source_meta?.courses?.last_modified && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="caption" color="text.secondary">
                    Source file published upstream {formatDate(run.source_meta.courses.last_modified)}
                  </Typography>
                </>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Log
              </Typography>
              <Stack spacing={0.5}>
                {run.log.length === 0 && (
                  <Typography variant="caption" color="text.secondary">
                    No log entries yet.
                  </Typography>
                )}
                {run.log.map((l, i) => (
                  <Typography
                    key={i}
                    variant="caption"
                    sx={{ fontFamily: "monospace" }}
                    color={
                      l.level === "error" ? "error.main" : l.level === "warn" ? "warning.main" : "text.secondary"
                    }
                  >
                    {new Date(l.at).toLocaleTimeString()} {l.message}
                  </Typography>
                ))}
              </Stack>
            </Paper>
          </Stack>
        )}
      </Box>
    </RefineListView>
  );
}
