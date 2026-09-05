import { Link as RouterLink } from "react-router";
import { Breadcrumbs, Link, Typography } from "@mui/material";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";

export type Crumb = { label: string; href?: string };

/**
 * Explicit breadcrumb trail. Pages pass their own items rather than relying on
 * Refine's resource-derived breadcrumb, because the prototype routes with plain
 * react-router.
 */
export function AppBreadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <Breadcrumbs
      separator={<NavigateNextIcon fontSize="small" />}
      aria-label="breadcrumb"
      sx={{ "& .MuiBreadcrumbs-li": { display: "flex", alignItems: "center" } }}
    >
      <Link
        component={RouterLink}
        to="/students"
        color="inherit"
        underline="hover"
        sx={{ display: "flex", alignItems: "center" }}
      >
        <HomeRoundedIcon sx={{ fontSize: 18 }} />
      </Link>
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return last || !c.href ? (
          <Typography key={i} color="text.primary" variant="body2" sx={{ fontWeight: last ? 600 : 400 }}>
            {c.label}
          </Typography>
        ) : (
          <Link
            key={i}
            component={RouterLink}
            to={c.href}
            color="inherit"
            underline="hover"
            variant="body2"
          >
            {c.label}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
}
