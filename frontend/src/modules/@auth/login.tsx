import { useState } from "react";
import { useLogin } from "@refinedev/core";
import {
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { PROJECT_TITLE } from "@common/options";

// Convenience shortcuts for this dev/demo deployment — still a real login()
// call with real credentials, just pre-filled, not a silent auto-sign-in.
const DEMO_ACCOUNTS = [
  { label: "Counsellor", email: "bina.rai@edu-visa.local" },
  { label: "Branch admin", email: "branch.admin@edu-visa.local" },
  { label: "Super admin", email: "admin@edu-visa.local" },
];
const DEMO_PASSWORD = "password123";

export function LoginPage() {
  const { mutate: login, isLoading } = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent, values?: { email: string; password: string }) => {
    e.preventDefault();
    setError(null);
    login(values ?? { email, password }, {
      onError: (err: any) => setError(err?.message ?? "Invalid email or password."),
    });
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      <Paper variant="outlined" sx={{ p: 4, borderRadius: 2, width: 380, maxWidth: "100%" }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          {PROJECT_TITLE}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Sign in to continue
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={submit}>
          <Stack spacing={2}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              fullWidth
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              fullWidth
            />
            <Button type="submit" variant="contained" size="large" disabled={isLoading} fullWidth>
              {isLoading ? "Signing in…" : "Sign in"}
            </Button>
          </Stack>
        </Box>

        <Divider sx={{ my: 3 }}>
          <Typography variant="caption" color="text.secondary">
            demo accounts (password: {DEMO_PASSWORD})
          </Typography>
        </Divider>

        <Stack spacing={1}>
          {DEMO_ACCOUNTS.map((acc) => (
            <Button
              key={acc.email}
              variant="outlined"
              size="small"
              disabled={isLoading}
              onClick={(e) => submit(e, { email: acc.email, password: DEMO_PASSWORD })}
            >
              Sign in as {acc.label}
            </Button>
          ))}
        </Stack>
      </Paper>
    </Box>
  );
}
