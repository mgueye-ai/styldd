import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme';

const PRIMARY_PRESETS = [
  '#db2777', // pink (default)
  '#e11d48', // rose
  '#be185d', // deep pink
  '#9333ea', // purple
  '#7c3aed', // violet
  '#2563eb', // blue
  '#0891b2', // cyan
  '#059669', // emerald
  '#16a34a', // green
  '#ca8a04', // yellow
  '#d97706', // amber
  '#ea580c', // orange
  '#dc2626', // red
  '#b45309', // brown gold
  '#6d28d9', // deep violet
  '#0f766e', // teal
];

const SECONDARY_PRESETS = [
  '#0a0a0a', // ink (default)
  '#1e1b4b', // deep navy
  '#1e293b', // slate dark
  '#18181b', // zinc dark
  '#1c1917', // warm dark
  '#0c4a6e', // ocean
  '#14532d', // forest
  '#4a044e', // deep plum
  '#7f1d1d', // deep red
  '#431407', // deep amber
  '#ffffff', // white
  '#fafafa', // cream
  '#f5f5f4', // stone
  '#e2e8f0', // slate light
  '#f0fdf4', // mint
  '#fdf4ff', // lavender
];

const BACKGROUND_PRESETS = [
  '#fafafa', // off-white (default)
  '#ffffff', // pure white
  '#f5f5f4', // stone
  '#fef9f0', // warm cream
  '#fdf4ff', // soft lavender
  '#f0fdf4', // soft mint
  '#eff6ff', // soft blue
  '#fff7ed', // warm peach
  '#fafaf0', // ivory
  '#f1f5f9', // slate light
  '#18181b', // zinc dark
  '#0a0a0a', // near black
  '#0e0e1a', // dark navy
  '#1e1b4b', // deep indigo
  '#1c1917', // warm dark
  '#0c0a09', // deep warm black
];

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

export function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#000';
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

type ColorPickerProps = {
  label: string;
  value: string;
  presets: 'primary' | 'secondary' | 'background';
  onChange: (color: string) => void;
};

export default function ColorPicker({ label, value, presets, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const swatches =
    presets === 'primary' ? PRIMARY_PRESETS :
    presets === 'background' ? BACKGROUND_PRESETS :
    SECONDARY_PRESETS;
  const contrastColor = getContrastColor(value);

  const handleSelect = (hex: string) => {
    setDraft(hex);
    onChange(hex);
    setOpen(false);
  };

  const handleHexSubmit = () => {
    const clean = draft.trim();
    const hex = clean.startsWith('#') ? clean : `#${clean}`;
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      onChange(hex);
      setOpen(false);
    }
  };

  return (
    <>
      <Pressable style={styles.row} onPress={() => { setDraft(value); setOpen(true); }}>
        <View style={[styles.swatch, { backgroundColor: value }]}>
          <Ionicons name="color-palette-outline" size={14} color={contrastColor} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.rowValue}>{value.toUpperCase()}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modalBg} edges={['bottom']}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionLabel}>Presets</Text>
              <View style={styles.grid}>
                {swatches.map((hex) => (
                  <Pressable
                    key={hex}
                    style={[
                      styles.gridSwatch,
                      { backgroundColor: hex },
                      value === hex && styles.gridSwatchActive,
                    ]}
                    onPress={() => handleSelect(hex)}
                  >
                    {value === hex && (
                      <Ionicons name="checkmark" size={18} color={getContrastColor(hex)} />
                    )}
                  </Pressable>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Custom hex code</Text>
              <View style={styles.hexRow}>
                <View style={[styles.hexPreview, { backgroundColor: draft }]} />
                <TextInput
                  style={styles.hexInput}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="#db2777"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={7}
                  returnKeyType="done"
                  onSubmitEditing={handleHexSubmit}
                />
                <Pressable style={styles.hexApply} onPress={handleHexSubmit}>
                  <Text style={styles.hexApplyText}>Apply</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
    marginBottom: 10,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  rowValue: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  modalBg: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  gridSwatch: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gridSwatchActive: {
    borderColor: colors.text,
    borderWidth: 2.5,
  },
  hexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  hexPreview: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  hexInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.card,
  },
  hexApply: {
    backgroundColor: colors.accentPink,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  hexApplyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
