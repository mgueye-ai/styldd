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

// ─── Color palettes ───────────────────────────────────────────────────────────

type ColorSwatch = { hex: string; name: string };
type ColorGroup = { label: string; swatches: ColorSwatch[] };

const PRIMARY_GROUPS: ColorGroup[] = [
  {
    label: 'Pinks & Roses',
    swatches: [
      { hex: '#fc61a3', name: 'Bubblegum' },
      { hex: '#db2777', name: 'Hot Pink' },
      { hex: '#be185d', name: 'Deep Rose' },
      { hex: '#e11d48', name: 'Rose Red' },
      { hex: '#f43f5e', name: 'Coral Rose' },
    ],
  },
  {
    label: 'Purples',
    swatches: [
      { hex: '#a855f7', name: 'Lavender' },
      { hex: '#9333ea', name: 'Amethyst' },
      { hex: '#7c3aed', name: 'Violet' },
      { hex: '#6d28d9', name: 'Deep Violet' },
      { hex: '#c026d3', name: 'Fuchsia' },
    ],
  },
  {
    label: 'Blues & Teals',
    swatches: [
      { hex: '#3b82f6', name: 'Sky Blue' },
      { hex: '#2563eb', name: 'Royal Blue' },
      { hex: '#0ea5e9', name: 'Cyan' },
      { hex: '#0891b2', name: 'Teal Blue' },
      { hex: '#0f766e', name: 'Deep Teal' },
    ],
  },
  {
    label: 'Greens',
    swatches: [
      { hex: '#22c55e', name: 'Mint' },
      { hex: '#16a34a', name: 'Emerald' },
      { hex: '#059669', name: 'Forest' },
      { hex: '#65a30d', name: 'Lime' },
      { hex: '#15803d', name: 'Deep Green' },
    ],
  },
  {
    label: 'Warm Tones',
    swatches: [
      { hex: '#f97316', name: 'Orange' },
      { hex: '#ea580c', name: 'Burnt Orange' },
      { hex: '#d97706', name: 'Amber' },
      { hex: '#ca8a04', name: 'Gold' },
      { hex: '#dc2626', name: 'Red' },
    ],
  },
  {
    label: 'Sophisticated',
    swatches: [
      { hex: '#b45309', name: 'Bronze' },
      { hex: '#78716c', name: 'Warm Gray' },
      { hex: '#334155', name: 'Slate' },
      { hex: '#1e293b', name: 'Midnight' },
      { hex: '#292524', name: 'Espresso' },
    ],
  },
];

const SECONDARY_GROUPS: ColorGroup[] = [
  {
    label: 'Rich Darks',
    swatches: [
      { hex: '#0a0a0a', name: 'Jet Black' },
      { hex: '#18181b', name: 'Zinc' },
      { hex: '#1c1917', name: 'Warm Black' },
      { hex: '#111827', name: 'Charcoal' },
      { hex: '#0f172a', name: 'Deep Slate' },
    ],
  },
  {
    label: 'Colored Darks',
    swatches: [
      { hex: '#1e1b4b', name: 'Indigo Dark' },
      { hex: '#1e3a5f', name: 'Navy' },
      { hex: '#14532d', name: 'Forest' },
      { hex: '#4a044e', name: 'Deep Plum' },
      { hex: '#7f1d1d', name: 'Burgundy' },
    ],
  },
  {
    label: 'For Dark Sites',
    swatches: [
      { hex: '#ffffff', name: 'White' },
      { hex: '#f5f5f5', name: 'Off White' },
      { hex: '#e5e7eb', name: 'Pearl' },
      { hex: '#d1d5db', name: 'Silver' },
      { hex: '#f8fafc', name: 'Snow' },
    ],
  },
];

