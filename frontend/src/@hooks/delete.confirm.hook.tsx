import React, { ReactElement } from "react";
import { useDelete, useUpdate } from "@refinedev/core";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogTitle from "@mui/material/DialogTitle";
import { DeleteButtonProps } from "@refinedev/mui";
import { useTranslate } from "./useTranslate";
import { LANG_COMMON } from "@common/constant";

type ConfirmButtonReturn = [
    {
        setOpen: (id: string) => void,
        // disabled: boolean,
        loading: boolean,
    },
    ReactElement
]

type ConfirmButtonProps = DeleteButtonProps & {
    onCancel?: () => void
    resource: string
}
export const useConfirmButton = ({
    resource: resourceNameFromProps,
    resourceNameOrRouteName,
    onSuccess,
    onAbort,
    mutationMode,
    children,
    successNotification,
    errorNotification,
    hideText = false,
    accessControl,
    meta,
    metaData,
    dataProviderName,
    confirmTitle,
    confirmOkText,
    confirmCancelText,
    svgIconProps,
    invalidates,
    onCancel,
    ...rest
}: ConfirmButtonProps): ConfirmButtonReturn => {
    const {
        mutate,
        isLoading
    } = useDelete();
    const {}=useUpdate()
    const t = useTranslate(LANG_COMMON)

    const [open, setOpen] = React.useState<string | undefined>();
    const onConfirm = (id: string) => {
        mutate({
            resource: resourceNameFromProps!,
            id,
            dataProviderName,
            mutationMode,
            invalidates,
            meta,
            successNotification,
            errorNotification,
        }, {
            onSuccess
        })
    }
    const { sx, ...restProps } = rest;

    return [
        {
            setOpen,
            loading: isLoading,
        },

        <div key="delete-confirm-dialog">
            <Dialog
                open={Boolean(open)}
                onClose={() => {
                    setOpen(undefined)
                    onCancel?.()
                }}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">
                    {confirmTitle ?? t('titles.confirm')}
                </DialogTitle>
                <DialogActions sx={{ justifyContent: "center" }}>
                    <Button onClick={() => {
                        setOpen(undefined)
                        onCancel?.()
                    }}>
                        {confirmCancelText ?? t('buttons.no')}
                    </Button>
                    <Button
                        color="error"
                        onClick={() => {
                            if (open) {
                                onConfirm(open!);
                                setOpen(undefined);
                            }
                        }}
                        autoFocus
                    >
                        {confirmOkText ?? t('buttons.yes')}
                    </Button>
                </DialogActions>
            </Dialog>
        </div>

    ]
};
