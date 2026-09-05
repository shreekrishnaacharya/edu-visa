import { Typography, TypographyProps } from "@mui/material"

export const NotSetLabel = (props: TypographyProps) => {
    return <Typography variant='body2' sx={{ fontStyle: 'italic' }} color={"red"} {...props}>{"(not set)"}</Typography>
}