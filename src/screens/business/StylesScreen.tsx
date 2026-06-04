import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ServiceImage from '../../components/ServiceImage';
import { useServiceCatalog } from '../../context/ServiceCatalogContext';
import { useSiteData } from '../../context/SiteDataContext';
import { CatalogService, groupCatalogByCategory } from '../../data/serviceCatalog';
import {
  DEFAULT_STYLE_CATEGORY,
  DEFAULT_STYLE_DURATION_MINUTES,
  formatStyleDuration,
  formatStylePrice,
  STYLE_DURATION_PRESETS,
} from '../../data/siteStyles';
import { pickSiteImageFromLibrary } from '../../lib/pickSiteImage';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { colors } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Styles'>;

// ─── Style card (grid cell) ───────────────────────────────────────────────────

function StyleCard({
  service,
  onPress,
}: {
  service: CatalogService;
  onPress: () => void;
}) {
  const { getPrice, getStyleMeta, getCoverUrl } = useServiceCatalog();
  const meta = getStyleMeta(service.id);
  const title = meta?.title ?? service.name;
  const price = getPrice(service.id);
  const coverUrl = getCoverUrl(service.id);

  return (
    <Pressable
      style={({ pressed }) => [cardStyles.card, pressed && cardStyles.cardPressed]}
      onPress={onPress}
    >
      {/* thumbnail */}
      {coverUrl ? (
        <Image source={{ uri: coverUrl }} style={cardStyles.thumb} resizeMode="cover" />
      ) : (
        <View style={[cardStyles.thumb, cardStyles.thumbPlaceholder]}>
          <ServiceImage styleId={service.id} size={40} radius={8} />
        </View>
      )}

      {/* info */}
      <View style={cardStyles.info}>
        <Text style={cardStyles.name} numberOfLines={1}>{title}</Text>
        {(meta?.description || service.description) ? (
          <Text style={cardStyles.desc} numberOfLines={1}>
            {meta?.description ?? service.description}
          </Text>
        ) : null}
      </View>

      {/* price */}
      <Text style={cardStyles.price}>{formatStylePrice(price)}</Text>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 10,
    minHeight: 72,
  },
  cardPressed: { opacity: 0.7 },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    flexShrink: 0,
    backgroundColor: colors.background,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, minWidth: 0, gap: 4 },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  desc: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  price: {
    color: colors.accentPink,
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 0,
  },
});

// ─── Edit / Add modal ─────────────────────────────────────────────────────────

type EditState = {
  service: CatalogService | null; // null = adding new
};

// ─── Folder picker ────────────────────────────────────────────────────────────

function FolderPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { catalogServices } = useServiceCatalog();
  const [newName, setNewName] = useState('');

  const savedFolders = Array.from(
    new Set(catalogServices.map((s) => s.category).filter(Boolean)),
  ).sort();

  // Include the current value in the chip list even if it's unsaved/new
  const allFolders = savedFolders.includes(value)
    ? savedFolders
    : [...savedFolders, value].filter(Boolean);

  const applyNew = () => {
    const trimmed = newName.trim().toUpperCase();
    if (!trimmed) return;
    onChange(trimmed);
    setNewName('');
  };

  return (
    <View style={fpStyles.wrap}>
      <Text style={fpStyles.label}>Folder / Section</Text>

      {/* All known folders + current selection as chips */}
      <View style={fpStyles.chips}>
        {allFolders.map((cat) => (
          <Pressable
            key={cat}
            style={[fpStyles.chip, value === cat && fpStyles.chipActive]}
            onPress={() => onChange(cat)}
          >
            <Text style={[fpStyles.chipText, value === cat && fpStyles.chipTextActive]}>
              {cat}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* New folder input */}
      <Text style={fpStyles.newLabel}>Create a new folder</Text>
      <View style={fpStyles.newRow}>
        <TextInput
          style={fpStyles.newInput}
          value={newName}
          onChangeText={setNewName}
          placeholder="e.g. KNOTLESS"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          returnKeyType="done"
          onSubmitEditing={applyNew}
        />
        <Pressable
          style={[fpStyles.newConfirm, !newName.trim() && { opacity: 0.4 }]}
          onPress={applyNew}
          disabled={!newName.trim()}
        >
          <Text style={fpStyles.newConfirmText}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

const fpStyles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    borderColor: colors.accentPink,
    backgroundColor: colors.accentPinkMuted,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.accentPink,
    fontWeight: '700',
  },
  newLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  newConfirm: {
    backgroundColor: colors.accentPink,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  newConfirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

// ─── Edit / Add modal ─────────────────────────────────────────────────────────

function EditModal({
  state,
  onClose,
}: {
  state: EditState;
  onClose: () => void;
}) {
  const { getStyleMeta, getPrice, upsertStyle, deleteStyle, uploadStyleImage, getCoverUrl } =
    useServiceCatalog();

  const isNew = state.service === null;
  const service = state.service;
  const meta = service ? getStyleMeta(service.id) : null;

  const [title, setTitle] = useState(meta?.title ?? service?.name ?? '');
  const [description, setDescription] = useState(meta?.description ?? service?.description ?? '');
  const [price, setPrice] = useState(String(service ? getPrice(service.id) || '' : ''));
  const [folder, setFolder] = useState(meta?.category ?? service?.category ?? DEFAULT_STYLE_CATEGORY);
  const [durationMinutes, setDurationMinutes] = useState(
    meta?.durationMinutes ?? DEFAULT_STYLE_DURATION_MINUTES,
  );
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const coverUrl = service ? getCoverUrl(service.id) : null;
  const displayUri = localImageUri ?? coverUrl;

  const parsedPrice = Number(price.replace(/[^0-9.]/g, '')) || 0;

  const pickImage = async () => {
    const picked = await pickSiteImageFromLibrary('Allow photo library access to upload style images.');
    if (!picked) return;
    setLocalImageUri(picked.uri);
    setImageMimeType(picked.mimeType ?? null);
  };

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Enter a title for this style.'); return; }
    setSaving(true);
    try {
      const cat = folder.trim() || DEFAULT_STYLE_CATEGORY;
      if (isNew) {
        await upsertStyle(
          { title: title.trim(), description: description.trim(), price: parsedPrice, durationMinutes, category: cat },
          localImageUri,
          imageMimeType,
        );
      } else if (service) {
        await upsertStyle({
          id: service.id,
          title: title.trim(),
          description: description.trim(),
          price: parsedPrice,
          durationMinutes,
          category: cat,
          venue: service.venue,
        });
        if (localImageUri) {
          await uploadStyleImage(service.id, localImageUri, imageMimeType ?? undefined);
        }
      }
      onClose();
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!service) return;
    Alert.alert('Delete style', `Remove "${title.trim() || service.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try { await deleteStyle(service.id); onClose(); }
          catch (err) { Alert.alert('Delete failed', err instanceof Error ? err.message : 'Could not delete.'); }
          finally { setSaving(false); }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={modalStyles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={modalStyles.header}>
        <Pressable onPress={onClose} hitSlop={12} style={modalStyles.headerBtn}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
        <Text style={modalStyles.headerTitle}>{isNew ? 'Add style' : 'Edit style'}</Text>
        <View style={modalStyles.headerRight}>
          {!isNew && (
            <Pressable onPress={handleDelete} hitSlop={12} disabled={saving}>
              <Ionicons name="trash-outline" size={20} color="#f87171" />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={modalStyles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Photo */}
        <Pressable style={modalStyles.photoArea} onPress={pickImage} disabled={saving}>
          {displayUri ? (
            <Image source={{ uri: displayUri }} style={modalStyles.photoImg} resizeMode="cover" />
          ) : (
            <View style={modalStyles.photoPlaceholder}>
              <Ionicons name="image-outline" size={32} color={colors.textMuted} />
              <Text style={modalStyles.photoPlaceholderText}>Tap to add photo</Text>
            </View>
          )}
          <View style={modalStyles.photoOverlay}>
            <Ionicons name="camera-outline" size={14} color="#fff" />
          </View>
        </Pressable>

        {/* Fields */}
        <EditField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Knotless braids" />
        <EditField label="Description" value={description} onChangeText={setDescription} placeholder="What's included" multiline />
        <FolderPicker value={folder} onChange={setFolder} />
        <EditField label="Price" value={price} onChangeText={setPrice} placeholder="150" keyboardType="decimal-pad" prefix="$" />

        {/* Duration */}
        <Text style={modalStyles.fieldLabel}>Duration</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={modalStyles.durationRow}>
          {STYLE_DURATION_PRESETS.map((preset) => {
            const active = durationMinutes === preset.minutes;
            return (
              <Pressable
                key={preset.minutes}
                style={[modalStyles.durationChip, active && modalStyles.durationChipActive]}
                onPress={() => setDurationMinutes(preset.minutes)}
              >
                <Text style={[modalStyles.durationChipText, active && modalStyles.durationChipTextActive]}>
                  {preset.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Save */}
        <Pressable
          style={[modalStyles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={modalStyles.saveBtnText}>{isNew ? 'Add style' : 'Save changes'}</Text>
          }
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function EditField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  prefix,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'decimal-pad';
  prefix?: string;
}) {
  return (
    <View style={modalStyles.fieldWrap}>
      <Text style={modalStyles.fieldLabel}>{label}</Text>
      <View style={[modalStyles.inputRow, multiline && modalStyles.inputRowMulti]}>
        {prefix ? <Text style={modalStyles.prefix}>{prefix}</Text> : null}
        <TextInput
          style={[modalStyles.input, multiline && modalStyles.inputMulti]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          multiline={multiline}
          keyboardType={keyboardType ?? 'default'}
          textAlignVertical={multiline ? 'top' : 'center'}
          autoCorrect={false}
        />
      </View>
    </View>
  );
}

const modalStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  headerBtn: { width: 36 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.text },
  headerRight: { width: 36, alignItems: 'flex-end' },
  content: { padding: 20, paddingBottom: 48, gap: 4 },
  photoArea: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 20,
    position: 'relative',
  },
  photoImg: { ...StyleSheet.absoluteFillObject },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoPlaceholderText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  photoOverlay: {
    position: 'absolute', bottom: 10, right: 10,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
  },
  inputRowMulti: { alignItems: 'flex-start' },
  prefix: { color: colors.textMuted, fontSize: 16, fontWeight: '600', marginRight: 4 },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 12,
  },
  inputMulti: { minHeight: 80, paddingTop: 12 },
  durationRow: { gap: 8, paddingBottom: 4, marginBottom: 20 },
  durationChip: {
    borderRadius: 999, borderWidth: 1, borderColor: colors.cardBorder,
    backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 9,
  },
  durationChipActive: { borderColor: colors.accentPinkBorder, backgroundColor: colors.accentPinkMuted },
  durationChipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  durationChipTextActive: { color: colors.accentPink, fontWeight: '700' },
  saveBtn: {
    backgroundColor: colors.accentPink, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginTop: 8,
    shadowColor: colors.accentPink, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function StylesScreen({ navigation }: Props) {
  const { hasLinkedSite } = useSiteData();
  const { catalogServices, isLoading, error, isSaving, refresh } = useServiceCatalog();
  const [editState, setEditState] = useState<EditState | null>(null);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));


  return (
    <>
      {/* Screen */}
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Styles & Services</Text>
          <View style={styles.headerRight}>
            {isSaving
              ? <ActivityIndicator size="small" color={colors.accentPink} />
              : (
                <Pressable
                  onPress={() => setEditState({ service: null })}
                  hitSlop={10}
                  style={styles.addBtn}
                >
                  <Ionicons name="add" size={22} color="#fff" />
                </Pressable>
              )
            }
          </View>
        </View>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.accentPink} />
            <Text style={styles.centeredText}>Loading your styles…</Text>
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : !hasLinkedSite ? (
          <View style={styles.centered}>
            <Text style={styles.centeredText}>Link your site to manage styles.</Text>
          </View>
        ) : catalogServices.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="cut-outline" size={40} color={colors.textMuted} />
            <Text style={styles.centeredText}>No styles yet</Text>
            <Pressable style={styles.addFirstBtn} onPress={() => setEditState({ service: null })}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.addFirstBtnText}>Add your first style</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.hint}>Tap a style to edit it.</Text>
            {groupCatalogByCategory(catalogServices).map((group) => (
              <View key={group.title}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    {/* strip "Studio · " / "House call · " prefix — show just the folder name */}
                    {group.title.includes(' · ') ? group.title.split(' · ').slice(1).join(' · ') : group.title}
                  </Text>
                  <View style={styles.sectionRule} />
                </View>
                {group.data.map((service) => (
                  <StyleCard
                    key={service.id}
                    service={service}
                    onPress={() => setEditState({ service })}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Edit / Add modal */}
      <Modal
        visible={editState !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditState(null)}
      >
        {editState !== null && (
          <EditModal
            state={editState}
            onClose={() => setEditState(null)}
          />
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  headerRight: { width: 36, alignItems: 'flex-end' },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accentPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    padding: 14,
    gap: 8,
    paddingBottom: 60,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  centeredText: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  errorText: { color: '#f87171', fontSize: 14, padding: 20 },
  addFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentPink,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 8,
  },
  addFirstBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
