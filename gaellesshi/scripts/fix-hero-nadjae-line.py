"""
Remove a thin vertical seam / magenta guide line from assets/hero-nadjae.png.
The artifact columns cluster around ~600 (not always geometric image center).
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "hero-nadjae.png"
BAK = ROOT / "assets" / "hero-nadjae.before-inpaint.png"


def main() -> int:
  if not SRC.exists():
    print("Missing", SRC, file=sys.stderr)
    return 1

  shutil.copy2(SRC, BAK)

  bgra = cv2.imread(str(SRC), cv2.IMREAD_UNCHANGED)
  if bgra is None:
    print("Could not read image", file=sys.stderr)
    return 1

  alpha = bgra[:, :, 3] if bgra.shape[2] == 4 else None
  bgr = cv2.cvtColor(bgra, cv2.COLOR_BGRA2BGR)

  blur = cv2.medianBlur(bgr, 5)
  diff = cv2.cvtColor(cv2.absdiff(bgr, blur), cv2.COLOR_BGR2GRAY)
  _, spike = cv2.threshold(diff, 22, 255, cv2.THRESH_BINARY)

  h, w = spike.shape
  # Artifact cluster from analysis (avoid inpainting unrelated edges at ~329, ~1200)
  x0, x1 = 585, 620
  col_strip = np.zeros_like(spike)
  col_strip[:, x0:x1] = 255
  mask = cv2.bitwise_and(spike, col_strip)

  hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
  s = hsv[:, :, 1]
  # Drop low-saturation (natural edges / noise)
  mask = cv2.bitwise_and(mask, cv2.inRange(s, 40, 255))

  mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=1)

  if int(mask.sum()) < 100:
    print("Mask too small; aborting to avoid damaging the image.", file=sys.stderr)
    shutil.copy2(BAK, SRC)
    return 1

  out = cv2.inpaint(bgr, mask, 3, cv2.INPAINT_TELEA)

  if alpha is not None:
    out_bgra = cv2.cvtColor(out, cv2.COLOR_BGR2BGRA)
    out_bgra[:, :, 3] = alpha
    cv2.imwrite(str(SRC), out_bgra)
  else:
    cv2.imwrite(str(SRC), out)

  print("Wrote", SRC)
  print("Backup at", BAK)
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
