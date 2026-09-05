/**
 * BSDateRangePopup
 * ─────────────────────────────────────────────────────────────────────────────
 * Two BS calendars side-by-side with range highlighting — mirrors the
 * react-date-range DateRange UX for Bikram Sambat dates.
 *
 * Features:
 *  - Two month panels (left = earlier month, right = next month)
 *  - Highlights all days between from and to dates
 *  - Clicking a day: first click = from, second click = to
 *  - If second click is before first, they swap
 *  - Hover preview of range while picking second date
 *  - Month/year navigation (left panel navigates, right always = left + 1 month)
 *  - Min/max date enforcement
 */

import React from "react";
import {
  Box,
  Paper,
  Typography,
  Select,
  MenuItem,
  IconButton,
  useTheme,
  SelectChangeEvent,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import {
  BS_DATA,
  BS_MONTHS_EN,
  BS_MONTHS_NE,
  DAYS_EN,
  DAYS_NE,
  buildBSCalendarGrid,
  navigateBSMonth,
  todayBS,
  bsToAD,
} from "../utils/bsCalendar";
import { isValidBSDate } from "../utils/validators";
import type { Language } from "../types";

interface BSDateRangePopupProps {
  fromBS: string;   // "YYYY-MM-DD" or ""
  toBS: string;     // "YYYY-MM-DD" or ""
  language?: Language;
  minDate?: string; // BS "YYYY-MM-DD"
  maxDate?: string; // BS "YYYY-MM-DD"
  onSelect: (from: string, to: string) => void;
}

// Compare two BS date strings
const bsLt  = (a: string, b: string) => a < b;
const bsLte = (a: string, b: string) => a <= b;
const bsGte = (a: string, b: string) => a >= b;
const bsPad = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

// ─── Single BS calendar panel ─────────────────────────────────────────────────

interface BSRangeMonthProps {
  year: number;
  month: number;
  fromBS: string;
  toBS: string;
  hoverBS: string;
  language: Language;
  minDate?: string;
  maxDate?: string;
  picking: "from" | "to";
  onDayClick: (dateStr: string) => void;
  onDayHover: (dateStr: string) => void;
  onDayLeave: () => void;
  showNavPrev?: boolean;
  showNavNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onMonthChange?: (m: number) => void;
  onYearChange?:  (y: number) => void;
}

const BSRangeMonth: React.FC<BSRangeMonthProps> = ({
  year, month, fromBS, toBS, hoverBS,
  language, minDate, maxDate, picking,
  onDayClick, onDayHover, onDayLeave,
  showNavPrev, showNavNext, onPrev, onNext,
  onMonthChange, onYearChange,
}) => {
  const theme  = useTheme();
  const today  = todayBS();
  const months = language === "ne" ? BS_MONTHS_NE : BS_MONTHS_EN;
  const days   = language === "ne" ? DAYS_NE : DAYS_EN;
  const grid   = buildBSCalendarGrid(year, month);
  const primary = theme.palette.primary.main;
  const isDark  = theme.palette.mode === "dark";

  // Effective range for highlighting (use hover for preview)
  const effectiveTo = picking === "to" && hoverBS && fromBS
    ? (bsLt(hoverBS, fromBS) ? fromBS : hoverBS)
    : toBS;
  const effectiveFrom = picking === "to" && hoverBS && fromBS
    ? (bsLt(hoverBS, fromBS) ? hoverBS : fromBS)
    : fromBS;

  const isDisabled = (ds: string) => {
    if (minDate && bsLt(ds, minDate)) return true;
    if (maxDate && bsLt(maxDate, ds)) return true;
    return false;
  };
  const isFrom     = (ds: string) => ds === fromBS;
  const isTo       = (ds: string) => ds === (toBS || fromBS);
  const isInRange  = (ds: string) =>
    effectiveFrom && effectiveTo &&
    bsGte(ds, effectiveFrom) && bsLte(ds, effectiveTo);
  const isStart    = (ds: string) => ds === effectiveFrom && !!effectiveTo;
  const isEnd      = (ds: string) => ds === effectiveTo && !!effectiveFrom;
  const isToday    = (d: number) =>
    year === today.year && month === today.month && d === today.day;

  const yearOptions = Object.keys(BS_DATA).map(Number).sort((a,b)=>a-b);

  return (
    <Box sx={{ width: 280, userSelect: "none" }}>
      {/* Header */}
      <Box sx={{
        background: primary, px: 1, py: 0.75,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 0.5,
      }}>
        {showNavPrev ? (
          <IconButton size="small" onClick={onPrev} sx={{ color: "#fff", p: 0.25 }}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        ) : <Box sx={{ width: 28 }} />}

        <Select
          size="small" value={month}
          onChange={(e: SelectChangeEvent<number>) => onMonthChange?.(Number(e.target.value))}
          sx={{
            color:"#fff", fontSize:13, fontWeight:600,
            "& .MuiOutlinedInput-notchedOutline":{border:"none"},
            "& .MuiSelect-icon":{color:"#fff"},
            "& .MuiSelect-select":{py:0.25, px:0.5},
          }}
        >
          {months.map((m,i) => (
            <MenuItem key={i} value={i+1} sx={{fontSize:13}}>{m}</MenuItem>
          ))}
        </Select>

        <Select
          size="small" value={year}
          onChange={(e: SelectChangeEvent<number>) => onYearChange?.(Number(e.target.value))}
          sx={{
            color:"#fff", fontSize:13, fontWeight:600,
            "& .MuiOutlinedInput-notchedOutline":{border:"none"},
            "& .MuiSelect-icon":{color:"#fff"},
            "& .MuiSelect-select":{py:0.25, px:0.5},
          }}
        >
          {yearOptions.map(y => (
            <MenuItem key={y} value={y} sx={{fontSize:13}}>{y}</MenuItem>
          ))}
        </Select>

        {showNavNext ? (
          <IconButton size="small" onClick={onNext} sx={{ color: "#fff", p: 0.25 }}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        ) : <Box sx={{ width: 28 }} />}
      </Box>

      {/* Day headers */}
      <Box sx={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
        background: isDark ? theme.palette.grey[800] : theme.palette.grey[100],
        px: 0.5,
      }}>
        {days.map(d => (
          <Typography key={d} sx={{
            textAlign:"center", fontSize:11, fontWeight:600, py:0.5,
            color: theme.palette.text.secondary,
          }}>{d}</Typography>
        ))}
      </Box>

      {/* Date grid */}
      <Box sx={{ px: 0.5, pb: 0.5 }}>
        {grid.map((week, wi) => (
          <Box key={wi} sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {week.map((day, di) => {
              if (day === null) return (
                <Box key={di} sx={{ aspectRatio:"1", bgcolor: "transparent" }} />
              );
              const ds       = bsPad(year, month, day);
              const disabled = isDisabled(ds);
              const start    = isStart(ds);
              const end      = isEnd(ds);
              const inRange  = isInRange(ds);
              const isEdge   = start || end;
              const todays   = isToday(day);

              return (
                <Box
                  key={di}
                  onMouseEnter={() => !disabled && onDayHover(ds)}
                  onMouseLeave={onDayLeave}
                  onClick={() => !disabled && onDayClick(ds)}
                  sx={{
                    position: "relative",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    aspectRatio: "1",
                    cursor: disabled ? "not-allowed" : "pointer",
                    // Range band background (half-circle on edges)
                    "&::before": inRange && !isEdge ? {
                      content: '""',
                      position: "absolute",
                      inset: "0 0 0 0",
                      background: theme.palette.primary.light + "40",
                      zIndex: 0,
                    } : start && end ? {} : start ? {
                      content: '""',
                      position: "absolute",
                      inset: "0 0 0 50%",
                      background: theme.palette.primary.light + "40",
                      zIndex: 0,
                    } : end ? {
                      content: '""',
                      position: "absolute",
                      inset: "0 50% 0 0",
                      background: theme.palette.primary.light + "40",
                      zIndex: 0,
                    } : {},
                  }}
                >
                  <Box sx={{
                    position: "relative", zIndex: 1,
                    width: "80%", aspectRatio: "1",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: "50%",
                    fontSize: 13,
                    fontWeight: isEdge ? 700 : 400,
                    color: isEdge
                      ? "#fff"
                      : disabled
                      ? theme.palette.text.disabled
                      : todays
                      ? primary
                      : theme.palette.text.primary,
                    background: isEdge ? primary : "transparent",
                    border: todays && !isEdge ? `1px solid ${primary}` : "1px solid transparent",
                    "&:hover": disabled ? {} : {
                      background: isEdge ? primary : theme.palette.action.hover,
                    },
                  }}>
                    {day}
                  </Box>
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Compare two {year,month} panels: returns -1, 0, +1 */
function panelCmp(
  ay: number, am: number, by: number, bm: number
): number {
  if (ay !== by) return ay < by ? -1 : 1;
  if (am !== bm) return am < bm ? -1 : 1;
  return 0;
}

// ─── Main BSDateRangePopup ────────────────────────────────────────────────────

export const BSDateRangePopup: React.FC<BSDateRangePopupProps> = ({
  fromBS, toBS, language = "en", minDate, maxDate, onSelect,
}) => {
  const today = todayBS();

  // Seed left panel from fromBS, right panel = left + 1 initially
  const initLeft = React.useMemo(() => {
    if (fromBS && isValidBSDate(fromBS)) {
      const [y, m] = fromBS.split("-").map(Number);
      return { year: y, month: m };
    }
    return { year: today.year, month: today.month };
  }, []);

  const initRight = React.useMemo(() => {
    if (toBS && isValidBSDate(toBS)) {
      const [y, m] = toBS.split("-").map(Number);
      // Right must be strictly after left
      if (panelCmp(y, m, initLeft.year, initLeft.month) > 0) return { year: y, month: m };
    }
    return navigateBSMonth(initLeft.year, initLeft.month, +1);
  }, []);

  const [leftYear,   setLeftYear]   = React.useState(initLeft.year);
  const [leftMonth,  setLeftMonth]  = React.useState(initLeft.month);
  const [rightYear,  setRightYear]  = React.useState(initRight.year);
  const [rightMonth, setRightMonth] = React.useState(initRight.month);

  // Internal draft state
  const [draftFrom, setDraftFrom] = React.useState(fromBS);
  const [draftTo,   setDraftTo]   = React.useState(toBS);
  const [hoverBS,   setHoverBS]   = React.useState("");
  const [picking, setPicking]     = React.useState<"from"|"to">("from");

  const handleDayClick = (ds: string) => {
    if (picking === "from") {
      setDraftFrom(ds);
      setDraftTo("");
      setPicking("to");
      onSelect(ds, "");
    } else {
      const [f, t] = bsLt(ds, draftFrom) ? [ds, draftFrom] : [draftFrom, ds];
      setDraftFrom(f);
      setDraftTo(t);
      setPicking("from");
      onSelect(f, t);
    }
  };

  // ── Left panel navigation ─────────────────────────────────────────────────
  const handleLeftPrev = () => {
    const n = navigateBSMonth(leftYear, leftMonth, -1);
    setLeftYear(n.year); setLeftMonth(n.month);
  };
  const handleLeftNext = () => {
    const n = navigateBSMonth(leftYear, leftMonth, +1);
    // Don't let left overtake right — push right forward if needed
    if (panelCmp(n.year, n.month, rightYear, rightMonth) >= 0) {
      const nr = navigateBSMonth(n.year, n.month, +1);
      setRightYear(nr.year); setRightMonth(nr.month);
    }
    setLeftYear(n.year); setLeftMonth(n.month);
  };
  const handleLeftMonth = (m: number) => {
    if (panelCmp(leftYear, m, rightYear, rightMonth) >= 0) {
      const nr = navigateBSMonth(leftYear, m, +1);
      setRightYear(nr.year); setRightMonth(nr.month);
    }
    setLeftMonth(m);
  };
  const handleLeftYear = (y: number) => {
    if (panelCmp(y, leftMonth, rightYear, rightMonth) >= 0) {
      const nr = navigateBSMonth(y, leftMonth, +1);
      setRightYear(nr.year); setRightMonth(nr.month);
    }
    setLeftYear(y);
  };

  // ── Right panel navigation ────────────────────────────────────────────────
  const handleRightPrev = () => {
    const n = navigateBSMonth(rightYear, rightMonth, -1);
    // Don't let right go behind left — push left back if needed
    if (panelCmp(n.year, n.month, leftYear, leftMonth) <= 0) {
      const nl = navigateBSMonth(n.year, n.month, -1);
      setLeftYear(nl.year); setLeftMonth(nl.month);
    }
    setRightYear(n.year); setRightMonth(n.month);
  };
  const handleRightNext = () => {
    const n = navigateBSMonth(rightYear, rightMonth, +1);
    setRightYear(n.year); setRightMonth(n.month);
  };
  const handleRightMonth = (m: number) => {
    if (panelCmp(rightYear, m, leftYear, leftMonth) <= 0) {
      const nl = navigateBSMonth(rightYear, m, -1);
      setLeftYear(nl.year); setLeftMonth(nl.month);
    }
    setRightMonth(m);
  };
  const handleRightYear = (y: number) => {
    if (panelCmp(y, rightMonth, leftYear, leftMonth) <= 0) {
      const nl = navigateBSMonth(y, rightMonth, -1);
      setLeftYear(nl.year); setLeftMonth(nl.month);
    }
    setRightYear(y);
  };

  return (
    <Box sx={{ display: "flex", borderRadius: 2, overflow: "hidden" }}>
      <BSRangeMonth
        year={leftYear} month={leftMonth}
        fromBS={draftFrom} toBS={draftTo} hoverBS={hoverBS}
        language={language} minDate={minDate} maxDate={maxDate}
        picking={picking}
        onDayClick={handleDayClick}
        onDayHover={setHoverBS}
        onDayLeave={() => setHoverBS("")}
        showNavPrev showNavNext
        onPrev={handleLeftPrev}
        onNext={handleLeftNext}
        onMonthChange={handleLeftMonth}
        onYearChange={handleLeftYear}
      />
      <Box sx={{ width: "1px", bgcolor: "divider", flexShrink: 0 }} />
      <BSRangeMonth
        year={rightYear} month={rightMonth}
        fromBS={draftFrom} toBS={draftTo} hoverBS={hoverBS}
        language={language} minDate={minDate} maxDate={maxDate}
        picking={picking}
        onDayClick={handleDayClick}
        onDayHover={setHoverBS}
        onDayLeave={() => setHoverBS("")}
        showNavPrev showNavNext
        onPrev={handleRightPrev}
        onNext={handleRightNext}
        onMonthChange={handleRightMonth}
        onYearChange={handleRightYear}
      />
    </Box>
  );
};