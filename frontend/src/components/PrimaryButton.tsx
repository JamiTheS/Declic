import React from "react";
import { Pressable, Text, StyleSheet, ViewStyle, ActivityIndicator, View } from "react-native";
import * as Haptics from "expo-haptics";
import { FONTS, RADIUS, SPACING } from "@/src/theme/tokens";
import { useApp } from "@/src/context/AppContext";
import { useTheme } from "@/src/theme/ThemeContext";

type Props = {
  label: string;
  onPress: () => void;
  color?: string;
  textColor?: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: "solid" | "outline" | "ghost";
  style?: ViewStyle;
  testID?: string;
  haptic?: "light" | "medium" | "heavy";
};

export default function PrimaryButton({
  label,
  onPress,
  color,
  textColor,
  disabled,
  loading,
  variant = "solid",
  style,
  testID,
  haptic = "medium",
}: Props) {
  const { haptics } = useApp();
  const { colors } = useTheme();
  const bg = color ?? colors.brand;
  const fg = textColor ?? colors.onBrand;

  const handlePress = () => {
    if (disabled || loading) return;
    if (haptics) {
      const map = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
      };
      Haptics.impactAsync(map[haptic]).catch(() => {});
    }
    onPress();
  };

  const isOutline = variant === "outline";
  const isGhost = variant === "ghost";
  const lineColor = color ?? colors.onSurface;

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: isOutline || isGhost ? "transparent" : bg,
          borderColor: isOutline ? lineColor : "transparent",
          borderWidth: isOutline ? 1.5 : 0,
          opacity: disabled ? 0.4 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline || isGhost ? lineColor : fg} />
      ) : (
        <View style={styles.row}>
          <Text
            numberOfLines={1}
            style={[styles.label, { color: isOutline || isGhost ? lineColor : fg }]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 60,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  label: {
    fontFamily: FONTS.displaySemi,
    fontSize: 17,
    letterSpacing: 0.3,
  },
});
