// The design-system components the CF01 screens use (docs/design/design-system.md, "Components").
import Feather from '@expo/vector-icons/Feather';
import { useState, type ComponentProps, type ComponentRef, type ReactNode, type Ref } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, radius, useTheme } from '../theme';
import { Wordmark } from './Wordmark';

export type IconName = ComponentProps<typeof Feather>['name'];
/** What `ref` on a Field points at (focus the next field). */
export type InputRef = ComponentRef<typeof TextInput>;

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: string }) {
  return <Feather name={name} size={size} color={color} accessibilityElementsHidden importantForAccessibility="no" />;
}

/**
 * The signature corner: diagonal Caramel stripes in a triangle at the top right (design system,
 * "Signature corner"). Drawn with plain views so it works in Expo Go: a square turned 45° around
 * the corner shows exactly the triangle (80,0)–(200,0)–(200,120) inside the 200×200 box, and its
 * vertical bars are the 4 px stripes, 14 px apart, at 45° on screen.
 */
const STRIPE_SIDE = 120 * Math.SQRT2;
const STRIPE_BARS = Array.from({ length: Math.ceil(STRIPE_SIDE / 14) }, (_, index) => index);

export function Stripes() {
  const { colors } = useTheme();
  return (
    <View pointerEvents="none" style={styles.stripes} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.stripeSquare}>
        {STRIPE_BARS.map((bar) => (
          <View key={bar} style={[styles.stripeBar, { backgroundColor: colors.stripe }]} />
        ))}
      </View>
    </View>
  );
}

/**
 * The shared auth layout (CF01 §3): stripes, a 44 px top bar with an optional back chevron and the
 * wordmark, the content, and a footer pinned to the bottom above the keyboard.
 */
export function AuthLayout({ onBack, children, footer }: { onBack?: () => void; children: ReactNode; footer?: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stripes />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.authContent, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 }]}
      >
        <View style={styles.topBar}>
          {onBack ? (
            <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.back} hitSlop={8}>
              <Icon name="chevron-left" size={26} color={colors.ink} />
            </Pressable>
          ) : null}
          <Wordmark />
        </View>
        {children}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** A pushed screen: back with a muted label, then a screen title (e.g. Change password). */
export function PushedLayout({ backLabel, onBack, title, children }: { backLabel: string; onBack: () => void; title: string; children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.pushedContent, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 }]}
      >
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={`Back to ${backLabel}`} style={styles.pushedBack}>
          <Icon name="chevron-left" size={26} color={colors.ink} />
          <Text style={[styles.label, { color: colors.inkMuted, fontSize: 15 }]}>{backLabel.toUpperCase()}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[styles.screenTitle, { color: colors.ink }]}>
          {title.toUpperCase()}
        </Text>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Two-line display heading; the second line is in accent (never italic). */
export function Heading({ first, second, step, sub }: { first: string; second: string; step?: string; sub?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.heading}>
      {step ? <Text style={[styles.step, { color: colors.accent }]}>{step.toUpperCase()}</Text> : null}
      <Text accessibilityRole="header" style={[styles.display, { color: colors.ink }]}>
        {first.toUpperCase()}
        {'\n'}
        <Text style={{ color: colors.accent }}>{second.toUpperCase()}</Text>
      </Text>
      {sub ? <Text style={[styles.body, { color: colors.inkMuted }]}>{sub}</Text> : null}
    </View>
  );
}

