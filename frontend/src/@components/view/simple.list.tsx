import { Scrollbar } from "@components/scrollbar";
import { Card, TableContainer } from "@mui/material";
import { List, type ListProps } from "@refinedev/mui";
import { DefaultBreadcrumbs } from "../breadcrumb/breadcumb.default";

type Props = {} & ListProps;

export const SimpleList = ({ children, ...props }: Props) => {
    return (
        <List
            {...props}
            breadcrumb={props.breadcrumb === undefined ? <DefaultBreadcrumbs /> : props.breadcrumb}
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
        </List>
    );
};
