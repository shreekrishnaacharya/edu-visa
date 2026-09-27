import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";

import { RefineListView } from "@components/view/list";
import { AppBreadcrumbs } from "@components/breadcrumb/app.breadcrumb";
import { axiosInstance } from "../../_service/axious";
import { BASE_URL } from "@common/options";
import {
  createCurationSession,
  CurationSession,
  EntityType,
  formatDate,
  listCurationSessions,
} from "./api";

/**
 * The list endpoints are paginated by `@sksharma72000/nestjs-search-page`, which
 * wraps rows in `elements` — not `data`, and not a bare array. Reading the wrong
 * key silently yields an empty picker rather than an error.
 */
function rowsOf(data: any): any[] {
  if (Array.isArray(data)) return data;
  return data?.elements ?? data?.data ?? [];
}

interface Option {
  id: string;
  label: string;
  sub?: string;
}

/**
 * Starts a curation session against a specific record, and lists sessions
 * already in progress.
 *
 * Bound to a record on purpose: the assistant is shown that record's current
 * stored values so it proposes a diff against them, rather than being asked to
 * invent a row from scratch.
 */
export function CurationStartPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [kind, setKind] = useState<EntityType>("course");
  const [options, setOptions] = useState<Option[]>([]);
  const [picked, setPicked] = useState<Option | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<CurationSession[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCurationSessions().then(setSessions).catch(() => setSessions([]));
  }, []);

  // Deep-link support: /data-sync/curation?entity_type=course&entity_id=...
  useEffect(() => {
    const et = params.get("entity_type") as EntityType | null;
    const eid = params.get("entity_id");
    if (et && eid) void start(et, eid);
  }, []);

  useEffect(() => {
    let live = true;
    const run = async () => {
      setLoading(true);
      try {
        if (kind === "course") {
          const { data } = await axiosInstance.get(`${BASE_URL}/courses`, {
            params: { _start: 0, _end: 25, title_like: search || undefined },
          });
          const rows = rowsOf(data);
          if (live)
            setOptions(
              rows.map((c: any) => ({
                id: c.id,
                label: c.title,
                sub: `${c.university_name} · ${c.degree_level}`,
              })),
            );
        } else if (kind === "university") {
          const { data } = await axiosInstance.get(`${BASE_URL}/universities`, {
            params: { _start: 0, _end: 25, name_like: search || undefined },
          });
          const rows = rowsOf(data);
          if (live)
            setOptions(rows.map((u: any) => ({ id: u.id, label: u.name, sub: u.city })));
        } else {
          const { data } = await axiosInstance.get(`${BASE_URL}/admission/institutions`);
          const rows = rowsOf(data);
          if (live)
            setOptions(
              rows.map((p: any) => ({
                id: p.key,
                label: p.institution ?? p.key,
                sub: p.review_status,
              })),
            );
        }
      } catch {
        if (live) setOptions([]);
      } finally {
        if (live) setLoading(false);
      }
    };
    void run();
    return () => {
      live = false;
    };
  }, [kind, search]);

  const start = async (entity_type: EntityType, entity_id: string) => {
    setError(null);
    try {
      const session = await createCurationSession({ entity_type, entity_id });
      navigate(`/data-sync/curation/${session.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Could not start a session");
    }
  };

  return (
    <RefineListView
      title="AI data curation"
      breadcrumb={
        <AppBreadcrumbs
          items={[{ label: "Data sync", href: "/data-sync" }, { label: "Curation" }]}
        />
      }
    >
      <Box sx={{ p: { xs: 1, sm: 2 }, maxWidth: 940 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Alert severity="info" sx={{ mb: 2 }}>
          Give the assistant a URL, a document or an instruction and it proposes changes to a
          record, quoting the material for each one. Use this where automated sourcing can't reach —
          sites that block crawlers, or figures that only exist in a PDF a partner sent you.
        </Alert>

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            What are you curating?
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={kind}
            onChange={(_, v) => {
              if (!v) return;
              setKind(v);
              setPicked(null);
              setOptions([]);
            }}
            sx={{ mb: 2 }}
          >
            <ToggleButton value="course">A course</ToggleButton>
            <ToggleButton value="university">An institution</ToggleButton>
            <ToggleButton value="admission_policy">An admission policy</ToggleButton>
          </ToggleButtonGroup>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Autocomplete
              sx={{ flex: 1 }}
              size="small"
              options={options}
              loading={loading}
              value={picked}
              onChange={(_, v) => setPicked(v)}
              onInputChange={(_, v) => setSearch(v)}
              getOptionLabel={(o) => o.label}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderOption={(props, o) => (
                <li {...props} key={o.id}>
                  <Box>
                    <Typography variant="body2">{o.label}</Typography>
                    {o.sub && (
                      <Typography variant="caption" color="text.secondary">
                        {o.sub}
                      </Typography>
                    )}
                  </Box>
                </li>
              )}
              renderInput={(p) => (
                <TextField
                  {...p}
                  label="Search for the record"
                  InputProps={{
                    ...p.InputProps,
                    endAdornment: (
                      <>
                        {loading && <CircularProgress size={16} />}
                        {p.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
            <Button
              variant="contained"
              startIcon={<ChatIcon />}
              disabled={!picked}
              onClick={() => picked && start(kind, picked.id)}
            >
              Start
            </Button>
          </Stack>
        </Paper>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Sessions in progress
        </Typography>
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Record</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Last activity</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No curation sessions yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {sessions.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.title || "(untitled)"}</TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={s.entity_type ?? "unbound"} />
                  </TableCell>
                  <TableCell>{formatDate(s.updated_at)}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => navigate(`/data-sync/curation/${s.id}`)}>
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </Box>
    </RefineListView>
  );
}