/** An inline value inside body text (Barlow 600). */
export function Strong({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <Text style={{ fontFamily: fonts.bodySemiBold, color: colors.ink }}>{children}</Text>;
}

type FieldProps = Omit<TextInputProps, 'style'> & {
  ref?: Ref<InputRef>;
  label: string;
  error?: string | null;
  hint?: string;
  password?: boolean;
  /** Shown at the right of the label row (e.g. "Forgot password?"). */
  labelAction?: ReactNode;
};

export function Field({ label, error, hint, password, labelAction, editable = true, ...input }: FieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.accent : colors.border;
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.inkMuted }]}>
          {label.toUpperCase()}
        </Text>
        {labelAction}
      </View>
      <View>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.inkSubtle}
          secureTextEntry={password && !shown}
          autoCapitalize={password ? 'none' : input.autoCapitalize}
          autoCorrect={password ? false : input.autoCorrect}
          editable={editable}
          {...input}
          onFocus={(event) => {
            setFocused(true);
            input.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            input.onBlur?.(event);
          }}
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceSunken,
              borderColor,
              color: colors.ink,
              letterSpacing: password && !shown ? 2 : 0,
              paddingRight: password ? 52 : 14,
              opacity: editable ? 1 : 0.6,
            },
          ]}
        />
        {password ? (
          <Pressable
            onPress={() => setShown((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={shown ? 'Hide password' : 'Show password'}
            style={styles.eye}
          >
            <Icon name={shown ? 'eye-off' : 'eye'} color={colors.inkMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Icon name="alert-circle" size={16} color={colors.danger} />
          <Text style={[styles.small, { color: colors.danger, flex: 1 }]}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={[styles.small, { color: colors.inkMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** Three segments plus the live rule list (one segment per met rule). */
export function PasswordStrength({ rules }: { rules: { label: string; met: boolean }[] }) {
  const { colors } = useTheme();
  const met = rules.filter((rule) => rule.met).length;
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.segments} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {rules.map((rule, index) => (
          <View key={rule.label} style={[styles.segment, { backgroundColor: index < met ? colors.success : colors.track }]} />
        ))}
      </View>
      {rules.map((rule) => (
        <View key={rule.label} style={styles.rule} accessible accessibilityLabel={`${rule.label}: ${rule.met ? 'done' : 'not yet'}`}>
          {rule.met ? <Icon name="check" size={15} color={colors.success} /> : <View style={[styles.dot, { backgroundColor: colors.inkMuted }]} />}
          <Text style={[styles.small, { color: rule.met ? colors.success : colors.inkMuted }]}>{rule.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function CheckBox({ checked, onChange, children, label }: { checked: boolean; onChange: (value: boolean) => void; children: ReactNode; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={styles.checkRow}
    >
      <View
        style={[
          styles.box,
          { backgroundColor: checked ? colors.primary : colors.surfaceSunken, borderColor: checked ? colors.primary : colors.border },
        ]}
      >
        {checked ? <Icon name="check" size={15} color={colors.onPrimary} /> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  arrow,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  arrow?: boolean;
}) {
  const { colors } = useTheme();
  const inactive = Boolean(disabled || loading);
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: pressed ? colors.primaryPressed : colors.primary, opacity: disabled ? 0.4 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <>
          <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{label.toUpperCase()}</Text>
          {arrow ? <Icon name="arrow-right" size={20} color={colors.onPrimary} /> : null}
        </>
      )}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.secondary,
        { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceRaised : 'transparent', opacity: disabled ? 0.4 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, { fontSize: 18, color: colors.ink }]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

export function TextLink({ label, onPress, size = 15 }: { label: string; onPress: () => void; size?: number }) {
  const { colors } = useTheme();
  return (
    <Text onPress={onPress} accessibilityRole="link" suppressHighlighting style={[styles.link, { color: colors.accent, fontSize: size }]}>
      {label.toUpperCase()}
    </Text>
  );
}

export function Banner({ kind, children }: { kind: 'info' | 'success' | 'error'; children: ReactNode }) {
  const { colors } = useTheme();
  const look = {
    info: { background: colors.accentTint, border: 'transparent', icon: 'info' as const, iconColor: colors.accent },
    success: { background: colors.successTint, border: colors.success, icon: 'check' as const, iconColor: colors.success },
    error: { background: colors.dangerTint, border: colors.danger, icon: 'alert-circle' as const, iconColor: colors.danger },
  }[kind];
  return (
    <View
      accessibilityRole={kind === 'error' ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: look.background, borderColor: look.border }]}
    >
      <Icon name={look.icon} size={18} color={look.iconColor} />
      <Text style={[styles.small, { color: colors.ink, flex: 1, fontSize: 14 }]}>{children}</Text>
    </View>
  );
}

export function IconTile({ name, size = 72, tone = 'accent' }: { name: IconName; size?: number; tone?: 'accent' | 'success' }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, backgroundColor: tone === 'success' ? colors.successTint : colors.accentTint },
      ]}
    >
      <Icon name={name} size={Math.round(size * 0.47)} color={tone === 'success' ? colors.success : colors.accent} />
    </View>
  );
}

/** A bottom sheet over the screen (design system "Bottom sheet"). Scrim tap or back cancels. */
export function Sheet({ visible, onClose, children, labelledBy }: { visible: boolean; onClose: () => void; children: ReactNode; labelledBy: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={onClose} accessibilityLabel="Close" />
      <View
        accessibilityViewIsModal
        accessibilityLabel={labelledBy}
        style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 34 }]}
      >
        <Stripes />
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        {children}
      </View>
    </Modal>
  );
}

export const textStyles = {
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  listTitle: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: fonts.displayBold, fontSize: 13, lineHeight: 16, letterSpacing: 1.5 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 36, lineHeight: 38 },
};

const styles = StyleSheet.create({
  stripes: { position: 'absolute', top: 0, right: 0, width: 200, height: 200, overflow: 'hidden' },
  stripeSquare: {
    position: 'absolute',
    width: STRIPE_SIDE,
    height: STRIPE_SIDE,
    left: 200 - STRIPE_SIDE / 2,
    top: -STRIPE_SIDE / 2,
    flexDirection: 'row',
    gap: 10,
    overflow: 'hidden',
    transform: [{ rotate: '45deg' }],
  },
  stripeBar: { width: 4, height: STRIPE_SIDE },
  authContent: { flexGrow: 1, paddingHorizontal: 20 },
  pushedContent: { flexGrow: 1, paddingHorizontal: 16 },
  topBar: { height: 44, justifyContent: 'center' },
  back: { position: 'absolute', left: -10, top: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  pushedBack: { height: 44, flexDirection: 'row', alignItems: 'center', marginLeft: -10, alignSelf: 'flex-start', paddingRight: 8 },
  screenTitle: { fontFamily: fonts.display, fontSize: 40, lineHeight: 40, marginTop: 12 },
  footer: { marginTop: 'auto', paddingTop: 24, gap: 16, alignItems: 'stretch' },
  heading: { marginTop: 28, gap: 10 },
  step: { fontFamily: fonts.displayBold, fontSize: 14, letterSpacing: 2 },
  display: { fontFamily: fonts.display, fontSize: 48, lineHeight: 46 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  field: { gap: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 20 },
  label: { fontFamily: fonts.displayBold, fontSize: 13, lineHeight: 16, letterSpacing: 1.5 },
  input: { height: 54, borderWidth: 1.5, borderRadius: radius.sm, paddingLeft: 14, fontFamily: fonts.body, fontSize: 17 },
  eye: { position: 'absolute', right: 5, top: 5, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  errorRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  segments: { flexDirection: 'row', gap: 4, marginTop: 2 },
  segment: { flex: 1, height: 4, borderRadius: radius.xs },
  rule: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, marginHorizontal: 5 },
  checkRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', minHeight: 44, paddingVertical: 2 },
  box: { width: 22, height: 22, borderWidth: 1.5, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  primary: { height: 56, borderRadius: radius.sm, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  secondary: { height: 52, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: fonts.display, fontSize: 20, letterSpacing: 1.5 },
  link: { fontFamily: fonts.display, letterSpacing: 1 },
  banner: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: radius.sm, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14 },
  tile: { borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: 10, paddingHorizontal: 20, overflow: 'hidden' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
});
