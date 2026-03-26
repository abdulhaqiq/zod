/**
 * LI — drop-in replacement for <Ionicons> that renders Lineicons icons.
 *
 * Usage:
 *   import { Ionicons } from '@expo/vector-icons';
 *   <Ionicons name="heart" size={24} color={colors.text} />
 *
 * The `name` prop accepts the same strings you used with Ionicons.
 * The mapping lives in @/constants/icons.ts.
 */
import { ICON_MAP } from '@/constants/icons';
import { SvgXml } from 'react-native-svg';

interface LIProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: any;
}

export default function LI({ name, size = 24, color = '#000000', strokeWidth = 1.5, style }: LIProps) {
  const icon = ICON_MAP[name];
  if (!icon || !icon.svg) return null;

  let inner: string = icon.svg;

  if (icon.hasFill) {
    inner = inner.replace(/fill="\{color\}"/g, `fill="${color}"`);
  }
  if (icon.hasStroke) {
    inner = inner.replace(/stroke="\{color\}"/g, `stroke="${color}"`);
  }
  if (icon.hasStrokeWidth) {
    inner = inner.replace(/stroke-width="\{strokeWidth\}"/g, `stroke-width="${strokeWidth}"`);
  }

  const fillAttr   = icon.defaultFill  ?? 'none';
  const strokeAttr = icon.defaultStroke ?? 'none';

  // Lineicons SVG data uses non-standard `//>`  instead of `/>` — fix before parsing.
  const cleanInner = inner.replace(/\/\/>/g, '/>');

  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" width="${size}" height="${size}" fill="${fillAttr}" stroke="${strokeAttr}">${cleanInner}</svg>`;

  return <SvgXml xml={xml} width={size} height={size} style={style} />;
}
