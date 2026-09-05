import { ReactNode, useState } from "react";
import { NavLink, useLocation } from "react-router";
import {
  AppBar,
  Avatar,
  Box,
  Chip,
  Container,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import { getDemoUser, setDemoRole, type Role } from "../authProvider";

const NAV_WIDTH = 248;

const NAV = [
  { to: "/students", label: "Students", icon: <GroupsOutlinedIcon /> },
  { to: "/catalogue", label: "Course catalogue", icon: <SchoolOutlinedIcon /> },
];

export function MainLayout({ children }: { children: ReactNode }) {
  const user = getDemoUser();
  const { pathname } = useLocation();
  const theme = useTheme();
  const permanent = useMediaQuery(theme.breakpoints.up("lg"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const navContent = (
    <>
      <Toolbar />
      <List sx={{ px: 1, py: 2 }}>
        {NAV.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              selected={active}
              onClick={() => setMobileOpen(false)}
              sx={{ borderRadius: 1.5, mb: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: active ? "primary.main" : "inherit" }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontWeight: active ? 700 : 500, fontSize: 14 }}
              />
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ mt: "auto", p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Prototype · sample data · resets on reload
        </Typography>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: "divider", zIndex: (t) => t.zIndex.drawer + 1 }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          {!permanent && (
            <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <MenuIcon />
            </IconButton>
          )}
          <InsightsOutlinedIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: -0.3 }}>
            Edu&#8209;Visa
          </Typography>
          <Chip
            size="small"
            label="prototype"
            variant="outlined"
            sx={{ ml: 0.5, display: { xs: "none", sm: "inline-flex" } }}
          />
          <Box sx={{ flexGrow: 1 }} />
          <Select
            size="small"
            value={user.role}
            onChange={(e) => setDemoRole(e.target.value as Role)}
            sx={{ mr: { xs: 1, sm: 2 }, minWidth: { xs: 120, sm: 150 } }}
          >
            <MenuItem value="counsellor">Counsellor</MenuItem>
            <MenuItem value="branch_admin">Branch admin</MenuItem>
          </Select>
          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar src={user.avatar} sx={{ width: 32, height: 32 }} />
            <Box sx={{ display: { xs: "none", md: "block" } }}>
              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.1 }}>
                {user.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user.branch}
              </Typography>
            </Box>
          </Stack>
        </Toolbar>
      </AppBar>

      {permanent ? (
        <Drawer
          variant="permanent"
          sx={{
            width: NAV_WIDTH,
            flexShrink: 0,
            "& .MuiDrawer-paper": { width: NAV_WIDTH, boxSizing: "border-box", borderRight: 1, borderColor: "divider" },
          }}
        >
          {navContent}
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ "& .MuiDrawer-paper": { width: NAV_WIDTH, boxSizing: "border-box" } }}
        >
          {navContent}
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          width: { lg: `calc(100% - ${NAV_WIDTH}px)` },
        }}
      >
        <Toolbar />
        <Container maxWidth="xl" sx={{ py: 3, px: { xs: 1.5, sm: 3 } }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
}
