import React from "react";
import {
  Box,
  Button,
  TextField,
  FormControl,
  FormHelperText,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import dayjs, { Dayjs } from "dayjs";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";

import { BSDateRangePopup } from "./BSDateRangePopup";
import { adStrToBsStr, bsToAD } from "../utils/bsCalendar";
import type { IUCSDateRangePicker, OutputValueFormat } from "../types";
import { getUserDateTypeSetting } from "../utils/resolver";

function getLabel(label?: string, required?: boolean) {
  if (!label) return undefined;
  return required ? `${label} *` : label;
}

function getError(error: any): React.ReactNode {
  if (!error) return null;
  const msg =
    typeof error === "string" ? error : error?.message ?? "Invalid value";
  return <FormHelperText error>{msg}</FormHelperText>;
}

function toBSDisplay(stored: string, outputFmt: OutputValueFormat): string {
  if (!stored) return "";
  if (outputFmt === "bs") return stored;
  const d = dayjs(stored);
  if (!d.isValid()) return "";
  return adStrToBsStr(d.format("YYYY-MM-DD"));
}

function resolveADOutput(
  adDateStr: string,
  outputFmt: OutputValueFormat,
): string {
  if (outputFmt === "bs") return adStrToBsStr(adDateStr);
  return dayjs(adDateStr).toISOString();
}

function safeFmt(val: string, fmt: string): string {
  if (!val) return "";
  const d = dayjs(val);
  return d.isValid() ? d.format(fmt) : val.slice(0, 10);
}

function safeDateOrDefault(val: string, fallback: Date): Date {
  if (!val) return fallback;
  const d = new Date(val);
  return isNaN(d.getTime()) ? fallback : d;
}

export const UCSDateRangePicker: React.FC<IUCSDateRangePicker> = ({
  type,
  outputValueFormat = "ad",
  fromValue = "",
  toValue = "",
  onChange,
  label,
  placeholder,
  separator = " To ",
  format,
  disabled,
  required,
  size = "small",
  fullWidth,
  width,
  error,
  id,
  sx,
  language = "en",
  minDate,
  maxDate,
}) => {
  if (!type) {
    type = getUserDateTypeSetting();
  }
  const outputFmt: OutputValueFormat = outputValueFormat;
  const [open, setOpen] = React.useState(false);

  const displayValue = (() => {
    if (!fromValue) return "";
    if (type === "bs") {
      const f = toBSDisplay(fromValue, outputFmt);
      const t = toBSDisplay(toValue, outputFmt);
      return t ? `${f}${separator}${t}` : f;
    }
    const f = safeFmt(fromValue, format ?? "YYYY-MM-DD");
    const t = toValue ? safeFmt(toValue, format ?? "YYYY-MM-DD") : "";
    return t ? `${f}${separator}${t}` : f;
  })();

  // ── BS branch ─────────────────────────────────────────────────────────────
  if (type === "bs") {
    const getStartOfDay = (date: string) =>
      new Date(new Date(date).setHours(0, 0, 0, 0)).toISOString();
    const getEndOfDay = (date: string) =>
      new Date(new Date(date).setHours(23, 59, 59, 999)).toISOString();

    const fromBS = toBSDisplay(fromValue, outputFmt);
    const toBS = toBSDisplay(toValue, outputFmt);

    const [draftFrom, setDraftFrom] = React.useState(fromBS);
    const [draftTo, setDraftTo] = React.useState(toBS);

    React.useEffect(() => {
      setDraftFrom(toBSDisplay(fromValue, outputFmt));
    }, [fromValue]);
    React.useEffect(() => {
      setDraftTo(toBSDisplay(toValue, outputFmt));
    }, [toValue]);

    const handleOpen = () => {
      setDraftFrom(toBSDisplay(fromValue, outputFmt));
      setDraftTo(toBSDisplay(toValue, outputFmt));
      setOpen(true);
    };

    const handleOK = () => {
      const resolve = (bs: string, t: "f" | "t") => {
        if (!bs) return "";
        if (outputFmt === "bs") return bs;
        const [y, m, d] = bs.split("-").map(Number);
        const dv =
          t == "f"
            ? getStartOfDay(bsToAD(y, m, d))
            : getEndOfDay(bsToAD(y, m, d));
        return dayjs(dv).toISOString();
      };
      onChange(resolve(draftFrom, "f"), resolve(draftTo, "t"));
      setOpen(false);
    };

    return (
      <Box sx={{ width: width ?? "100%" }}>
        <FormControl fullWidth={fullWidth} size={size}>
          <TextField
            type="text"
            InputLabelProps={{ shrink: !!fromValue }}
            fullWidth
            variant="outlined"
            id={id}
            disabled={disabled}
            label={getLabel(label, required)}
            size={size ?? "small"}
            value={displayValue}
            placeholder={placeholder}
            sx={sx}
            onClick={() => !disabled && handleOpen()}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <CalendarTodayIcon
                    sx={{
                      fontSize: 18,
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}
                  />
                </InputAdornment>
              ),
            }}
          />
          {getError(error)}
        </FormControl>

        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          maxWidth={false}
          PaperProps={{ sx: { borderRadius: 2, overflow: "visible" } }}
        >
          {label && <DialogTitle sx={{ pb: 0 }}>{label}</DialogTitle>}
          <DialogContent sx={{ p: 0, overflow: "visible" }}>
            <BSDateRangePopup
              fromBS={draftFrom}
              toBS={draftTo}
              language={language}
              minDate={minDate}
              maxDate={maxDate}
              onSelect={(from, to) => {
                setDraftFrom(from);
                setDraftTo(to);
              }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
            <Button
              size="small"
              color="error"
              variant="outlined"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              disableElevation
              disabled={!draftFrom}
              onClick={handleOK}
            >
              OK
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // ── AD branch — react-date-range in a Dialog ──────────────────────────────
  const getStartOfDay = (date: Date) =>
    new Date(new Date(date).setHours(0, 0, 0, 0));
  const getEndOfDay = (date: Date) =>
    new Date(new Date(date).setHours(23, 59, 59, 999));

  const defaultFrom = getStartOfDay(
    safeDateOrDefault(fromValue, new Date(Date.now() - 6 * 86400000)),
  );
  const defaultTo = getEndOfDay(safeDateOrDefault(toValue, new Date()));

  const [dateRange, setDateRange] = React.useState({
    startDate: defaultFrom,
    endDate: defaultTo,
  });

  React.useEffect(() => {
    setDateRange({
      startDate: getStartOfDay(
        safeDateOrDefault(fromValue, new Date(Date.now() - 6 * 86400000)),
      ),
      endDate: getEndOfDay(safeDateOrDefault(toValue, new Date())),
    });
  }, [fromValue, toValue]);

  const handleOpen = () => {
    setDateRange({
      startDate: getStartOfDay(
        safeDateOrDefault(fromValue, new Date(Date.now() - 6 * 86400000)),
      ),
      endDate: getEndOfDay(safeDateOrDefault(toValue, new Date())),
    });
    setOpen(true);
  };

  const handleSave = () => {
    const from = getStartOfDay(new Date(dateRange.startDate));
    const to = getEndOfDay(new Date(dateRange.endDate));
    const resolve = (d: Date) =>
      outputFmt === "bs"
        ? adStrToBsStr(dayjs(d).format("YYYY-MM-DD"))
        : d.toISOString();
    onChange(resolve(from), resolve(to));
    setOpen(false);
  };

  const [RDRComponent, setRDRComponent] = React.useState<any>(null);
  React.useEffect(() => {
    import("react-date-range").then((mod) =>
      setRDRComponent(() => mod.DateRange),
    );
  }, []);

  return (
    <Box sx={{ width: width ?? "100%" }}>
      <FormControl fullWidth={fullWidth} size={size}>
        <TextField
          type="text"
          InputLabelProps={{ shrink: !!fromValue }}
          fullWidth
          variant="outlined"
          id={id}
          disabled={disabled}
          label={getLabel(label, required)}
          size={size ?? "small"}
          value={displayValue}
          placeholder={placeholder}
          sx={sx}
          onClick={() => !disabled && handleOpen()}
          InputProps={{
            readOnly: true,
            endAdornment: (
              <InputAdornment position="end">
                <CalendarTodayIcon
                  sx={{
                    fontSize: 18,
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                />
              </InputAdornment>
            ),
          }}
        />
        {getError(error)}
      </FormControl>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="lg"
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        {label && <DialogTitle sx={{ pb: 0 }}>{label}</DialogTitle>}
        <DialogContent sx={{ p: 0 }}>
          {RDRComponent ? (
            <>
              <style>{`@import "react-date-range/dist/styles.css"; @import "react-date-range/dist/theme/default.css";`}</style>
              <RDRComponent
                onChange={(item: any) => {
                  setDateRange({
                    startDate: getStartOfDay(
                      new Date(item.selection.startDate),
                    ),
                    endDate: getEndOfDay(new Date(item.selection.endDate)),
                  });
                }}
                moveRangeOnFirstSelection={false}
                weekStartsOn={0}
                showMonthAndYearPickers
                months={2}
                dateDisplayFormat="yyyy-MM-dd"
                ranges={[
                  {
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate,
                    key: "selection",
                  },
                ]}
                direction="horizontal"
              />
            </>
          ) : (
            <Box sx={{ p: 4, minWidth: 200 }}>Loading…</Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
          <Button
            size="small"
            color="error"
            variant="outlined"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            disableElevation
            onClick={handleSave}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
