import React from "react";
import { FormHelperText } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import dayjs from "dayjs";

import type { IUCSTime } from "../types";

function getLabel(label?: string, required?: boolean) {
  if (!label) return undefined;
  return required ? `${label} *` : label;
}

export const UCSTime: React.FC<IUCSTime> = ({
  value,
  onChange,
  fullWidth,
  label,
  format,
  disabled,
  required,
  size = "small",
  ampm = true,
  error,
  inputRef,
}) => (
  <LocalizationProvider dateAdapter={AdapterDayjs}>
    <DemoContainer components={["TimePicker"]}>
      <TimePicker
        disabled={disabled}
        inputRef={inputRef}
        value={value ? dayjs(value) : null}
        onChange={(e) => onChange(e?.toISOString() ?? "")}
        format={format ?? "hh:mm A"}
        ampm={ampm}
        label={getLabel(label, required)}
        slotProps={{
          field: {
            clearable: true,
            onClear: () => onChange(""),
          },
          textField: {
            size: size ?? "small",
            error: !!error,
            helperText: error
              ? typeof error === "string"
                ? error
                : error?.message
              : undefined,
            sx: { minWidth: "auto !important", width: "100%" },
          },
        }}
      />
    </DemoContainer>
  </LocalizationProvider>
);
