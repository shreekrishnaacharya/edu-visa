import React from 'react';
import { Box, Typography, styled } from '@mui/material';
import { CONFIG } from 'src/global-config';

interface EmptyDataProps {
  height?: string | number;
  title?: string;
  description?: string;
  imgUrl?: string;
  action?: React.ReactNode;
  filled?: boolean;
}

const ContentRoot = styled('div', {
  shouldForwardProp: (prop: string) => !['filled'].includes(prop),
})<{ filled?: boolean }>(({ filled, theme }) => ({
  flexGrow: 1,
  display: 'flex',
  alignItems: 'center',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: theme.spacing(0, 3),
  ...(filled && {
    borderRadius: theme.shape.borderRadius * 2,
    backgroundColor: 'rgba(145,158,171,0.04)',
    border: 'dashed 1px rgba(145,158,171,0.12)',
  }),
}));

const EmptyData = ({
  height = '100vh',
  title = 'No data',
  description,
  imgUrl,
  action,
  filled,
}: EmptyDataProps) => (
  <ContentRoot filled={filled} style={{ height: height as string }}>
    <Box
      component="img"
      alt="Empty"
      src={imgUrl ?? `${CONFIG.assetsDir}/assets/icons/empty/ic-content.svg`}
      sx={{ width: 1, maxWidth: 160, mb: 1 }}
    />
    <Typography variant="h6" sx={{ textAlign: 'center', color: 'text.disabled' }}>
      {title}
    </Typography>
    {description && (
      <Typography variant="body2" sx={{ mt: 0.5, textAlign: 'center', color: 'text.disabled' }}>
        {description}
      </Typography>
    )}
    {action && <Box mt={2}>{action}</Box>}
  </ContentRoot>
);

export default EmptyData;

