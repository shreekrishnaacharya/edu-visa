import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid2 as Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CodeIcon from "@mui/icons-material/Code";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { RefineShowView } from "@components/view/show";
import { AppBreadcrumbs } from "@components/breadcrumb/app.breadcrumb";
import {
  AdmissionPolicy,
  getPolicy,
  LEVEL_LABELS,
  savePolicy,
  SPONSOR_STATUS_COLOR,
} from "./api";

const has = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== "");
const num = (v: number | null | undefined) => (v === null || v === undefined ? "—" : String(v));

function Section({
  title,
  hint,
  children,
  empty,
}: {
  title: string;
  hint?: string;
  children?: ReactNode;
  empty?: string;
}) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, mb: 2 }}>
      <Typography variant="subtitle2">{title}</Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          {hint}
        </Typography>
      )}
      <Divider sx={{ my: 1.5 }} />
      {children ?? (
        <Typography variant="body2" color="text.secondary">
          {empty ?? "Not recorded for this institution."}
        </Typography>
      )}
    </Paper>
  );
}

const Bullets = ({ items }: { items?: string[] }) =>
  items?.length ? (
    <Stack component="ul" spacing={0.5} sx={{ pl: 2.5, m: 0 }}>
      {items.map((t, i) => (
        <Typography component="li" key={i} variant="body2">
          {t}
        </Typography>
      ))}
    </Stack>
  ) : null;

/**
 * Readable view of one institution's admission policy.
 *
 * Every field the server models gets a home here — including the financial and
 * applicant rules (sponsor caps, income floors, fund seasoning, bank exclusions,
 * backlog and marriage rules) that a counsellor needs before advising, and which
 * previously existed only as raw JSON behind an admin edit button.
 */
