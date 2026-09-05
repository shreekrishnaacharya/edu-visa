import { Skeleton, Stack, Typography } from "@mui/material";
import { NotSetLabel } from "../label/notset.label";
import { ReactNode } from "react";
import { TypographyProps } from "@mui/material";

interface TextLabelProps {
  text: string | number | undefined | ReactNode;
  isLoading?: boolean;
  notSetText?: string | ReactNode;
  TypoProps?: TypographyProps;
  width?: number;
  color?:
    | "textSecondary"
    | "textPrimary"
    | "primary"
    | "secondary"
    | "error"
    | "info"
    | "success"
    | "warning";
  variant?:
    | "body1"
    | "body2"
    | "subtitle1"
    | "subtitle2"
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6";
}

/**
 * TextLabel
 *
 * @description
 * Displays text with a fallback to NotSetText when text is undefined.
 * Displays a Skeleton component when isLoading is true.
 *
 * @param {{ text: string | undefined, isLoading: boolean, notSetText?: string | ReactNode, typoProps?: TypographyProps, width?: number }} props
 * @returns {ReactNode}
 */
export const TextLabel = ({
  text,
  isLoading,
  notSetText,
  TypoProps,
  variant = "body2",
  color = "textSecondary",
  width = 130,
}: TextLabelProps) => {
  if (isLoading) {
    return <Skeleton variant="text" width={width} />;
  }
  if (text === undefined || text === null || text === "" || text === "null") {
    if (notSetText === undefined) {
      return <NotSetLabel {...TypoProps} />;
    }
    if (typeof notSetText === "string") {
      return notSetText;
    }
    return notSetText;
  }
  if (typeof text === "string") {
    return (
      <Typography variant={variant} color={color} {...TypoProps}>
        {text}
      </Typography>
    );
  }
  return (
    <Stack direction={"row"} gap={1}>
      {text}
    </Stack>
  );
};
