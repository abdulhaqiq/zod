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
  fillColor,
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
  const halfStroke = hasBorder ? strokeWidth / 2 : 0;

  // Main path for both fill and stroke
  const mainPath =
    size.width > 0
      ? getSvgPath({
          width: size.width - (hasBorder ? strokeWidth : 0),
          height: size.height - (hasBorder ? strokeWidth : 0),
          cornerRadius: Math.max(cornerRadius - halfStroke, 0),
          cornerSmoothing,
          preserveSmoothing: true,
        })
      : null;

  return (
    <View style={[{ position: 'relative' }, style]} onLayout={onLayout}>
      {size.width > 0 && mainPath && (
        <Svg
          width={size.width}
          height={size.height}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <Path
            d={mainPath}
            fill={fillColor || 'transparent'}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            transform={`translate(${halfStroke}, ${halfStroke})`}
          />
        </Svg>
      )}
      {children}
    </View>
  );
}
