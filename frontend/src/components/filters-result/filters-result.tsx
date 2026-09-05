import type { ChipProps } from '@mui/material/Chip';
import type { Theme, SxProps } from '@mui/material/styles';

import Button from '@mui/material/Button';
import { styled } from '@mui/material/styles';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export const chipProps: ChipProps = { size: 'small', variant: 'soft' };

export type FiltersResultProps = React.ComponentProps<'div'> & {
  totalResults: number;
  onReset?: () => void;
  sx?: SxProps<Theme>;
  hasFilters?: boolean;
  children?: React.ReactNode;
};

export function FiltersResult({
  sx,
  onReset,
  children,
  totalResults,
  hasFilters,
  ...other
}: FiltersResultProps) {
  return (
    <ResultRoot sx={sx} {...other}>
      <ResultLabel>
        <strong>{totalResults}</strong>
        <span> results found</span>
      </ResultLabel>
      {hasFilters && (
        <ResultContent>
          {children}
          <Button
            color="error"
            onClick={onReset}
            startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
          >
            Clear
          </Button>
        </ResultContent>
      )}
    </ResultRoot>
  );
}

// ----------------------------------------------------------------------

const ResultRoot = styled('div')``;

const ResultLabel = styled('div')(({ theme }) => ({
  ...theme.typography.body2,
  marginBottom: theme.spacing(1.5),
  '& span': { color: theme.vars.palette.text.secondary },
}));

const ResultContent = styled('div')(({ theme }) => ({
  flexGrow: 1,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.spacing(1),
}));
