import LoadingButton from "@mui/lab/LoadingButton";
import { Box, Dialog, DialogContent, DialogProps, DialogTitle, Drawer, LinearProgress, Stack } from "@mui/material";
import { DrawerHeader } from "../drawer";

type Props = {
    onClose: () => void;
    children: any
    title?: string
    size?: DialogProps['maxWidth']
    isLoading?: boolean
};

export const FormModal = (props: Props) => {
    const { size, children, isLoading, onClose } = props

    return <Dialog
        open
        onClose={onClose}
        fullWidth
        maxWidth={size ?? "md"}
        keepMounted={false}

        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
    >
        <DialogContent
            sx={{
                p: 3
            }}
        >
            {children}
        </DialogContent>
    </Dialog>


}