import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useForm } from "react-hook-form";
import { useCreate, useUpdate, useOne } from "@refinedev/core";
import { Alert, Box, Button, Grid2 as Grid, Paper, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import { RefineCreateView } from "@components/view/create";
import { AppBreadcrumbs } from "@components/breadcrumb/app.breadcrumb";
import { Text, Num, Select } from "@components/form/fields";
import type { University } from "@mocks/types";
import { axiosInstance } from "../../_service/axious";
import { BASE_URL } from "@common/options";

type Props = { mode: "create" | "edit" };

const COUNTRIES = ["AU", "NZ", "UK", "CA", "US"];

interface UniversityForm {
  name: string;
  country: string;
  city: string;
  world_rank: number;
  logo_hue: number;
  /** Ours, not the register's — which admission policy applies to this college. */
  policy_key: string;
  /** Register-owned, but editable because the scraper starts from it. */
  website: string;
  institution_type: string;
  student_capacity: number | null;
  address: string;
}

const emptyUniversity = (): UniversityForm => ({
  name: "",
  country: "AU",
  city: "",
  world_rank: 999,
  logo_hue: Math.floor(Math.random() * 360),
  policy_key: "",
  website: "",
  institution_type: "",
  student_capacity: null,
  address: "",
});

export function UniversityFormPage({ mode }: Props) {
  const navigate = useNavigate();
  const { id } = useParams();

  const { data: existing, isLoading } = useOne<University>({
    resource: "universities",
    id: id ?? "",
    queryOptions: { enabled: mode === "edit" && Boolean(id), retry: 0 },
  });

  const { control, handleSubmit, reset } = useForm<UniversityForm>({ defaultValues: emptyUniversity() });

  // Admission policies to choose from. Until now `policy_key` could only be set
  // by the hardcoded map in cricos-mapper.ts, so a college could not be linked to
  // a policy from the UI at all.
  const [policies, setPolicies] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    axiosInstance
      .get(`${BASE_URL}/admission/institutions`)
      .then(({ data }) =>
        setPolicies(
          (Array.isArray(data) ? data : []).map((p: any) => ({
            value: p.key,
            label: `${p.institution ?? p.key} (${p.key})`,
          })),
        ),
      )
      .catch(() => setPolicies([]));
  }, []);

  useEffect(() => {
    if (mode === "edit" && existing?.data) {
      const u = existing.data;
      reset({
        name: u.name,
        country: u.country,
        city: u.city,
        world_rank: u.world_rank,
        logo_hue: u.logo_hue,
        policy_key: u.policy_key ?? "",
        website: u.website ?? "",
        institution_type: u.institution_type ?? "",
        student_capacity: u.student_capacity ?? null,
        address: u.address ?? "",
      });
    }
  }, [existing, mode, reset]);

  const { mutateAsync: create, isLoading: creating } = useCreate();
  const { mutateAsync: update, isLoading: updating } = useUpdate();
  const busy = creating || updating;

  const onSubmit = async (values: UniversityForm) => {
    // Empty strings would overwrite real values with "", so unset fields are sent
    // as null instead.
    const payload = {
      ...values,
      policy_key: values.policy_key || null,
      website: values.website || null,
      institution_type: values.institution_type || null,
      address: values.address || null,
      student_capacity: values.student_capacity ?? null,
    };
    if (mode === "edit" && id) {
      await update({ resource: "universities", id, values: payload, successNotification: false });
      navigate(`/universities/${id}`);
    } else {
      const res = await create({ resource: "universities", values: payload, successNotification: false });
      const newId = (res as any)?.data?.id;
      navigate(newId ? `/universities/${newId}` : "/universities");
    }
  };

  if (mode === "edit" && isLoading) {
    return <Typography sx={{ p: 4 }}>Loading university…</Typography>;
  }

  return (
    <RefineCreateView
      title={mode === "edit" ? "Edit university" : "New university"}
      breadcrumb={
        <AppBreadcrumbs
          items={[{ label: "Universities", href: "/universities" }, { label: mode === "edit" ? "Edit" : "New university" }]}
        />
      }
      headerButtons={
        <Button startIcon={<CloseIcon />} onClick={() => navigate("/universities")}>
          Cancel
        </Button>
      }
      footerButtons={<></>}
      goBack={false}
    >
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ maxWidth: 700, mx: "auto", p: { xs: 1, sm: 2 } }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            University details
          </Typography>
          <Grid container spacing={2}>
            <Grid size={12}>
              <Text<UniversityForm> control={control} name="name" label="Name" required />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <Select<UniversityForm> control={control} name="country" label="Country" required options={COUNTRIES} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <Text<UniversityForm> control={control} name="city" label="City" required />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <Num<UniversityForm> control={control} name="world_rank" label="World rank" helper="Leave at 999 if unranked" />
            </Grid>
            <Grid size={{ xs: 6, sm: 6 }}>
              <Num<UniversityForm> control={control} name="logo_hue" label="Logo hue (0-360)" min={0} max={360} />
            </Grid>
          </Grid>
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            Admission policy
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
            Which institution briefing the eligibility checker should use for this college. One policy
            can serve several colleges — the Curtin/Griffith/Eynesbury briefing covers four.
          </Typography>
          <Select<UniversityForm>
            control={control}
            name="policy_key"
            label="Admission policy"
            helper="Leave blank if no briefing applies yet"
            options={[{ value: "", label: "— none —" }, ...policies]}
          />
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            Registry details
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            These come from the government CRICOS register, so a register sync will overwrite them.
            Correct them here only for a college the register does not cover, or to fix a website the
            requirement scraper cannot reach — for anything else, fix it at the source and re-sync.
          </Alert>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Text<UniversityForm> control={control} name="website" label="Website" helper="Where requirement sourcing starts" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Select<UniversityForm>
                control={control}
                name="institution_type"
                label="Provider type"
                options={[
                  { value: "", label: "— unknown —" },
                  { value: "Government", label: "Government" },
                  { value: "Private", label: "Private" },
                ]}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Num<UniversityForm> control={control} name="student_capacity" label="Student capacity" />
            </Grid>
            <Grid size={12}>
              <Text<UniversityForm> control={control} name="address" label="Registered address" />
            </Grid>
          </Grid>
          {mode === "edit" && existing?.data?.cricos_provider_code && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
              CRICOS provider code {existing.data.cricos_provider_code} — the register's identity for
              this college, and what keeps it to one row. Not editable here.
            </Typography>
          )}
        </Paper>

        {mode === "edit" && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
            Campuses and which courses each teaches are register-sourced and maintained by sync — see
            the Campuses and Courses sections on this college's page.
          </Typography>
        )}

        <Stack direction="row" justifyContent="flex-end" spacing={1}>
          <Button color="inherit" onClick={() => navigate("/universities")}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? "Saving…" : mode === "edit" ? "Save changes" : "Create university"}
          </Button>
        </Stack>
      </Box>
    </RefineCreateView>
  );
}
