import { Box, Card, CardProps } from "@mui/material";
import { List, type ListProps } from "@refinedev/mui";
import { DefaultBreadcrumbs } from "../breadcrumb/breadcumb.default";

type Props = {
  isLoading?: boolean;
  CardProps?: CardProps;
  noCard?: boolean;
  hideTitleOnPrint?: boolean;
} & ListProps;

export const RefineListView = ({
  children,
  noCard,
  CardProps,
  hideTitleOnPrint = false,
  ...props
}: Props) => {
  return (
    <List
      {...props}
      breadcrumb={
        props.breadcrumb == undefined ? (
          <DefaultBreadcrumbs />
        ) : (
          props.breadcrumb
        )
      }
      headerProps={{
        className: hideTitleOnPrint === true ? "hideOnPrint" : undefined,
        sx: {
          padding: "5px 24px 0px",
          display: "flex",
          flexWrap: "wrap",
          ".MuiCardHeader-action": {
            alignSelf: "center",
          },
        },
      }}
      headerButtonProps={{
        alignItems: "center",
        ...props.headerButtonProps,
      }}
      wrapperProps={{
        sx: {
          backgroundColor: "transparent",
          backgroundImage: "none",
          boxShadow: "none",
          // ...props.wrapperProps?.sx,
        },
      }}
    >
      {/* Render content directly — no simplebar wrapper. The old
          <Scrollbar> created a `display:flex;flex-direction:column` context that
          broke MUI DataGrid's `autoHeight` (grid capped instead of growing to
          fit all rows), so the list looked truncated with no way to scroll. */}
      <Box sx={{ width: "100%" }}>{children}</Box>
    </List>
  );
};
