/**
 * usePopupPosition
 * ─────────────────────────────────────────────────────────────────────────────
 * Computes a `position: fixed` popup position that never overflows the viewport,
 * matching MUI's Popper auto-placement behaviour.
 *
 * Strategy:
 *  1. Default: open BELOW the anchor, left-aligned.
 *  2. Right overflow  → shift left so right edge stays inside viewport.
 *  3. Bottom overflow → flip ABOVE the anchor instead.
 *  4. Top overflow (after flip) → clamp to top of viewport.
 *
 * Usage:
 *   const { pos, computePos } = usePopupPosition();
 *   // call computePos(anchorRef, popupRef) just before opening
 *   <Box sx={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}>
 */

import React from "react";

export interface PopupPos {
  top: number;
  left: number;
}

const MARGIN = 8; // min gap from viewport edge (px)

export function usePopupPosition() {
  const [pos, setPos] = React.useState<PopupPos>({ top: 0, left: 0 });

  /**
   * Compute and store the best position for the popup.
   *
   * @param anchorEl  — the trigger element (input / container)
   * @param popupW    — estimated popup width in px  (default 300)
   * @param popupH    — estimated popup height in px (default 400)
   */
  const computePos = React.useCallback(
    (anchorEl: HTMLElement | null, popupW = 300, popupH = 400) => {
      if (!anchorEl) return;

      const rect = anchorEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // ── Horizontal: prefer left-aligned, shift left if right edge overflows ──
      let left = rect.left;
      if (left + popupW + MARGIN > vw) {
        left = Math.max(MARGIN, vw - popupW - MARGIN);
      }

      // ── Vertical: prefer below, flip above if bottom overflows ──────────────
      const spaceBelow = vh - rect.bottom;
      const spaceAbove = rect.top;

      let top: number;
      if (spaceBelow >= popupH + MARGIN || spaceBelow >= spaceAbove) {
        // open below (default)
        top = rect.bottom + 4;
        // clamp if still overflows bottom
        if (top + popupH + MARGIN > vh) {
          top = Math.max(MARGIN, vh - popupH - MARGIN);
        }
      } else {
        // flip above
        top = rect.top - popupH - 4;
        // clamp if overflows top
        if (top < MARGIN) top = MARGIN;
      }

      setPos({ top, left });
    },
    [],
  );

  return { pos, computePos };
}
