import { Info } from "@mui/icons-material"
import { Box, Button, Fade, IconButton, Paper, Popover, Popper, Stack, Typography, type IconButtonProps } from "@mui/material"
import { IQueryKeys, useDeleteButton } from "@refinedev/core"
import { LANG_COMMON } from "@common/constant"
import { useTranslate } from "@hooks/useTranslate"
import { useState } from "react"


type IconDeleteButtonProps = Omit<IconButtonProps, 'onClick'> & {
    title?: string
    onConfirm: () => void
    onCancel?: () => void
    invalidates?: (keyof IQueryKeys)[]
}

export const IconPopconfirm = ({ resource, id, itemID, invalidates, onConfirm, title, onCancel, ...rest }: IconDeleteButtonProps) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const t = useTranslate(LANG_COMMON)
    const handleClick = (event: any) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleConfirm = () => {
        onConfirm();
        handleClose();
    };

    const handleCancel = () => {
        onCancel?.();
        handleClose();
    };

    const { onConfirm: confirmMutate, disabled, loading } = useDeleteButton({
        resource, // Resource name/identifier, if not provided, it will be inferred from the current route.
        id: itemID, // Record identifier to delete. If not provided, it will be inferred from the current route.
        onSuccess: handleConfirm, // The function to be called when the deletion is successful.
        invalidates, // The list of scopes of a resource to be invalidated after the deletion.
    });
    const open = Boolean(anchorEl);
    return (
        <>
            <IconButton onClick={handleClick} {...rest} />
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                }}
                PaperProps={{
                    sx: {
                        overflowX: "unset",
                        overflowY: "unset",
                        "&::before": {
                            content: '""',
                            position: "absolute",
                            marginRight: "-0.71em",
                            bottom: 0,
                            right: 0,
                            width: 10,
                            height: 10,
                            backgroundColor: "#fff",
                            boxShadow: "#ccc",
                            transform: "translate(-50%, 50%) rotate(135deg)",
                            clipPath: "polygon(-5px -5px, calc(100% + 5px) -5px, calc(100% + 5px) calc(100% + 5px))",
                        },
                    },
                }}
            >
                <Stack direction={'row'} maxWidth={250} p={1} justifyItems={'baseline'}>
                    <Info color="warning" sx={{ fontSize: 16 }} />
                    <Box>
                        <Typography variant="subtitle2" sx={{ fontSize: 14 }}>{t('titles.confirmDelete')}</Typography>
                        <Typography variant="body1" sx={{ fontSize: 14 }}>{title ?? t('description.confirmDelete')}</Typography>
                        <Stack direction={'row'} gap={1} justifyContent={'flex-end'} justifyItems={'flex-end'}>
                            <Button sx={{ minWidth: 45, fontSize: 12 }} variant="outlined" size="small" onClick={handleCancel}>{t("buttons.no")}</Button>
                            <Button disabled={disabled || loading} sx={{ minWidth: 45, fontSize: 12 }} variant="contained" size="small" color="error" onClick={confirmMutate}>{t("buttons.yes")}</Button>
                        </Stack>
                    </Box>
                </Stack>
            </Popover>
        </>
    );
};
