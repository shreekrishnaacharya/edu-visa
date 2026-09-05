import { Dialog, DialogActions, DialogContent, DialogProps, DialogTitle, Divider, IconButton, Stack } from "@mui/material";
import { GridCloseIcon } from "@mui/x-data-grid";
import React from "react";


type Props = {
    ref?: any
    containerRef?: any
    open: boolean
    onClose: () => void;
    children: any
    title?: string
    footer?: React.ReactNode
    size?: DialogProps['maxWidth']
    isLoading?: boolean
    keepMounted?: boolean
    sx?: any
};

export const BasicModal = (props: Props) => {
    const { ref, containerRef, size, children, sx, keepMounted, onClose } = props
    return <Dialog
        ref={ref}
        container={containerRef?.current}
        open={props.open}
        onClose={onClose}
        fullWidth
        sx={sx}
        maxWidth={size ?? "md"}
        keepMounted={keepMounted ?? false}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
    >
        {props.title && (
            <>
                <DialogTitle id="alert-dialog-title">
                    {props.title}
                </DialogTitle>
                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    sx={(theme) => ({
                        position: 'absolute',
                        right: 8,
                        top: 8,
                        color: theme.palette.grey[500],
                    })}
                >
                    <GridCloseIcon />
                </IconButton>
                <Divider />
            </>
        )}
        <DialogContent
            sx={{
                p: 3
            }}
        >
            {children}
        </DialogContent>
        {props.footer && (
            <>
                <Divider />
                <DialogActions>
                    {props.footer}
                </DialogActions>
            </>
        )}
    </Dialog>


}