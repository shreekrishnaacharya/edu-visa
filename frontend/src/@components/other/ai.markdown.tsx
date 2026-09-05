import type { ReactNode } from "react";
import { Box, Link as MuiLink, Typography } from "@mui/material";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders AI-generated answer text (assistant chat replies, per-course "AI
 * analysis") as formatted markdown instead of raw `**bold**` / `*   ` source
 * — the orchestrator's model (server/src/modules/assistant/orchestrator.service.ts)
 * writes markdown-flavoured prose, so this is what the counsellor actually
 * sees in the UI. GFM (tables, strikethrough) supported; no raw HTML is ever
 * rendered — untrusted model output only ever reaches the DOM through
 * react-markdown's own element mapping below, never `dangerouslySetInnerHTML`.
 */

// react-markdown's `children` prop type gets widened by this project's global
// react-i18next augmentation (ReactI18NextChildren) in a way plain MUI
// components don't accept — cast back to the real React type at the boundary.
const node = (children: unknown) => children as ReactNode;

const components: Components = {
  p: ({ children }) => (
    <Typography variant="body2" sx={{ mb: 1, "&:last-child": { mb: 0 } }}>
      {node(children)}
    </Typography>
  ),
  ul: ({ children }) => (
    <Box component="ul" sx={{ my: 1, pl: 2.5, "&:last-child": { mb: 0 } }}>
      {node(children)}
    </Box>
  ),
  ol: ({ children }) => (
    <Box component="ol" sx={{ my: 1, pl: 2.5, "&:last-child": { mb: 0 } }}>
      {node(children)}
    </Box>
  ),
  li: ({ children }) => (
    <Typography component="li" variant="body2" sx={{ mb: 0.25 }}>
      {node(children)}
    </Typography>
  ),
  h1: ({ children }) => (
    <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 1, mb: 0.5 }}>
      {node(children)}
    </Typography>
  ),
  h2: ({ children }) => (
    <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 1, mb: 0.5 }}>
      {node(children)}
    </Typography>
  ),
  h3: ({ children }) => (
    <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1, mb: 0.5 }}>
      {node(children)}
    </Typography>
  ),
  strong: ({ children }) => (
    <Box component="strong" sx={{ fontWeight: 700 }}>
      {node(children)}
    </Box>
  ),
  em: ({ children }) => <Box component="em">{node(children)}</Box>,
  a: ({ children, href }) => (
    <MuiLink href={href} target="_blank" rel="noreferrer">
      {node(children)}
    </MuiLink>
  ),
  code: ({ children }) => (
    <Box
      component="code"
      sx={{
        fontFamily: "monospace",
        fontSize: "0.85em",
        bgcolor: "action.hover",
        borderRadius: 0.5,
        px: 0.5,
      }}
    >
      {node(children)}
    </Box>
  ),
  blockquote: ({ children }) => (
    <Box sx={{ borderLeft: "3px solid", borderColor: "divider", pl: 1.5, my: 1, color: "text.secondary" }}>
      {node(children)}
    </Box>
  ),
  table: ({ children }) => (
    <Box sx={{ overflowX: "auto", my: 1 }}>
      <Box
        component="table"
        sx={{
          borderCollapse: "collapse",
          width: "100%",
          "& th, & td": { border: "1px solid", borderColor: "divider", px: 1, py: 0.5, fontSize: "0.8125rem" },
        }}
      >
        {node(children)}
      </Box>
    </Box>
  ),
};

export function AiMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}

export default AiMarkdown;
