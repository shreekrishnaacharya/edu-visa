import { FormHelperText, Typography } from "@mui/material"



export const getLabel = (label?: string, required?: boolean | undefined) => {
    if (!label) {
        return undefined
    }
    return required ? (<Typography component={"span"}>{label}<Typography component={"span"} style={{ color: "red" }}> *</Typography></Typography>) : label
}

export const getError = (error: any) => {
    if (!error) {
        return
    }
    return <FormHelperText error>{error.message}</FormHelperText>
}