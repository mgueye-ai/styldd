import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../../theme';
import { formatTimeRange, TimeRange } from './timelineUtils';

type BlockTimeSheetProps = {
  visible: boolean;
  range: TimeRange | null;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (input: { range: TimeRange; note: string }) => void;
  onBlockFullDay: (date: Date) => void;
};

export default function BlockTimeSheet({
  visible,
  range,
  saving,
  onClose,
  onConfirm,
  onBlockFullDay,
}: BlockTimeSheetProps) {
  const [note, setNote] = useState('');

  const handleClose = () => {
    setNote('');
    onClose();
  };

  const handleConfirm = () => {
    if (!range) return;
    onConfirm({ range, note });
    setNote('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.handle} />

          <Text style={styles.title}>Block this time</Text>
          {range ? <Text style={styles.range}>{formatTimeRange(range.startsAt, range.endsAt)}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="Optional note (admin only)"
            placeholderTextColor={colors.textMuted}
            value={note}
            onChangeText={setNote}
          />

          <Pressable style={styles.primaryBtn} onPress={handleConfirm} disabled={saving || !range}>
            <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Block time'}</Text>
          </Pressable>

          {range ? (
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => onBlockFullDay(range.startsAt)}
              disabled={saving}
            >
              <Text style={styles.secondaryBtnText}>Block entire day instead</Text>
            </Pressable>
          ) : null}

          <Pressable style={styles.cancelBtn} onPress={handleClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.progressTrack,
    marginBottom: 16,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  range: {
    color: colors.accentPink,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    marginBottom: 14,
  },
  primaryBtn: {
    backgroundColor: '#f87171',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});
