import { Create, type CreateProps } from "@refinedev/mui";
import { Box, type CardProps } from "@mui/material";
import { DefaultBreadcrumbs } from "../breadcrumb/breadcumb.default";

type Props = { noCard?: boolean; cardProps?: CardProps } & CreateProps;

export const RefineCreateView = ({ children, noCard, cardProps, ...props }: Props) => {
  return (
    <Create
      {...props}
      breadcrumb={props.breadcrumb === undefined ? <DefaultBreadcrumbs /> : props.breadcrumb}
      headerProps={{
        sx: {
          padding: "5px 24px 0px",
          display: "flex",
          flexWrap: "wrap",
          ".MuiCardHeader-action": { alignSelf: "center" },
          height: props.title ? "72px" : "0px",
        },
      }}
      headerButtonProps={{ alignItems: "center", ...props.headerButtonProps }}
      wrapperProps={{
        sx: {
          backgroundColor: "transparent",
          backgroundImage: "none",
          boxShadow: "none",
          ...props.wrapperProps?.sx,
        },
      }}
    >
      {/* Render content directly — no <Card><Scrollbar> wrapper. Simplebar's
          flex-column context made child elements with `mx:auto` shrink to their
          content, so the wizard's step card was narrower on steps with less
          content. */}
      <Box sx={{ width: "100%" }}>{children}</Box>
    </Create>
  );
};
