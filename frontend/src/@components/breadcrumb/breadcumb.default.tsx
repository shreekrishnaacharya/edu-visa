import {
  Breadcrumbs,
  Chip,
  emphasize,
  Grid2 as Grid,
  LinkProps,
  styled,
  Typography,
} from "@mui/material";
import {
  matchResourceFromRoute,
  useBreadcrumb,
  useLink,
  useResource,
  useRouterContext,
  useRouterType,
} from "@refinedev/core";
import MLink from "@mui/material/Link";
import HomeOutlined from "@mui/icons-material/HomeOutlined";

const StyledBreadcrumb = styled(Chip)(({ theme }) => {
  const backgroundColor =
    theme.palette.mode === "light"
      ? theme.palette.grey[100]
      : theme.palette.grey[800];
  return {
    backgroundColor,
    height: theme.spacing(3),
    color: theme.palette.text.primary,
    fontWeight: theme.typography.fontWeightRegular,
    "&:hover, &:focus": {
      backgroundColor: emphasize(backgroundColor, 0.06),
    },
    "&:active": {
      boxShadow: theme.shadows[1],
      backgroundColor: emphasize(backgroundColor, 0.12),
    },
  };
}) as typeof Chip; // TypeScript only: need a type cast here because https://github.com/Microsoft/TypeScript/issues/26591

export const DefaultBreadcrumbs = ({ title }: { title?: string }) => {
  const { breadcrumbs } = useBreadcrumb();
  const routerType = useRouterType();
  const NewLink = useLink();
  const { Link: LegacyLink } = useRouterContext();
  const { resources } = useResource();

  const rootRouteResource = matchResourceFromRoute("/", resources);

  const ActiveLink = routerType === "legacy" ? LegacyLink : NewLink;

  const LinkRouter = (props: LinkProps & { to?: string }) => (
    <MLink {...props} component={ActiveLink} />
  );
  const bLength = breadcrumbs.length - 1;
  return (
    <Breadcrumbs aria-label="breadcrumb">
      <LinkRouter
        underline="hover"
        sx={{
          display: "flex",
          alignItems: "center",
        }}
        color="inherit"
        to="/"
      >
        {rootRouteResource?.resource?.meta?.icon ?? (
          <HomeOutlined
            sx={{
              fontSize: "18px",
            }}
          />
        )}
      </LinkRouter>
      {breadcrumbs.map(({ label, icon, href }, i) => {
        return (
          <Grid
            key={`${i}-${label ?? href ?? ""}`}
            sx={{
              display: "flex",
              alignItems: "center",
              "& .MuiSvgIcon-root": {
                fontSize: "16px",
              },
            }}
          >
            {icon}
            {href ? (
              <LinkRouter
                underline="hover"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  fontSize: "14px",
                }}
                color="inherit"
                to={href}
                variant="subtitle1"
                marginLeft={0.5}
              >
                {label}
              </LinkRouter>
            ) : (
              <Typography fontSize="14px">
                {bLength == i ? title ?? label : label}
              </Typography>
            )}
          </Grid>
        );
      })}
    </Breadcrumbs>
  );
};
