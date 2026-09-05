import { Box, Stack, Typography } from "@mui/material";
import { CsLabel } from "../label";
import { ReactNode } from "react";
import { NotSetLabel } from "@components/label/notset.label";
import { TextLabel } from "./text.label";

type LabelDataProps = {
    label: string
    value?: string | number | ReactNode
    isLoading?: boolean
    direction?: 'row' | 'column'
    gap?: number
    px?: number
    justifyContent?: string
}
export const LabelData = ({ label, value, isLoading = false, direction = 'row', gap = 1, px = 0, justifyContent }: LabelDataProps) => {
    return <Stack direction={direction} gap={gap} px={px} justifyContent={justifyContent || 'space-between'}>
        <CsLabel text={label} />
        <TextLabel text={value} isLoading={isLoading} />
    </Stack>
};

// const TextLabel = ({ text, TypoProps }: any) => {
//     if (text === undefined || text === '' || text === null) {
//         return <NotSetLabel />;
//     }
//     if (typeof text === "string") {
//         return <Typography variant='body2' color="textSecondary" {...TypoProps} >{text}</Typography>;
//     }
//     return <Stack direction={'row'} gap={1}>{text}</Stack>
// };