const BACKGROUND_GROUPS: ColorGroup[] = [
  {
    label: 'Clean Lights',
    swatches: [
      { hex: '#ffffff', name: 'Pure White' },
      { hex: '#fafafa', name: 'Off White' },
      { hex: '#f9fafb', name: 'Snow' },
      { hex: '#f8fafc', name: 'Cool White' },
      { hex: '#f5f5f4', name: 'Stone' },
    ],
  },
  {
    label: 'Warm & Cozy',
    swatches: [
      { hex: '#fef9f0', name: 'Warm Cream' },
      { hex: '#fffbf0', name: 'Ivory' },
      { hex: '#fff7ed', name: 'Peach Mist' },
      { hex: '#fdf6e3', name: 'Linen' },
      { hex: '#fef3c7', name: 'Butter' },
    ],
  },
  {
    label: 'Soft Pastels',
    swatches: [
      { hex: '#fdf4ff', name: 'Lavender' },
      { hex: '#fce7f3', name: 'Blush' },
      { hex: '#f0fdf4', name: 'Mint' },
      { hex: '#eff6ff', name: 'Sky' },
      { hex: '#f0f9ff', name: 'Ice Blue' },
    ],
  },
  {
    label: 'Rich Darks',
    swatches: [
      { hex: '#0a0a0a', name: 'Jet Black' },
      { hex: '#0e0e1a', name: 'Dark Navy' },
      { hex: '#18181b', name: 'Zinc Dark' },
      { hex: '#1c1917', name: 'Warm Dark' },
      { hex: '#0f172a', name: 'Deep Slate' },
    ],
  },
  {
    label: 'Moody Tones',
    swatches: [
      { hex: '#1e1b4b', name: 'Deep Indigo' },
      { hex: '#1e3a5f', name: 'Deep Navy' },
      { hex: '#14532d', name: 'Deep Forest' },
      { hex: '#2d1b69', name: 'Deep Violet' },
      { hex: '#3b0764', name: 'Midnight' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function findColorName(hex: string, groups: ColorGroup[]): string | null {
  const normalized = hex.toLowerCase();
  for (const group of groups) {
    for (const s of group.swatches) {
      if (s.hex.toLowerCase() === normalized) return s.name;
    }
  }
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ColorPickerProps = {
  label: string;
  value: string;
  presets: 'primary' | 'secondary' | 'background';
  onChange: (color: string) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ColorPicker({ label, value, presets, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const groups =
    presets === 'primary' ? PRIMARY_GROUPS :
    presets === 'background' ? BACKGROUND_GROUPS :
    SECONDARY_GROUPS;

  const allSwatches = groups.flatMap((g) => g.swatches);
  const colorName = findColorName(value, groups);
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
      {/* Trigger row */}
      <Pressable style={styles.row} onPress={() => { setDraft(value); setOpen(true); }}>
        <View style={[styles.swatchThumb, { backgroundColor: value }]} />
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {colorName ?? value.toUpperCase()}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.rowHex}>{value.toUpperCase()}</Text>
          <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
        </View>
      </Pressable>

      {/* Sheet modal */}
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modalBg} edges={['bottom']}>
          <View style={styles.sheet}>

            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            {/* Current color preview */}
            <View style={[styles.preview, { backgroundColor: value }]}>
              <Text style={[styles.previewName, { color: contrastColor }]}>
                {colorName ?? 'Custom'}
              </Text>
              <Text style={[styles.previewHex, { color: contrastColor + 'cc' }]}>
                {value.toUpperCase()}
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

              {/* Grouped swatches */}
              {groups.map((group) => (
                <View key={group.label} style={styles.group}>
                  <Text style={styles.groupLabel}>{group.label}</Text>
                  <View style={styles.swatchRow}>
                    {group.swatches.map((swatch) => {
                      const active = value.toLowerCase() === swatch.hex.toLowerCase();
                      return (
                        <Pressable
                          key={swatch.hex}
                          style={styles.swatchWrap}
                          onPress={() => handleSelect(swatch.hex)}
                        >
                          <View
                            style={[
                              styles.swatch,
                              { backgroundColor: swatch.hex },
                              active && styles.swatchActive,
                            ]}
                          >
                            {active && (
                              <Ionicons
                                name="checkmark"
                                size={18}
                                color={getContrastColor(swatch.hex)}
                              />
                            )}
                          </View>
                          <Text
                            style={[styles.swatchName, active && styles.swatchNameActive]}
                            numberOfLines={2}
                          >
                            {swatch.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}

              {/* Custom hex */}
              <Text style={styles.groupLabel}>Custom</Text>
              <View style={styles.hexRow}>
                <View style={[styles.hexPreview, { backgroundColor: draft }]} />
                <TextInput
                  style={styles.hexInput}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="#a855f7"
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Trigger row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
    marginBottom: 10,
  },
  swatchThumb: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  rowSub: {
    color: colors.textMuted,
    fontSize: 13,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  rowHex: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Modal
  modalBg: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingBottom: 8,
    maxHeight: '88%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Preview bar
  preview: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewName: {
    fontSize: 16,
    fontWeight: '800',
  },
  previewHex: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  // Groups
  group: {
    marginBottom: 20,
  },
  groupLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  swatchWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  swatch: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: {
    borderColor: colors.text,
    borderWidth: 2.5,
  },
  swatchName: {
    color: colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 13,
    fontWeight: '500',
  },
  swatchNameActive: {
    color: colors.text,
    fontWeight: '700',
  },

  // Custom hex
  hexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  hexPreview: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  hexInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.card,
    letterSpacing: 0.5,
  },
  hexApply: {
    backgroundColor: colors.accentPink,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  hexApplyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
