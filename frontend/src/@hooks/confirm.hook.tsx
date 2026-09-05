import React, { ReactElement } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogTitle from "@mui/material/DialogTitle";
import { useTranslate } from "./useTranslate";
import { LANG_COMMON } from "@common/constant";
import { UCSInput } from "@components/input/uc.input";
import { DialogContent } from "@mui/material";

type ConfirmButtonReturn = [(data?: any) => void, ReactElement];

type ConfirmButtonProps = {
  onCancel?: (data: any) => void;
  onConfirm: (data: any, reason?: string) => void;
  reason?: {
    label: string;
    rows?: number;
    required: boolean;
    // When set, the confirm button stays disabled until the typed text matches
    // this value exactly (case-sensitive), e.g. requiring the user to type "POST".
    match?: string;
  };
  children?: any;
  confirmTitle?: string;
  confirmOkText?: string;
  confirmCancelText?: string;
};
export const useConfirm = ({
  onConfirm,
  children,
  confirmTitle,
  confirmOkText,
  confirmCancelText,
  onCancel,
  reason,
  ...rest
}: ConfirmButtonProps): ConfirmButtonReturn => {
  const t = useTranslate(LANG_COMMON);
  const [open, setOpen] = React.useState<any | undefined>();
  const [reasonText, setReasonText] = React.useState<string | undefined>();
  return [
    (data: any) => {
      setReasonText(undefined);
      setOpen(data ?? {});
    },
    <div key={`confirm-dialog-${confirmTitle?.toLowerCase().replace(/\s+/g, "-") ?? "default"}`}>
      <Dialog
        open={Boolean(open)}
        onClose={() => {
          setOpen(undefined);
          onCancel?.(open!);
        }}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {confirmTitle ?? t("titles.confirm")}
        </DialogTitle>
        {reason && (
          <DialogContent>
            <UCSInput
              fullWidth
              label={reason.label}
              multiline={reason.rows ?? 1}
              onChange={(e: any) => setReasonText(e.target.value)}
              value={reasonText}
            />
          </DialogContent>
        )}
        <DialogActions sx={{ justifyContent: "center" }}>
          <Button
            onClick={() => {
              setOpen(undefined);
              onCancel?.(open!);
              console.log("adcj dskjc ")
            }}
          >
            {confirmCancelText ?? t("buttons.no")}
          </Button>
          <Button
            color="error"
            disabled={
              reason?.required &&
              (reason.match
                ? reasonText !== reason.match
                : !reasonText)
            }
            onClick={() => {
              onConfirm(open!, reasonText);
              setOpen(undefined);
            }}
            autoFocus
          >
            {confirmOkText ?? t("buttons.yes")}
          </Button>
        </DialogActions>
      </Dialog>
    </div>,
  ];
};
