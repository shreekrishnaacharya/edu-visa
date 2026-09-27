import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Alert,
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
  Tooltip,
  Typography,
} from "@mui/material";
import SchoolIcon from "@mui/icons-material/School";

import { RefineListView } from "@components/view/list";
import {
  AdmissionPolicy,
  getPolicy,
  listPolicies,
  policyFilledSections,
  PolicySummary,
} from "./api";

/**
 * Index of every institution with a real admission policy on file.
 *
 * These are the rules the eligibility checker actually runs on. Until now they
 * had no readable surface at all — only a raw-JSON edit dialog behind a
 * super-admin button on the university page.
 */
export function AdmissionPolicyListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PolicySummary[]>([]);
  const [details, setDetails] = useState<Record<string, AdmissionPolicy>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await listPolicies();
        setRows(list);
        // Fetch each policy so the coverage column reflects what is really
        // filled in, rather than implying every policy is equally complete.
        const loaded = await Promise.all(
          list.map(async (p) => {
            try {
              return [p.key, await getPolicy(p.key)] as const;
            } catch {
              return [p.key, {} as AdmissionPolicy] as const;
            }
          }),
        );
        setDetails(Object.fromEntries(loaded));
      } catch (e: any) {
        setError(e?.response?.data?.message ?? e?.message ?? "Could not load admission policies");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const withScholarships = rows.filter((r) => {
    const d = details[r.key];
    return (d?.scholarships?.length ?? 0) > 0 || (d?.scholarship_tiers?.length ?? 0) > 0;
  }).length;

  return (
    <RefineListView title="Admission policies">
      <Box sx={{ p: { xs: 1, sm: 2 } }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading && <CircularProgress size={24} />}

        {!loading && !error && (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              These are real per-institution admission rules — academic and English bands, sponsor
              composition caps, income floors, bank exclusions, backlog and marriage rules — sourced
              from partner briefings and institution pages. The deterministic eligibility checker runs
              against exactly this data.
            </Alert>

            <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={`${rows.length} institutions with a policy`} />
              <Chip
                size="small"
                color={rows.every((r) => r.review_status === "reviewed") ? "success" : "warning"}
                variant="outlined"
                label={`${rows.filter((r) => r.review_status === "reviewed").length} human-reviewed`}
              />
              <Tooltip title="Scholarship terms are only recorded for these institutions. The rest of the catalogue has no scholarship data at all, which is why the matcher's scholarship score cannot differentiate courses.">
                <Chip
                  size="small"
                  color={withScholarships ? "default" : "warning"}
                  variant="outlined"
                  label={`${withScholarships} with scholarship terms`}
                />
              </Tooltip>
            </Stack>

            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Institution</TableCell>
                    <TableCell>Also covers</TableCell>
                    <TableCell>What the policy holds</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          No admission policies on file. Upload an entry-requirements document on a
                          university, or use AI curation to draft one.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((r) => {
                    const filled = policyFilledSections(details[r.key] ?? {} as AdmissionPolicy);
                    return (
                      <TableRow key={r.key} hover>
                        <TableCell>
                          <Typography variant="body2">{r.institution}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {r.key}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {r.also_covers?.length ? (
                            <Stack spacing={0.25}>
                              {r.also_covers.map((a) => (
                                <Typography key={a} variant="caption">
                                  {a}
                                </Typography>
                              ))}
                            </Stack>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              —
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {filled.length ? (
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                              {filled.map((f) => (
                                <Chip key={f} size="small" variant="outlined" label={f} />
                              ))}
                            </Stack>
                          ) : (
                            <Typography variant="caption" color="warning.main">
                              nothing filled in
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">{r.source || "—"}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={r.review_status === "reviewed" ? "success" : "warning"}
                            variant={r.review_status === "reviewed" ? "filled" : "outlined"}
                            label={r.review_status === "reviewed" ? "reviewed" : "AI-drafted"}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            startIcon={<SchoolIcon />}
                            onClick={() => navigate(`/admission/${r.key}`)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Paper>
          </>
        )}
      </Box>
    </RefineListView>
  );
}
