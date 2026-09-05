import React from "react";
import { Box, Typography, Divider } from "@mui/material";
import { IOrgDetails } from "src/interfaces";
import { ORG_DETAIL } from "@common/options";

interface CompanyHeaderProps {
  title?: string;
  /** Show on screen too (e.g. inside a print-preview dialog); default keeps
   * the original print-only behavior. */
  alwaysVisible?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const formatDate = (): string =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

const buildContactLine = (org: IOrgDetails): string => {
  const parts: string[] = [];
  if (org.phone1) parts.push(org.phone1);
  if (org.phone2) parts.push(org.phone2);
  if (org.email1) parts.push(org.email1);
  if (org.email2) parts.push(org.email2);
  return parts.join("  |  ");
};

// ── Component ──────────────────────────────────────────────────────────────
export const PrintHeader: React.FC<CompanyHeaderProps> = ({
  title,
  alwaysVisible,
}) => {
  const orgDetailRaw = localStorage.getItem(ORG_DETAIL);
  let orgDetail = {} as IOrgDetails;
  if (orgDetailRaw) {
    try {
      orgDetail = JSON.parse(orgDetailRaw) as IOrgDetails;
    } catch {}
  }
  if (!orgDetail) {
    orgDetail = {
      address: "Kathmandu 14, Kalanki, Nepal",
      code: "AEIMS",
      email1: "info@acharyatech.com",
      email2: "",
      name: "Acharya Technologies",
      phone1: "",
      phone2: "",
      regid: "12345",
    } as IOrgDetails;
  } else {
  }
  const contactLine = buildContactLine(orgDetail);
  const [imgError, setImgError] = React.useState(false);

  return (
    <Box
      sx={{
        alignItems: "flex-start",
        width: "100%",
        padding: "20px 24px 16px",
        backgroundColor: "#fff",
        borderBottom: "1.5px solid #000",
        display: alwaysVisible ? "flex" : "none", // hidden on screen by default
        "@media print": {
          display: "flex", // appears and occupies space only when printing
        },
      }}
    >
      {/* ── Logo (left) ── */}

      {!imgError && orgDetail.image && (
        <Box
          sx={{
            flexShrink: 0,
            position:"absolute",
            left:"10%",
            width: 72,
            height: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mr: 3,
            mt: "2px",
            overflow: "hidden",
          }}
        >
          <Box
            component="img"
            src={orgDetail.image?.url}
            alt={orgDetail.name}
            onError={() => setImgError(true)}
            sx={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </Box>
      )}

      {/* ── Center content ── */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        {/* Company Name */}
        <Typography
          sx={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontWeight: 700,
            fontSize: "1.35rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#000",
            lineHeight: 1.2,
          }}
        >
          {orgDetail.name}
        </Typography>

        {/* Address */}
        <Typography
          sx={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "0.8rem",
            color: "#000",
            letterSpacing: "0.02em",
            lineHeight: 1.5,
          }}
        >
          {orgDetail.address}
        </Typography>

        {/* Contact — only if any value exists */}
        {contactLine && (
          <Typography
            sx={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "0.78rem",
              color: "#000",
              letterSpacing: "0.02em",
              mt: 0.3,
            }}
          >
            {contactLine}
          </Typography>
        )}

        {/* Date */}
        <Typography
          sx={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "0.7rem",
            color: "#000",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            mt: 1,
            pt: 0.75,
            width: "100%",
          }}
        >
          {formatDate()}
        </Typography>

        {/* Document / Report Title */}
        {title && (
          <Typography
            sx={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontWeight: 700,
              fontSize: "0.98rem",
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "#000",
              mt: 0.75,
            }}
          >
            {title}
          </Typography>
        )}
      </Box>
    </Box>
  );
};
