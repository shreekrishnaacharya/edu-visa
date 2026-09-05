import type { LinkProps } from '@mui/material/Link';

import { useId, forwardRef } from 'react';
import { mergeClasses } from 'minimal-shared/utils';

import Link from '@mui/material/Link';
import { styled, useTheme } from '@mui/material/styles';

import { RouterLink } from 'src/routes/components';

import { logoClasses } from './classes';
import { CONFIG } from 'src/global-config';

// ----------------------------------------------------------------------

export type LogoProps = LinkProps & {
  isSingle?: boolean;
  disabled?: boolean;
};

export const Logo = forwardRef<HTMLAnchorElement, LogoProps>((props, ref) => {
  const { className, href = '/', isSingle = true, disabled, sx, ...other } = props;

  // const theme = useTheme();

  // const gradientId = useId();

  // const TEXT_PRIMARY = theme.vars.palette.text.primary;
  // const PRIMARY_LIGHT = theme.vars.palette.primary.light;
  // const PRIMARY_MAIN = theme.vars.palette.primary.main;
  // const PRIMARY_DARKER = theme.vars.palette.primary.dark;


  const singleLogo = (
    <img
      alt="Single logo"
      src={`${CONFIG.assetsDir}/logo/logo-single.svg`}
      width="100%"
      height="100%"
    />
  );

  const fullLogo = (
    <img
      alt="Full logo"
      src={`${CONFIG.assetsDir}/logo/logo-full.svg`}
      width="100%"
      height="100%"
    />
  );
  return (
    <LogoRoot
      ref={ref}
      component={RouterLink}
      href={href}
      aria-label="Logo"
      underline="none"
      className={mergeClasses([logoClasses.root, className])}
      sx={[
        () => ({
          width: 40,
          height: 40,
          ...(!isSingle && { width: 150, height: 36 }),
          ...(disabled && { pointerEvents: 'none' }),
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {isSingle ? singleLogo : fullLogo}
    </LogoRoot>
  );
});

// ----------------------------------------------------------------------

const LogoRoot = styled(Link)(() => ({
  flexShrink: 0,
  color: 'transparent',
  display: 'inline-flex',
  verticalAlign: 'middle',
}));
