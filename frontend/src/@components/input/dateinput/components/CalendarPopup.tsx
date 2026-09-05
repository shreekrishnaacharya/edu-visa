import React from "react";
import {
  Box,
  FormControl,
  Paper,
  Typography,
  Select,
  MenuItem,
  IconButton,
  SelectChangeEvent,
  useTheme,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import {
  BS_MONTHS_EN,
  BS_MONTHS_NE,
  DAYS_EN,
  DAYS_NE,
  BS_DATA,
  buildBSCalendarGrid,
  navigateBSMonth,
  todayBS,
} from "../utils/bsCalendar";
import { isValidBSDate } from "../utils/validators";
import type { Language } from "../types";

// ─── Calendar popup ───────────────────────────────────────────────────────────

interface CalendarPopupProps {
  selectedBS: string; // "YYYY-MM-DD" or ""
  language: Language;
  minDate?: string;
  maxDate?: string;
  onSelect: (bsYear: number, bsMonth: number, bsDay: number) => void;
}

export const CalendarPopup: React.FC<CalendarPopupProps> = ({
  selectedBS,
  language,
  minDate,
  maxDate,
  onSelect,
}) => {
  const theme = useTheme();
  const today = todayBS();

  // Determine initial view month — use selected date if available, else today
  const initView = (() => {
    if (selectedBS && isValidBSDate(selectedBS)) {
      const [y, m] = selectedBS.split("-").map(Number);
      return { year: y, month: m };
    }
    return { year: today.year, month: today.month };
  })();

  const [viewYear, setViewYear] = React.useState(initView.year);
  const [viewMonth, setViewMonth] = React.useState(initView.month);

  const months = language === "ne" ? BS_MONTHS_NE : BS_MONTHS_EN;
  const days = language === "ne" ? DAYS_NE : DAYS_EN;

  const grid = buildBSCalendarGrid(viewYear, viewMonth);

  const isDisabled = (y: number, m: number, d: number): boolean => {
    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(
      2,
      "0",
    )}`;
    if (minDate && dateStr < minDate) return true;
    if (maxDate && dateStr > maxDate) return true;
    return false;
  };

  const isToday = (d: number) =>
    viewYear === today.year && viewMonth === today.month && d === today.day;

  const isSelected = (d: number) => {
    if (!selectedBS) return false;
    const [sy, sm, sd] = selectedBS.split("-").map(Number);
    return sy === viewYear && sm === viewMonth && sd === d;
  };

  const handlePrev = () => {
    const n = navigateBSMonth(viewYear, viewMonth, -1);
    setViewYear(n.year);
    setViewMonth(n.month);
  };
  const handleNext = () => {
    const n = navigateBSMonth(viewYear, viewMonth, +1);
    setViewYear(n.year);
    setViewMonth(n.month);
  };

  const primary = theme.palette.primary.main;
  const isDark = theme.palette.mode === "dark";

  // Year options: 2000–2099
  const yearOptions = Object.keys(BS_DATA)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <Paper
      elevation={4}
      sx={{
        width: 280,
        userSelect: "none",
        borderRadius: 2,
        overflow: "hidden",
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      {/* ── Header ── */}
      <Box
        sx={{
          background: primary,
          px: 1,
          py: 0.75,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 0.5,
        }}
      >
        <IconButton
          size="small"
          onClick={handlePrev}
          sx={{ color: "#fff", p: 0.25 }}
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>

        {/* Month dropdown — wrapped in FormControl to isolate InputBase context from portal ancestor */}
        <FormControl>
          <Select
            size="small"
            value={viewMonth}
            onChange={(e: SelectChangeEvent<number>) =>
              setViewMonth(Number(e.target.value))
            }
            MenuProps={{ sx: { zIndex: 10000 } }}
            sx={{
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              "& .MuiOutlinedInput-notchedOutline": { border: "none" },
              "& .MuiSelect-icon": { color: "#fff" },
              "& .MuiSelect-select": { py: 0.25, px: 0.5 },
            }}
          >
            {months.map((m, i) => (
              <MenuItem key={i} value={i + 1} sx={{ fontSize: 13 }}>
                {m}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Year dropdown */}
        <FormControl>
          <Select
            size="small"
            value={viewYear}
            onChange={(e: SelectChangeEvent<number>) =>
              setViewYear(Number(e.target.value))
            }
            MenuProps={{ sx: { zIndex: 10000 } }}
            sx={{
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              "& .MuiOutlinedInput-notchedOutline": { border: "none" },
              "& .MuiSelect-icon": { color: "#fff" },
              "& .MuiSelect-select": { py: 0.25, px: 0.5 },
            }}
          >
            {yearOptions.map((y) => (
              <MenuItem key={y} value={y} sx={{ fontSize: 13 }}>
                {y}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <IconButton
          size="small"
          onClick={handleNext}
          sx={{ color: "#fff", p: 0.25 }}
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* ── Day headers ── */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          background: isDark
            ? theme.palette.grey[800]
            : theme.palette.grey[100],
          px: 0.5,
        }}
      >
        {days.map((d) => (
          <Typography
            key={d}
            sx={{
              textAlign: "center",
              fontSize: 11,
              fontWeight: 600,
              py: 0.5,
              color: theme.palette.text.secondary,
            }}
          >
            {d}
          </Typography>
        ))}
      </Box>

      {/* ── Date grid ── */}
      <Box sx={{ px: 0.5, pb: 0.5 }}>
        {grid.map((week, wi) => (
          <Box
            key={wi}
            sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}
          >
            {week.map((day, di) => {
              if (day === null) {
                return <Box key={di} sx={{ aspectRatio: "1" }} />;
              }
              const disabled = isDisabled(viewYear, viewMonth, day);
              const selected = isSelected(day);
              const isTodays = isToday(day);

              return (
                <Box
                  key={di}
                  onClick={() =>
                    !disabled && onSelect(viewYear, viewMonth, day)
                  }
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    aspectRatio: "1",
                    borderRadius: "50%",
                    fontSize: 13,
                    cursor: disabled ? "not-allowed" : "pointer",
                    fontWeight: selected ? 700 : 400,
                    color: selected
                      ? "#fff"
                      : disabled
                      ? theme.palette.text.disabled
                      : isTodays
                      ? primary
                      : theme.palette.text.primary,
                    background: selected ? primary : "transparent",
                    border:
                      isTodays && !selected
                        ? `1px solid ${primary}`
                        : "1px solid transparent",
                    "&:hover": disabled
                      ? {}
                      : {
                          background: selected
                            ? primary
                            : theme.palette.action.hover,
                        },
                  }}
                >
                  {day}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Paper>
  );
};
