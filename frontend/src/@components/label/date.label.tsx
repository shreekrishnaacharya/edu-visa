import { Box, Skeleton, Typography, TypographyProps } from "@mui/material";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { NotSetLabel } from "./notset.label";
import { TextLabel } from "@components/other/text.label";
import { convertToDefaultDateFormat } from "@components/input/dateinput";
import { DatePickerType } from "@components/input/dateinput/types";

dayjs.extend(duration);

type DateLabelProps = TypographyProps & {
  date?: string;
  isLoading?: boolean;
  type?: DatePickerType;
  format?: string;
  color?: string;
  prefix?: any;
};
export const DateLabel = ({
  date,
  isLoading = false,
  prefix = "",
  type,
  color = "textSecondary",
  ...TypoProps
}: DateLabelProps) => {
  if (isLoading) {
    <Skeleton />;
  }
  if (!date) {
    return <NotSetLabel {...TypoProps} />;
  }
  let dateValue = convertToDefaultDateFormat(date);
  return <TextLabel TypoProps={{ color, ...TypoProps }} text={dateValue} />;
};

export const DateTimeLabel = ({
  date,
  isLoading = false,
  type,
  color = "textSecondary",
  ...TypoProps
}: DateLabelProps) => {
  if (isLoading) {
    <Skeleton />;
  }
  if (!date) {
    return <NotSetLabel {...TypoProps} />;
  }
  let dateValue = convertToDefaultDateFormat(date, true);
  return <TextLabel TypoProps={{ color, ...TypoProps }} text={dateValue} />;
};

export const TimeLabel = ({
  date,
  isLoading = false,
  format = "hh:mm A",
  color = "textSecondary",
  ...TypoProps
}: DateLabelProps) => {
  if (isLoading) {
    <Skeleton />;
  }
  if (!date) {
    return <NotSetLabel {...TypoProps} />;
  }
  return (
    <TextLabel
      TypoProps={{ color, ...TypoProps }}
      text={dayjs(date).format(format)}
    />
  );
};
