import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ColorPicker as WheelPicker, useColor } from 'react-native-color-picker-palette';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
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

function normalizeHex(raw: string): string | null {
  const h = (raw ?? '').trim();
  const full = h.startsWith('#') ? h : `#${h}`;
  // Accept 6-digit or 8-digit (strip alpha)
  if (/^#[0-9a-fA-F]{8}$/.test(full)) return full.slice(0, 7).toLowerCase();
  if (/^#[0-9a-fA-F]{6}$/.test(full)) return full.toLowerCase();
  return null;
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

// ─── Image picker HTML ────────────────────────────────────────────────────────

function buildImagePickerHtml(base64: string, mimeType: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#111;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden}
canvas{display:block;max-width:100vw;max-height:85vh;cursor:crosshair;touch-action:none}
#swatch{position:fixed;top:14px;right:14px;width:52px;height:52px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 12px rgba(0,0,0,0.55);transition:background 0.08s}
#hexlabel{position:fixed;top:18px;right:76px;background:rgba(0,0,0,0.72);color:#fff;padding:9px 13px;border-radius:999px;font:700 13px/1 monospace;letter-spacing:.5px}
#hint{position:fixed;bottom:20px;left:0;right:0;text-align:center;color:#fff;font:600 13px/1 system-ui;text-shadow:0 1px 5px rgba(0,0,0,0.8);opacity:.85}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="swatch" style="background:#888"></div>
<div id="hexlabel">#888888</div>
<div id="hint">Tap anywhere to pick a color</div>
<script>
var c=document.getElementById('c');
var ctx=c.getContext('2d');
var swatch=document.getElementById('swatch');
var hexlabel=document.getElementById('hexlabel');
var img=new Image();
img.onload=function(){
  c.width=img.naturalWidth;c.height=img.naturalHeight;
  ctx.drawImage(img,0,0);
};
img.src='data:${mimeType};base64,${base64}';
function getHex(cx,cy){
  var px=ctx.getImageData(Math.round(Math.max(0,cx)),Math.round(Math.max(0,cy)),1,1).data;
  return '#'+[px[0],px[1],px[2]].map(function(v){return v.toString(16).padStart(2,'0');}).join('');
}
function pick(clientX,clientY){
  var r=c.getBoundingClientRect();
  var x=(clientX-r.left)*(c.width/r.width);
  var y=(clientY-r.top)*(c.height/r.height);
  var hex=getHex(x,y);
  swatch.style.background=hex;
  hexlabel.textContent=hex.toUpperCase();
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'pick',hex:hex}));
}
c.addEventListener('click',function(e){pick(e.clientX,e.clientY);});
c.addEventListener('touchend',function(e){
  e.preventDefault();
  var t=e.changedTouches[0];
  if(t)pick(t.clientX,t.clientY);
},{passive:false});
</script>
</body>
</html>`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ColorPickerProps = {
  label: string;
  value: string;
  presets: 'primary' | 'secondary' | 'background';
  onChange: (color: string) => void;
};

type CustomMode = 'hex' | 'wheel' | 'image';

// ─── Real-time wheel section ──────────────────────────────────────────────────

function WheelSection({ value, onLiveChange }: { value: string; onLiveChange: (hex: string) => void }) {
  const [wheelColor, setWheelColor] = useColor(value);

  const handleChange = useCallback(
    (c: typeof wheelColor) => {
      setWheelColor(c);
      const hex = normalizeHex(c.hex);
      if (hex) onLiveChange(hex);
    },
    [setWheelColor, onLiveChange],
  );

  return (
    <View style={wheelStyles.wrap}>
      <WheelPicker
        color={wheelColor}
        onColorChange={handleChange}
        hideControls
        style={wheelStyles.picker}
      />
      <View style={[wheelStyles.livePreview, { backgroundColor: wheelColor.hex }]}>
        <Text style={[wheelStyles.liveHex, { color: getContrastColor(wheelColor.hex) }]}>
          {(normalizeHex(wheelColor.hex) ?? '').toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

const wheelStyles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  picker: { height: 280 },
  livePreview: {
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    alignItems: 'center',
  },
  liveHex: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
});

// ─── Image eyedropper section ─────────────────────────────────────────────────

function ImageSection({ onPick }: { onPick: (hex: string) => void }) {
  const [imageHtml, setImageHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    setLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.4,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const base64 = asset.base64 ?? '';
        const mime = asset.mimeType ?? 'image/jpeg';
        setImageHtml(buildImagePickerHtml(base64, mime));
        setPicked(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'pick' && msg.hex) {
          const hex = normalizeHex(msg.hex);
          if (hex) {
            setPicked(hex);
            onPick(hex);
          }
        }
      } catch {}
    },
    [onPick],
  );

  if (imageHtml) {
    return (
      <View style={imgStyles.wrap}>
        <View style={imgStyles.header}>
          <Text style={imgStyles.headerText}>Tap any color in your photo</Text>
          <Pressable onPress={() => setImageHtml(null)} style={imgStyles.changeBtn}>
            <Text style={imgStyles.changeBtnText}>Change photo</Text>
          </Pressable>
        </View>
        <View style={imgStyles.webviewWrap}>
          <WebView
            source={{ html: imageHtml }}
            style={imgStyles.webview}
            scrollEnabled={false}
            onMessage={handleMessage}
            originWhitelist={['*']}
          />
        </View>
        {picked && (
          <View style={[imgStyles.pickedRow, { backgroundColor: picked }]}>
            <Text style={[imgStyles.pickedText, { color: getContrastColor(picked) }]}>
              {picked.toUpperCase()} picked
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <Pressable style={imgStyles.uploadBtn} onPress={handlePickImage} disabled={loading}>
      {loading ? (
        <ActivityIndicator color={colors.accentPink} />
      ) : (
        <>
          <Ionicons name="image-outline" size={22} color={colors.accentPink} />
          <Text style={imgStyles.uploadText}>Pick a color from a photo</Text>
          <Text style={imgStyles.uploadSub}>Tap any spot in your image to grab that exact color</Text>
        </>
      )}
    </Pressable>
  );
}

const imgStyles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  changeBtn: {
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  changeBtnText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  webviewWrap: {
    height: 260,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  webview: { flex: 1, backgroundColor: 'transparent' },
  pickedRow: {
    marginTop: 8,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  pickedText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.8 },
  uploadBtn: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accentPinkBorder,
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  uploadText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  uploadSub: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

export default function ColorPicker({ label, value, presets, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [customMode, setCustomMode] = useState<CustomMode>('hex');

  const groups =
    presets === 'primary' ? PRIMARY_GROUPS :
    presets === 'background' ? BACKGROUND_GROUPS :
    SECONDARY_GROUPS;

  const colorName = findColorName(value, groups);
  const contrastColor = getContrastColor(value);

  const handleSelect = (hex: string) => {
    const clean = normalizeHex(hex);
    if (!clean) return;
    setDraft(clean);
    onChange(clean);
    setOpen(false);
    setCustomMode('hex');
  };

  const handleLiveChange = useCallback(
    (hex: string) => {
      const clean = normalizeHex(hex);
      if (clean) { setDraft(clean); onChange(clean); }
    },
    [onChange],
  );

  const handleHexSubmit = () => {
    const clean = normalizeHex(draft);
    if (clean) {
      onChange(clean);
      setOpen(false);
      setCustomMode('hex');
    }
  };

  const MODE_BUTTONS: { id: CustomMode; icon: string; label: string }[] = [
    { id: 'hex', icon: 'code-outline', label: 'Hex' },
    { id: 'wheel', icon: 'color-filter-outline', label: 'Wheel' },
    { id: 'image', icon: 'image-outline', label: 'Photo' },
  ];

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
      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => { setOpen(false); setCustomMode('hex'); }}
      >
        <SafeAreaView style={styles.modalBg} edges={['bottom']}>
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable
                onPress={() => { setOpen(false); setCustomMode('hex'); }}
                hitSlop={10}
                style={styles.closeBtn}
              >
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

              {/* Palette swatches */}
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
                              <Ionicons name="checkmark" size={18} color={getContrastColor(swatch.hex)} />
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

              {/* Custom section */}
              <View style={styles.customHeader}>
                <Text style={styles.groupLabel}>Custom</Text>
                <View style={styles.modeBar}>
                  {MODE_BUTTONS.map((btn) => (
                    <Pressable
                      key={btn.id}
                      style={[styles.modeBtn, customMode === btn.id && styles.modeBtnActive]}
                      onPress={() => setCustomMode(btn.id)}
                    >
                      <Ionicons
                        name={btn.icon as any}
                        size={14}
                        color={customMode === btn.id ? colors.accentPink : colors.textMuted}
                      />
                      <Text style={[styles.modeBtnText, customMode === btn.id && styles.modeBtnTextActive]}>
                        {btn.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {customMode === 'wheel' && (
                <WheelSection value={value} onLiveChange={handleLiveChange} />
              )}

              {customMode === 'image' && (
                <ImageSection onPick={handleLiveChange} />
              )}

              {customMode === 'hex' && (
                <View style={styles.hexRow}>
                  <View style={[styles.hexPreview, { backgroundColor: draft }]} />
                  <TextInput
                    style={styles.hexInput}
                    value={draft}
                    onChangeText={(t) => {
                      setDraft(t);
                      const h = normalizeHex(t);
                      if (h) onChange(h);
                    }}
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
              )}

            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
  rowText: { flex: 1, gap: 3 },
  rowLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  rowSub: { color: colors.textMuted, fontSize: 13 },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  rowHex: { color: colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },

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
    maxHeight: '92%',
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
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewName: { fontSize: 16, fontWeight: '800' },
  previewHex: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },

  group: { marginBottom: 20 },
  groupLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  swatchRow: { flexDirection: 'row', gap: 8 },
  swatchWrap: { flex: 1, alignItems: 'center', gap: 5 },
  swatch: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: { borderColor: colors.text, borderWidth: 2.5 },
  swatchName: {
    color: colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 13,
    fontWeight: '500',
  },
  swatchNameActive: { color: colors.text, fontWeight: '700' },

  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modeBar: {
    flexDirection: 'row',
    backgroundColor: colors.navbar,
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.navbarBorder,
    gap: 2,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  modeBtnActive: { backgroundColor: colors.card },
  modeBtnText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  modeBtnTextActive: { color: colors.accentPink },

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
  hexApplyText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
