// import Chip from "./chip.label"

import { Chip } from "@mui/material";
import { StatusEnum, YesNoEnum } from "@common/all.enum";

type StatusLabelProps = {
  status: Object;
  value: string;
};

const StatusList = [
  "success",
  "error",
  "warning",
  "secondary",
  "default",
  "primary",
  "info",
];

export const StatusLabel = ({ status, value }: StatusLabelProps) => {
  const index = Object.values(status).indexOf(value);
  return <Chip color={StatusList[index] as any} label={value} />;
};

type ActiveStatusChipProps = {
  status?: StatusEnum;
};

type YesNoChipProps = {
  status?: YesNoEnum;
};

export const ActiveStatusChip = ({ status }: ActiveStatusChipProps) => {
  if (!status) {
    return <Chip size="small" color={"default"} label={". . ."} />;
  }
  return (
    <Chip
      size="small"
      color={status === StatusEnum.Active ? "success" : "warning"}
      label={status}
    />
  );
};

export const YesNoChip = ({ status }: YesNoChipProps) => {
  if (!status) {
    return <Chip size="small" color={"default"} label={". . ."} />;
  }
  return (
    <Chip
      size="small"
      color={status === YesNoEnum.Yes ? "success" : "warning"}
      label={status}
    />
  );
};
