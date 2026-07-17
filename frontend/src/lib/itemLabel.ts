export type VisualAttributes = {
  fit: string | null;
  garmentType: string;
  pattern: string | null;
  primaryColor: string;
  secondaryColors: string[];
};

type LabelableItem = {
  correctedCategory?: string | null;
  correctedColor?: string | null;
  detectedCategory: string | null;
  detectedColor: string | null;
  visualAttributes: VisualAttributes | null;
};

const DEFAULT_ITEM_LABEL = "Unlabeled item";

export function formatVisualAttribute(value: string): string {
  return value
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatVisualAttributesLabel(
  visualAttributes: VisualAttributes,
): string {
  const colors = [
    visualAttributes.primaryColor,
    visualAttributes.secondaryColors[0],
  ]
    .filter((color): color is string => Boolean(color))
    .filter((color) => color.trim())
    .map(formatVisualAttribute)
    .join("/");
  const garmentType = formatVisualAttribute(visualAttributes.garmentType);

  return colors ? `${colors} ${garmentType}` : garmentType;
}

export function formatFallbackItemLabel(item: LabelableItem): string | null {
  const category = item.correctedCategory ?? item.detectedCategory;
  const color = item.correctedColor ?? item.detectedColor;

  if (!category || !color) {
    return null;
  }

  return `${formatVisualAttribute(color)} ${formatVisualAttribute(category)}`;
}

export function formatItemDisplayLabel(item: LabelableItem): string {
  return item.visualAttributes
    ? formatVisualAttributesLabel(item.visualAttributes)
    : formatFallbackItemLabel(item) ?? DEFAULT_ITEM_LABEL;
}
