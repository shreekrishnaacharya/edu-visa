import { useState, useCallback, useRef, useEffect } from 'react';

import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export function FullScreenButton({ containerRef }: { containerRef?: any }) {
  const [fullscreen, setFullscreen] = useState(false);
  const onToggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef ? containerRef.current?.requestFullscreen() : document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
      setFullscreen(false);
    }
  }, []);

  // useEffect(() => {
  //   return () => {
  //     if (document.exitFullscreen) {
  //       document.exitFullscreen();
  //       setFullscreen(false);
  //     }
  //   }
  // }, [])

  return (
    <Tooltip title={fullscreen ? 'Exit' : 'Full Screen'}>
      <IconButton onClick={onToggleFullScreen} color={fullscreen ? 'primary' : 'default'}>
        <Iconify
          icon={
            fullscreen
              ? 'solar:quit-full-screen-square-outline'
              : 'solar:full-screen-square-outline'
          }
        />
      </IconButton>
    </Tooltip>
  );
}