export function AdmissionPolicyShowPage() {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const [policy, setPolicy] = useState<(AdmissionPolicy & { review_status?: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);

  const load = async () => {
    if (!key) return;
    try {
      setPolicy(await getPolicy(key));
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Could not load this policy");
    }
  };

  useEffect(() => {
    void load();
  }, [key]);

  const p = policy;

  return (
    <RefineShowView
      title={p?.institution ?? "Admission policy"}
      breadcrumb={
        <AppBreadcrumbs
          items={[{ label: "Admission policies", href: "/admission" }, { label: p?.key ?? "" }]}
        />
      }
      headerButtons={
        <Stack direction="row" spacing={1}>
          <Button startIcon={<CodeIcon />} size="small" onClick={() => setShowJson(true)}>
            Raw data
          </Button>
          <Button startIcon={<ArrowBackIcon />} size="small" onClick={() => navigate("/admission")}>
            Back
          </Button>
        </Stack>
      }
    >
      <Box sx={{ p: { xs: 1, sm: 2 }, maxWidth: 1000 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {!p && !error && <CircularProgress size={24} />}

        {p && (
          <>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  color={p.review_status === "reviewed" ? "success" : "warning"}
                  variant={p.review_status === "reviewed" ? "filled" : "outlined"}
                  label={p.review_status === "reviewed" ? "human-reviewed" : "AI-drafted, unreviewed"}
                />
                {p.scope && <Chip size="small" variant="outlined" label={`scope: ${p.scope}`} />}
                {p.source && <Chip size="small" variant="outlined" label={`source: ${p.source}`} />}
                {p.effective_date && (
                  <Chip size="small" variant="outlined" label={`effective ${p.effective_date}`} />
                )}
              </Stack>
              {p.also_covers?.length ? (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                  This briefing also covers: {p.also_covers.join(", ")}
                </Typography>
              ) : null}
            </Paper>

            {/* ---------------------------------------- academic + English ---- */}
            <Section
              title="Academic & English entry bands"
              hint="Scores are normalised to the same 0-100 canonical GPA scale the matcher compares a student's transcript against. The source wording is kept so it can be quoted verbatim."
            >
              {has(p.academics) ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Level</TableCell>
                      <TableCell>Applies to</TableCell>
                      <TableCell align="right">Min score</TableCell>
                      <TableCell align="right">IELTS</TableCell>
                      <TableCell align="right">PTE</TableCell>
                      <TableCell>As the source states it</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {p.academics!.map((b, i) => (
                      <TableRow key={i} hover>
                        <TableCell>
                          <Tooltip title={LEVEL_LABELS[b.level] ?? b.level}>
                            <Chip size="small" variant="outlined" label={b.level} />
                          </Tooltip>
                        </TableCell>
                        <TableCell>{b.label || "General"}</TableCell>
                        <TableCell align="right">{num(b.min_canonical_score)}</TableCell>
                        <TableCell align="right">
                          {num(b.min_ielts_overall)}
                          {b.min_ielts_band != null && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              no band &lt; {b.min_ielts_band}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {num(b.min_pte_overall)}
                          {b.min_pte_band != null && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              no band &lt; {b.min_pte_band}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 260 }}>
                          <Typography variant="caption">{b.source_expression || "—"}</Typography>
                          <Bullets items={b.notes} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : undefined}
            </Section>

            {/* ------------------------------------------------ scholarships -- */}
            <Section
              title="Scholarships"
              hint="What this institution offers, as its briefing states it."
              empty="No scholarship terms recorded for this institution."
            >
              {has(p.scholarships) || has(p.scholarship_tiers) ? (
                <>
                  <Bullets items={p.scholarships} />
                  {has(p.scholarship_tiers) && (
                    <Table size="small" sx={{ mt: has(p.scholarships) ? 2 : 0 }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Level</TableCell>
                          <TableCell>Band</TableCell>
                          <TableCell align="right">From score</TableCell>
                          <TableCell align="right">Award</TableCell>
                          <TableCell>Note</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {p.scholarship_tiers!.map((t, i) => (
                          <TableRow key={i} hover>
                            <TableCell>
                              <Chip size="small" variant="outlined" label={t.level} />
                            </TableCell>
                            <TableCell>{t.label}</TableCell>
                            <TableCell align="right">{t.min_canonical_score}</TableCell>
                            <TableCell align="right">{t.pct}% of tuition</TableCell>
                            <TableCell>
                              <Typography variant="caption">{t.note ?? "—"}</Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  {has(p.scholarships) && !has(p.scholarship_tiers) && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      These terms are recorded as text only. The matcher's scholarship score can only
                      use structured tiers (level + score cutoff + percentage), so these do not yet
                      affect any course's scholarship rating — they are for the counsellor to read.
                    </Alert>
                  )}
                </>
              ) : undefined}
            </Section>

            {/* --------------------------------------------------- financial -- */}
            <Section
              title="Financial requirements"
              hint="Who may sponsor, how much income is required, and which funds are not accepted."
            >
              {has(p.sponsors) ||
              has(p.income_thresholds) ||
              has(p.excluded_banks) ||
              has(p.income_source_notes) ||
              has(p.fund_seasoning_months) ||
              has(p.max_sponsors) ? (
                <Stack spacing={2}>
                  {has(p.sponsors) && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Accepted sponsors
                        {p.max_sponsors ? ` — at most ${p.max_sponsors}` : ""}
                      </Typography>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Relation</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">Min share</TableCell>
                            <TableCell align="right">Max share</TableCell>
                            <TableCell>Note</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {p.sponsors!.map((s, i) => (
                            <TableRow key={i} hover>
                              <TableCell>{s.relation}</TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  color={SPONSOR_STATUS_COLOR[s.status] ?? "default"}
                                  variant="outlined"
                                  label={s.status.replace(/_/g, " ")}
                                />
                              </TableCell>
                              <TableCell align="right">
                                {s.min_percent != null ? `${s.min_percent}%` : "—"}
                              </TableCell>
                              <TableCell align="right">
                                {s.max_percent != null ? `${s.max_percent}%` : "—"}
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption">{s.note ?? "—"}</Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  )}

                  {has(p.income_thresholds) && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Minimum annual family income, by situation
                      </Typography>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Scenario</TableCell>
                            <TableCell align="right">NPR (lakh)</TableCell>
                            <TableCell align="right">AUD</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {p.income_thresholds!.map((t, i) => (
                            <TableRow key={i} hover>
                              <TableCell>{t.scenario}</TableCell>
                              <TableCell align="right">{num(t.min_annual_npr_lakh)}</TableCell>
                              <TableCell align="right">
                                {t.min_annual_aud != null ? t.min_annual_aud.toLocaleString() : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  )}

                  <Grid container spacing={2}>
                    {has(p.fund_seasoning_months) && (
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          Fund seasoning
                        </Typography>
                        <Typography variant="body2">
                          Funds must be held for {p.fund_seasoning_months} months
                        </Typography>
                      </Grid>
                    )}
                    {has(p.excluded_banks) && (
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          Banks not accepted
                        </Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                          {p.excluded_banks!.map((b) => (
                            <Chip key={b} size="small" color="error" variant="outlined" label={b} />
                          ))}
                        </Stack>
                      </Grid>
                    )}
                  </Grid>

                  {has(p.income_source_notes) && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Accepted income sources
                      </Typography>
                      <Bullets items={p.income_source_notes} />
                    </Box>
                  )}
                </Stack>
              ) : undefined}
            </Section>

            {/* --------------------------------------------- applicant rules -- */}
            <Section
              title="Applicant rules"
              hint="Hard rules the eligibility checker applies, plus the narrative ones a counsellor must weigh."
            >
              {has(p.age_limit) ||
              has(p.backlog_limit) ||
              has(p.max_backlogs) ||
              has(p.study_gap_rules) ||
              has(p.max_study_gap_months) ||
              has(p.marriage_rules) ||
              has(p.spouse_qualification_rule) ||
              has(p.double_masters_policy) ||
              has(p.visa_refusal_policy) ? (
                <Stack spacing={1.5}>
                  {has(p.age_limit) && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Age limits
                      </Typography>
                      <Typography variant="body2">
                        {[
                          p.age_limit!.ug_max && `UG up to ${p.age_limit!.ug_max}`,
                          p.age_limit!.pg_max && `PG up to ${p.age_limit!.pg_max}`,
                          p.age_limit!.research_max_low &&
                            `research ${p.age_limit!.research_max_low}-${p.age_limit!.research_max_high ?? "?"}`,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </Typography>
                      {p.age_limit!.note && (
                        <Typography variant="caption" color="text.secondary">
                          {p.age_limit!.note}
                        </Typography>
                      )}
                    </Box>
                  )}

                  {(has(p.backlog_limit) || has(p.max_backlogs)) && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Backlogs
                      </Typography>
                      {p.max_backlogs?.map((m, i) => (
                        <Typography key={i} variant="body2">
                          {m.level}: at most {m.count}
                          {m.note ? ` — ${m.note}` : ""}
                        </Typography>
                      ))}
                      <Bullets items={p.backlog_limit} />
                    </Box>
                  )}

                  {(has(p.study_gap_rules) || has(p.max_study_gap_months)) && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Study gap
                      </Typography>
                      {p.max_study_gap_months?.map((m, i) => (
                        <Typography key={i} variant="body2">
                          {m.level}: up to {m.months} months
                          {m.note ? ` — ${m.note}` : ""}
                        </Typography>
                      ))}
                      <Bullets items={p.study_gap_rules} />
                    </Box>
                  )}

                  {(has(p.marriage_rules) || has(p.min_marriage_months) || has(p.spouse_qualification_rule)) && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Marriage & spouse
                      </Typography>
                      {p.min_marriage_months != null && (
                        <Typography variant="body2">
                          Marriage must be at least {p.min_marriage_months} months old
                        </Typography>
                      )}
                      {p.spouse_qualification_rule && (
                        <Typography variant="body2">
                          {p.spouse_qualification_rule.required_equal
                            ? "Spouse must hold an equal qualification"
                            : "Spouse is not required to hold an equal qualification"}
                          {p.spouse_qualification_rule.min_level
                            ? ` (minimum ${p.spouse_qualification_rule.min_level})`
                            : ""}
                          {p.spouse_qualification_rule.note ? ` — ${p.spouse_qualification_rule.note}` : ""}
                        </Typography>
                      )}
                      <Bullets items={p.marriage_rules} />
                    </Box>
                  )}

                  {has(p.double_masters_policy) && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Double Master's
                      </Typography>
                      <Typography variant="body2">{p.double_masters_policy}</Typography>
                    </Box>
                  )}

                  {has(p.visa_refusal_policy) && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Previous visa refusal
                      </Typography>
                      <Typography variant="body2">{p.visa_refusal_policy}</Typography>
                    </Box>
                  )}
                </Stack>
              ) : undefined}
            </Section>

            {/* --------------------------------------- GS / regions / notes --- */}
            <Section
              title="Genuine Student (GS) & region rules"
              hint="Narrative guidance only — never evaluated as a pass/fail check."
            >
              {has(p.gs_notes) || has(p.excluded_regions) || has(p.country_tier_notes) ? (
                <Stack spacing={1.5}>
                  {has(p.excluded_regions) && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Regions not accepted
                      </Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                        {p.excluded_regions!.map((r) => (
                          <Chip key={r} size="small" color="error" variant="outlined" label={r} />
                        ))}
                      </Stack>
                    </Box>
                  )}
                  {has(p.gs_notes) && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        GS assessment notes
                      </Typography>
                      <Bullets items={p.gs_notes} />
                    </Box>
                  )}
                  {has(p.country_tier_notes) && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Country-tier rules
                      </Typography>
                      <Bullets items={p.country_tier_notes} />
                    </Box>
                  )}
                </Stack>
              ) : undefined}
            </Section>

            {/* ------------------------------------------- process / admin ---- */}
            <Section
              title="Application process"
              hint="Documents to collect, campus availability, turnaround and who to contact."
            >
              {has(p.document_checklist) ||
              has(p.campus_programs) ||
              has(p.processing_turnaround) ||
              has(p.contact_emails) ? (
                <Stack spacing={2}>
                  {has(p.document_checklist) && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Document checklist
                      </Typography>
                      <Bullets items={p.document_checklist} />
                    </Box>
                  )}
                  {has(p.campus_programs) && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Programs by campus
                      </Typography>
                      {p.campus_programs!.map((c, i) => (
                        <Typography key={i} variant="body2">
                          <b>{c.campus}</b>: {c.programs.join(", ")}
                        </Typography>
                      ))}
                    </Box>
                  )}
                  {has(p.processing_turnaround) && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Indicative turnaround
                      </Typography>
                      <Typography variant="body2">
                        {[
                          p.processing_turnaround!.offer && `offer ${p.processing_turnaround!.offer}`,
                          p.processing_turnaround!.gs && `GS ${p.processing_turnaround!.gs}`,
                          p.processing_turnaround!.coe && `CoE ${p.processing_turnaround!.coe}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Typography>
                      {p.processing_turnaround!.note && (
                        <Typography variant="caption" color="text.secondary">
                          {p.processing_turnaround!.note}
                        </Typography>
                      )}
                    </Box>
                  )}
                  {has(p.contact_emails) && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Contacts
                      </Typography>
                      {p.contact_emails!.map((c, i) => (
                        <Typography key={i} variant="body2">
                          {c.label}: {c.email}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Stack>
              ) : undefined}
            </Section>

            {has(p.other_notes) && (
              <Section title="Other notes from the source">
                <Bullets items={p.other_notes} />
              </Section>
            )}
          </>
        )}

        {showJson && p && (
          <RawPolicyDialog
            policyKey={p.key}
            onClose={() => setShowJson(false)}
            onSaved={() => {
              setShowJson(false);
              void load();
            }}
          />
        )}
      </Box>
    </RefineShowView>
  );
}

/**
 * The pre-existing raw-JSON editor, kept as an escape hatch: the readable view
 * above is for reading, but a correction still has to be possible on any field,
 * including ones no section renders yet.
 */
function RawPolicyDialog({
  policyKey,
  onClose,
  onSaved,
}: {
  policyKey: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    getPolicy(policyKey).then((d) => {
      const { review_status, ...rest } = d as unknown as Record<string, unknown>;
      setText(JSON.stringify(rest, null, 2));
      setLoading(false);
    });
  }, [policyKey]);

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await savePolicy(policyKey, JSON.parse(text));
      onSaved();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || "Save failed — check the JSON is valid");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Raw policy data — {policyKey}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
          Exactly what the eligibility checker reads. Editing here and saving marks the policy as
          reviewed.
        </Typography>
        {err && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {err}
          </Alert>
        )}
        {loading ? (
          <CircularProgress size={22} />
        ) : (
          <TextField
            multiline
            fullWidth
            minRows={18}
            value={text}
            onChange={(e) => setText(e.target.value)}
            size="small"
            sx={{ "& textarea": { fontFamily: "monospace", fontSize: 12 } }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" disabled={busy || loading} onClick={submit}>
          Save & mark reviewed
        </Button>
      </DialogActions>
    </Dialog>
  );
}
