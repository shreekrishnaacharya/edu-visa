import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { useForm } from "react-hook-form";
import { useCreate, useUpdate, useOne } from "@refinedev/core";
import { Box, Button, Grid2 as Grid, Paper, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import { RefineCreateView } from "@components/view/create";
import { AppBreadcrumbs } from "@components/breadcrumb/app.breadcrumb";
import { Text, Num, Select } from "@components/form/fields";
import type { University } from "@mocks/types";

type Props = { mode: "create" | "edit" };

const COUNTRIES = ["AU", "NZ", "UK", "CA", "US"];

interface UniversityForm {
  name: string;
  country: string;
  city: string;
  world_rank: number;
  logo_hue: number;
}

const emptyUniversity = (): UniversityForm => ({
  name: "",
  country: "AU",
  city: "",
  world_rank: 999,
  logo_hue: Math.floor(Math.random() * 360),
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

  useEffect(() => {
    if (mode === "edit" && existing?.data) {
      const u = existing.data;
      reset({ name: u.name, country: u.country, city: u.city, world_rank: u.world_rank, logo_hue: u.logo_hue });
    }
  }, [existing, mode, reset]);

  const { mutateAsync: create, isLoading: creating } = useCreate();
  const { mutateAsync: update, isLoading: updating } = useUpdate();
  const busy = creating || updating;

  const onSubmit = async (values: UniversityForm) => {
    const payload = values;
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
        {mode === "edit" && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
            Admission policy links itself automatically the first time an entry-requirements document is
            uploaded for this university — see the Documents section on its page.
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
