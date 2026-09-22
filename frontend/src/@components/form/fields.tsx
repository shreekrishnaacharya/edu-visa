import { ReactNode } from "react";
import { Controller, type Control, type FieldValues } from "react-hook-form";
import {
  Box,
  Checkbox,
  Chip,
  FormControlLabel,
  InputAdornment,
  ListItemText,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

// ---------------------------------------------------------------------------
// Clean form primitives shared across every react-hook-form-driven form in
// the app (originally the student intake wizard's own field.tsx — moved here
// and genericized over the form's own value type so the catalogue/university
// forms can reuse the same styling/error-handling instead of duplicating it).
// Generic (not `Control<any>`) because react-hook-form's `Control<T>` is
// contravariant in its `validate` function — `Control<any>` isn't actually
// assignable from a caller's `Control<SpecificForm>`, so each component
// infers its own `T` per call site instead. Plain MUI + react-hook-form — no
// clear-button adornment, consistent small size, labels that use the
// outlined notch (no truncation), tidy error text.
// ---------------------------------------------------------------------------

type Base<T extends FieldValues = FieldValues> = {
  control: Control<T>;
  name: string;
  label: string;
  required?: boolean;
  helper?: string;
  disabled?: boolean;
};

const errAt = (errors: any, name: string) =>
  name.split(/[.[\]]+/).filter(Boolean).reduce((o, k) => (o == null ? o : o[k]), errors);

export function Text<T extends FieldValues = FieldValues>({
  control,
  name,
  label,
  required,
  helper,
  disabled,
  multiline,
  type = "text",
}: Base<T> & { multiline?: number; type?: string }) {
  return (
    <Controller
      control={control}
      name={name as any}
      rules={required ? { required: `${label} is required` } : undefined}
      render={({ field, formState: { errors } }) => {
        const e = errAt(errors, name);
        return (
          <TextField
            {...field}
            value={field.value ?? ""}
            fullWidth
            size="small"
            type={type}
            label={label}
            required={required}
            disabled={disabled}
            multiline={Boolean(multiline)}
            minRows={multiline}
            error={Boolean(e)}
            helperText={e?.message || helper || " "}
            InputLabelProps={type === "date" ? { shrink: true } : undefined}
          />
        );
      }}
    />
  );
}

export function Num<T extends FieldValues = FieldValues>({
  control,
  name,
  label,
  required,
  helper,
  disabled,
  min,
  max,
  step,
  adornment,
}: Base<T> & { min?: number; max?: number; step?: number; adornment?: string }) {
  return (
    <Controller
      control={control}
      name={name as any}
      rules={{
        ...(required ? { required: `${label} is required` } : {}),
        ...(min != null ? { min: { value: min, message: `Min ${min}` } } : {}),
        ...(max != null ? { max: { value: max, message: `Max ${max}` } } : {}),
      }}
      render={({ field, formState: { errors } }) => {
        const e = errAt(errors, name);
        return (
          <TextField
            {...field}
            value={field.value ?? ""}
            onChange={(ev) => field.onChange(ev.target.value === "" ? "" : Number(ev.target.value))}
            fullWidth
            size="small"
            type="number"
            label={label}
            required={required}
            disabled={disabled}
            error={Boolean(e)}
            helperText={e?.message || helper || " "}
            inputProps={{ min, max, step, inputMode: "decimal" }}
            InputProps={
              adornment ? { startAdornment: <InputAdornment position="start">{adornment}</InputAdornment> } : undefined
            }
          />
        );
      }}
    />
  );
}

export function Select<T extends FieldValues = FieldValues>({
  control,
  name,
  label,
  required,
  helper,
  disabled,
  options,
}: Base<T> & { options: (string | { value: string; label: string })[] }) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <Controller
      control={control}
      name={name as any}
      rules={required ? { required: `${label} is required` } : undefined}
      render={({ field, formState: { errors } }) => {
        const e = errAt(errors, name);
        return (
          <TextField
            {...field}
            value={field.value ?? ""}
            select
            fullWidth
            size="small"
            label={label}
            required={required}
            disabled={disabled}
            error={Boolean(e)}
            helperText={e?.message || helper || " "}
          >
            {opts.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        );
      }}
    />
  );
}

export function MultiSelect<T extends FieldValues = FieldValues>({
  control,
  name,
  label,
  required,
  helper,
  disabled,
  options,
}: Base<T> & { options: string[] }) {
  return (
    <Controller
      control={control}
      name={name as any}
      rules={(required ? { validate: (v: any) => (Array.isArray(v) && v.length > 0) || `${label} is required` } : undefined) as any}
      render={({ field, formState: { errors } }) => {
        const e = errAt(errors, name);
        const value: string[] = (Array.isArray(field.value) ? field.value : []) as string[];
        return (
          <TextField
            {...field}
            value={value}
            select
            fullWidth
            size="small"
            label={label}
            required={required}
            disabled={disabled}
            error={Boolean(e)}
            helperText={e?.message || helper || " "}
            SelectProps={{
              multiple: true,
              renderValue: (sel) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {(sel as string[]).map((v) => (
                    <Chip key={v} label={v} size="small" />
                  ))}
                </Box>
              ),
            }}
          >
            {options.map((o) => (
              <MenuItem key={o} value={o}>
                <Checkbox size="small" checked={value.includes(o)} sx={{ py: 0.25 }} />
                <ListItemText primary={o} />
              </MenuItem>
            ))}
          </TextField>
        );
      }}
    />
  );
}

export function Toggle<T extends FieldValues = FieldValues>({ control, name, label, disabled }: Base<T>) {
  return (
    <Controller
      control={control}
      name={name as any}
      render={({ field }) => (
        <FormControlLabel
          sx={{ mt: 0.5 }}
          control={
            <Switch
              size="small"
              checked={Boolean(field.value)}
              onChange={(e) => field.onChange(e.target.checked)}
              disabled={disabled}
            />
          }
          label={<Typography variant="body2">{label}</Typography>}
        />
      )}
    />
  );
}

export function DateField<T extends FieldValues = FieldValues>(p: Base<T>) {
  return <Text {...p} type="date" />;
}

export function StepIntro({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 640 }}>
      {children}
    </Typography>
  );
}
