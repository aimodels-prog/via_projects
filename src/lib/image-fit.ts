/** Fixed source-master photo boxes, in PDF points. Keep in sync with Salalah geometry. */
export const PDF_PHOTO_RATIOS = [108 / 81, 105.48 / 87.12, 110.28 / 85.56, 106.8 / 86.52] as const;

/** Percentage positioning matches CSS object-position for the same frame ratio. */
export function photoPresentation(photo: {
  fit?: "cover" | "contain" | undefined;
  focalX?: number | undefined;
  focalY?: number | undefined;
}) {
  const clamp = (v: number | undefined) =>
    Number.isFinite(v) ? Math.max(0, Math.min(100, v!)) : 50;
  return {
    fit: photo.fit === "contain" ? ("contain" as const) : ("cover" as const),
    x: photo.fit === "contain" ? 50 : clamp(photo.focalX),
    y: photo.fit === "contain" ? 50 : clamp(photo.focalY),
  };
}

export function coverCrop(width: number, height: number, ratio: number, x = 50, y = 50) {
  if (![width, height, ratio].every((v) => Number.isFinite(v) && v > 0))
    throw new Error("Invalid image dimensions");
  const cropWidth = Math.max(1, Math.min(width, Math.round(height * ratio)));
  const cropHeight = Math.max(1, Math.min(height, Math.round(width / ratio)));
  const position = photoPresentation({ focalX: x, focalY: y });
  return {
    left: Math.round(((width - cropWidth) * position.x) / 100),
    top: Math.round(((height - cropHeight) * position.y) / 100),
    width: cropWidth,
    height: cropHeight,
  };
}
