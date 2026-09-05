import { Typography, TypographyProps } from "@mui/material";

interface CsLabelProps {
  text: string,
  TypoProps?: TypographyProps
}

export const CsLabel = ({ text, TypoProps }: CsLabelProps) => {
  return <Typography variant='subtitle2' {...TypoProps} >{text}</Typography>;
};