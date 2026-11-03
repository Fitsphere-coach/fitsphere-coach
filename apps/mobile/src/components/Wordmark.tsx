// "FIT" + "SPHERE" (accent) and the COACH tag (CF01-coach-auth-ui.md §1).
import { StyleSheet, Text, View } from 'react-native';
import { fonts, radius, useTheme } from '../theme';

export function Wordmark() {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel="FitSphere Coach">
      <Text style={[styles.word, { color: colors.ink }]}>
        FIT<Text style={{ color: colors.accent }}>SPHERE</Text>
      </Text>
      <View style={[styles.tag, { borderColor: colors.accent }]}>
        <Text style={[styles.tagText, { color: colors.accent }]}>COACH</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44 },
  word: { fontFamily: fonts.display, fontSize: 18, letterSpacing: 3 },
  tag: { borderWidth: 1.5, borderRadius: radius.xs, paddingHorizontal: 5, paddingTop: 1 },
  tagText: { fontFamily: fonts.display, fontSize: 11, letterSpacing: 2 },
});
