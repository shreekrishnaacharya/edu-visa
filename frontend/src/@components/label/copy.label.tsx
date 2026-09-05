import React, { useState } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

interface CopyTextProps {
  displayText: string;
  copyText: string;
}

const CopyLabel: React.FC<CopyTextProps> = ({ displayText, copyText }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Tooltip title={copied ? 'Copied!' : 'Copy'} arrow>
      <Box
        onClick={handleCopy}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
        //   px: 1.5,
        //   py: 0.75,
        }}
      >
        <Typography variant="body2">
          {displayText}
        </Typography>
        <ContentCopyIcon fontSize="small" color="action" />
      </Box>
    </Tooltip>
  );
};

export default CopyLabel;
