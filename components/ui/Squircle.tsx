import { getSvgPath } from 'figma-squircle';
import { useState } from 'react';
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native';
import { Path, Svg } from 'react-native-svg';

interface SquircleProps {
  cornerRadius: number;
  cornerSmoothing?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export default function Squircle({
  cornerRadius,
  cornerSmoothing = 1,
  fillColor = '#ffffff',
  strokeColor,
  strokeWidth = 1.5,
  style,
  children,
}: SquircleProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) {
      setSize({ width, height });
    }
  };

  const hasBorder = !!strokeColor;
  const inset = hasBorder ? strokeWidth : 0;

  // Outer path (border color) — full size
  const outerPath =
    size.width > 0 && hasBorder
      ? getSvgPath({
          width: size.width,
          height: size.height,
          cornerRadius,
          cornerSmoothing,
          preserveSmoothing: true,
        })
      : null;

  // Inner path (fill color) — inset so the border ring is fully visible
  const innerPath =
    size.width > 0
      ? getSvgPath({
          width: size.width - inset * 2,
          height: size.height - inset * 2,
          cornerRadius: Math.max(cornerRadius - inset, 0),
          cornerSmoothing,
          preserveSmoothing: true,
        })
      : null;

  return (
    <View style={[{ position: 'relative' }, style]} onLayout={onLayout}>
      {size.width > 0 && (
        <Svg
          width={size.width}
          height={size.height}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {/* Border layer */}
          {outerPath ? <Path d={outerPath} fill={strokeColor} /> : null}
          {/* Fill layer — translated inward by strokeWidth */}
          {innerPath ? (
            <Path
              d={innerPath}
              fill={fillColor}
              transform={`translate(${inset}, ${inset})`}
            />
          ) : null}
        </Svg>
      )}
      {children}
    </View>
  );
}
