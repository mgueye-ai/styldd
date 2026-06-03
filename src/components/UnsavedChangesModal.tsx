import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../theme';

const STYLD_ICON = require('../../assets/icon.png') as ImageSourcePropType;

type Props = {
  visible: boolean;
  title: string;
  message: string;
  showSave: boolean;
  saving?: boolean;
  onStay: () => void;
  onSave?: () => void;
  onDiscard: () => void;
};

export default function UnsavedChangesModal({
  visible,
  title,
  message,
  showSave,
  saving = false,
  onStay,
  onSave,
  onDiscard,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onStay}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onStay} accessibilityLabel="Keep editing" />

        <View style={styles.card}>
          <View style={styles.brandRow}>
            <Image source={STYLD_ICON} style={styles.brandIcon} resizeMode="cover" />
            <Text style={styles.brandName}>Styld</Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            {showSave && onSave ? (
              <Pressable
                style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
                onPress={onSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.primaryBtnText}>Save changes</Text>
                )}
              </Pressable>
            ) : null}

            <Pressable style={styles.secondaryBtn} onPress={onStay} disabled={saving}>
              <Text style={styles.secondaryBtnText}>Keep editing</Text>
            </Pressable>

            <Pressable style={styles.ghostBtn} onPress={onDiscard} disabled={saving}>
              <Text style={styles.ghostBtnText}>Leave without saving</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.accentPinkBorder,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    shadowColor: colors.accentPink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  brandName: {
    color: colors.accentPink,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  message: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  actions: {
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: colors.accentPink,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryBtnDisabled: {
    opacity: 0.75,
  },
  primaryBtnText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.background,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  ghostBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  ghostBtnText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
});
