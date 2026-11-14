export function getSquareCameraCrop(
  sourceWidth: number,
  sourceHeight: number,
  maxDimension: number,
) {
  const sourceSize = Math.min(sourceWidth, sourceHeight);

  return {
    sourceX: (sourceWidth - sourceSize) / 2,
    sourceY: (sourceHeight - sourceSize) / 2,
    sourceSize,
    outputSize: Math.min(sourceSize, maxDimension),
  };
}
