import { useState } from "react";
import { useNavigate } from "react-router";
import { Alert, Box, Button, Chip, Paper, Stack, TextField, Typography } from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CloseIcon from "@mui/icons-material/Close";

import { RefineCreateView } from "@components/view/create";
import { AppBreadcrumbs } from "@components/breadcrumb/app.breadcrumb";
import { axiosInstance } from "../../_service/axious";
import { BASE_URL } from "@common/options";

interface ImportRowError {
  row: number;
  message: string;
}

interface ImportResult {
  dry_run: boolean;
  total_rows: number;
  valid_rows: number;
  imported: number;
  errors: ImportRowError[];
}

/**
 * CSV bulk course importer — talks directly to POST /courses/import
 * (server/src/modules/course/course-import.controller.ts), which takes the
 * raw CSV text in the body (not a real multipart file), so this reads the
 * picked file to text client-side rather than uploading it.
 */
export function CourseImportPage() {
  const navigate = useNavigate();
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<ImportResult | null>(null);

  const pickFile = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setFileName(f.name);
    setCsv(await f.text());
    setPreview(null);
    setDone(null);
  };

  const runImport = async (dryRun: boolean) => {
    setRunning(true);
    try {
      const { data } = await axiosInstance.post<ImportResult>(`${BASE_URL}/courses/import?dryRun=${dryRun}`, { csv });
      if (dryRun) setPreview(data);
      else setDone(data);
    } finally {
      setRunning(false);
    }
  };

  return (
    <RefineCreateView
      title="Import courses (CSV)"
      breadcrumb={<AppBreadcrumbs items={[{ label: "Course catalogue", href: "/catalogue" }, { label: "Import" }]} />}
      headerButtons={
        <Button startIcon={<CloseIcon />} onClick={() => navigate("/catalogue")}>
          Cancel
        </Button>
      }
      footerButtons={<></>}
      goBack={false}
    >
      <Box sx={{ maxWidth: 800, mx: "auto", p: { xs: 1, sm: 2 } }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            CRICOS-style columns: university_name, country, city, title, degree_level, field,
            duration_months, tuition_fee, currency, intakes (pipe-separated), next_intake_date,
            application_deadline, min_gpa, min_english_band, prerequisites (pipe-separated),
            career_outcomes (pipe-separated), cricos. The university must already exist by exact
            name match.
          </Typography>
          <Button component="label" startIcon={<UploadFileIcon />} variant="outlined">
            {fileName || "Choose CSV file"}
            <input type="file" accept=".csv,text/csv" hidden onChange={(e) => pickFile(e.target.files)} />
          </Button>
          <TextField
            multiline
            fullWidth
            minRows={6}
            maxRows={16}
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setPreview(null);
              setDone(null);
            }}
            placeholder="Or paste CSV text directly here"
            sx={{ mt: 2 }}
            size="small"
          />
        </Paper>

        {preview && (
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Dry-run preview
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
              <Chip size="small" label={`${preview.total_rows} rows`} />
              <Chip size="small" color="success" variant="outlined" label={`${preview.valid_rows} valid`} />
              {preview.errors.length > 0 && (
                <Chip size="small" color="error" variant="outlined" label={`${preview.errors.length} errors`} />
              )}
            </Stack>
            {preview.errors.length > 0 ? (
              <>
                <Stack spacing={0.5} sx={{ mb: 1 }}>
                  {preview.errors.map((e, i) => (
                    <Alert key={i} severity="error" sx={{ py: 0 }}>
                      Row {e.row}: {e.message}
                    </Alert>
                  ))}
                </Stack>
                {preview.valid_rows > 0 && (
                  <Alert severity="warning">
                    Confirming will import the {preview.valid_rows} valid row{preview.valid_rows === 1 ? "" : "s"} and
                    skip the rows above — nothing is partially written.
                  </Alert>
                )}
              </>
            ) : (
              <Alert severity="success">All rows valid — ready to import.</Alert>
            )}
          </Paper>
        )}

        {done && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Imported {done.imported} course{done.imported === 1 ? "" : "s"}.
          </Alert>
        )}

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button color="inherit" onClick={() => navigate("/catalogue")}>
            {done ? "Back to catalogue" : "Cancel"}
          </Button>
          {!done && (
            <>
              <Button variant="outlined" disabled={!csv || running} onClick={() => runImport(true)}>
                Preview (dry run)
              </Button>
              <Button
                variant="contained"
                disabled={!csv || running || !preview || preview.valid_rows === 0}
                onClick={() => runImport(false)}
              >
                Confirm import
              </Button>
            </>
          )}
        </Stack>
      </Box>
    </RefineCreateView>
  );
}
