import { Edit, type EditProps } from "@refinedev/mui";
import { DefaultBreadcrumbs } from "../breadcrumb/breadcumb.default";

type Props = {} & EditProps;

export const RefineEditView = ({ children, ...props }: Props) => {
  return (
    <Edit
      canDelete={false}
      {...props}
      breadcrumb={
        props.breadcrumb == undefined ? (
          <DefaultBreadcrumbs />
        ) : (
          props.breadcrumb
        )
      }
      headerProps={{
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
          ...props.wrapperProps?.sx,
        },
      }}
    >
      {children}
    </Edit>
  );
};
