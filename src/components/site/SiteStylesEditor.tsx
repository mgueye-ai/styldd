import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import ServiceImage from '../ServiceImage';
import { useServiceCatalog } from '../../context/ServiceCatalogContext';
import { CatalogService } from '../../data/serviceCatalog';
import {
  DEFAULT_STYLE_DURATION_MINUTES,
  formatStyleDuration,
  formatStylePrice,
  STYLE_DURATION_PRESETS,
} from '../../data/siteStyles';
import { pickSiteImageFromLibrary } from '../../lib/pickSiteImage';
import { colors } from '../../theme';

type StyleEditorCardProps = {
  service: CatalogService;
  busy: boolean;
  onBusyChange: (styleId: string | null) => void;
  onFieldFocus: (fieldRef: View | null) => void;
};

type SiteStylesEditorProps = {
  manageKeyboard?: boolean;
};

const PHOTO_WIDTH = 128;

const PILL_TONE = {
  bg: colors.accentPinkMuted,
  border: colors.accentPinkBorder,
  text: colors.accentPink,
};

function StylePill({
  service,
  selected,
  onPress,
}: {
  service: CatalogService;
  selected: boolean;
  onPress: () => void;
}) {
  const { getPrice, getStyleMeta } = useServiceCatalog();
  const meta = getStyleMeta(service.id);
  const title = meta?.title ?? service.name;
  const price = getPrice(service.id);
  const durationMinutes = meta?.durationMinutes ?? DEFAULT_STYLE_DURATION_MINUTES;

  return (
    <Pressable
      style={[
        styles.stylePill,
        selected && styles.stylePillSelected,
        selected && { borderColor: PILL_TONE.border, backgroundColor: PILL_TONE.bg },
      ]}
      onPress={onPress}
    >
      <ServiceImage styleId={service.id} size={36} radius={18} />
      <View style={styles.stylePillCopy}>
        <Text style={styles.stylePillTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.stylePillMeta} numberOfLines={1}>
          {formatStyleDuration(durationMinutes)} · {formatStylePrice(price)}
        </Text>
      </View>
    </Pressable>
  );
}

function StylePhoto({
  styleId,
  localUri,
  onPress,
  disabled,
  busy,
  placeholder,
}: {
  styleId?: string;
  localUri?: string | null;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  placeholder?: boolean;
}) {
  const { getCoverUrl } = useServiceCatalog();
  const coverUrl = styleId ? getCoverUrl(styleId) : null;
  const uri = localUri ?? coverUrl;

  return (
    <Pressable style={styles.photoArea} onPress={onPress} disabled={disabled || busy}>
      {uri ? (
        <Image source={{ uri }} style={styles.photoImage} resizeMode="cover" />
      ) : (
        <View style={[styles.photoImage, styles.photoPlaceholder]}>
          <Ionicons name="image-outline" size={24} color={colors.textMuted} />
          <Text style={styles.photoPlaceholderText}>
            {placeholder ? 'Add photo' : 'Photo'}
          </Text>
        </View>
      )}
      {!placeholder && (
        <View style={styles.photoOverlay}>
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="camera-outline" size={14} color="#fff" />
          )}
        </View>
      )}
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  editable = true,
  onFocus,
  fieldRef,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'decimal-pad';
  editable?: boolean;
  onFocus?: () => void;
  fieldRef?: RefObject<View | null>;
}) {
  return (
    <View ref={fieldRef} style={styles.field} collapsable={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        editable={editable}
        onFocus={onFocus}
      />
    </View>
  );
}

function DurationPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (minutes: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Duration</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.durationRow}
      >
        {STYLE_DURATION_PRESETS.map((preset) => {
          const selected = value === preset.minutes;
          return (
            <Pressable
              key={preset.minutes}
              style={[styles.durationChip, selected && styles.durationChipSelected]}
              onPress={() => onChange(preset.minutes)}
              disabled={disabled}
            >
              <Text
                style={[styles.durationChipText, selected && styles.durationChipTextSelected]}
              >
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function StyleEditorPanel({ service, busy, onBusyChange, onFieldFocus }: StyleEditorCardProps) {
  const { getStyleMeta, getPrice, upsertStyle, deleteStyle, uploadStyleImage } = useServiceCatalog();

  const meta = getStyleMeta(service.id);
  const [title, setTitle] = useState(meta?.title ?? service.name);
  const [description, setDescription] = useState(meta?.description ?? service.description ?? '');
  const [price, setPrice] = useState(String(getPrice(service.id) || ''));
  const [durationMinutes, setDurationMinutes] = useState(
    meta?.durationMinutes ?? DEFAULT_STYLE_DURATION_MINUTES,
  );
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);
  const lastSavedSnapshot = useRef('');
  const titleRef = useRef<View>(null);
  const descriptionRef = useRef<View>(null);
  const priceRef = useRef<View>(null);

  const snapshot = `${title}|${description}|${price}|${durationMinutes}`;
  const parsedPrice = Number(price.replace(/[^0-9.]/g, '')) || 0;

  useEffect(() => {
    setTitle(meta?.title ?? service.name);
    setDescription(meta?.description ?? service.description ?? '');
    setPrice(String(getPrice(service.id) || ''));
    setDurationMinutes(meta?.durationMinutes ?? DEFAULT_STYLE_DURATION_MINUTES);
    setLocalImageUri(null);
    skipNextSave.current = true;
    lastSavedSnapshot.current = `${meta?.title ?? service.name}|${meta?.description ?? service.description ?? ''}|${getPrice(service.id) || ''}|${meta?.durationMinutes ?? DEFAULT_STYLE_DURATION_MINUTES}`;
  }, [getPrice, meta?.description, meta?.durationMinutes, meta?.title, service.description, service.id, service.name]);

  const saveStyle = useCallback(async () => {
    onBusyChange(service.id);
    try {
      await upsertStyle({
        id: service.id,
        title,
        description,
        price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
        durationMinutes,
        category: meta?.category ?? service.category,
        venue: service.venue,
      });
      setSavedFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setSavedFlash(false), 1800);
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Could not save style.');
    } finally {
      onBusyChange(null);
    }
  }, [
    description,
    durationMinutes,
    meta?.category,
    onBusyChange,
    parsedPrice,
    service.category,
    service.id,
    service.venue,
    title,
    upsertStyle,
  ]);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (snapshot === lastSavedSnapshot.current) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveStyle().then(() => {
        lastSavedSnapshot.current = snapshot;
      });
    }, 900);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [snapshot, saveStyle]);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const pickImage = async () => {
    const picked = await pickSiteImageFromLibrary(
      'Allow photo library access to upload style images.',
    );
    if (!picked) return;

    setLocalImageUri(picked.uri);
    onBusyChange(service.id);
    try {
      await uploadStyleImage(service.id, picked.uri, picked.mimeType);
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Could not upload image.');
      setLocalImageUri(null);
    } finally {
      onBusyChange(null);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete style', `Remove "${title.trim() || service.name}" from your menu?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          onBusyChange(service.id);
          try {
            await deleteStyle(service.id);
          } catch (err) {
            Alert.alert('Delete failed', err instanceof Error ? err.message : 'Could not delete style.');
          } finally {
            onBusyChange(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        {savedFlash ? (
          <View style={styles.savedPill}>
            <Ionicons name="checkmark-circle" size={14} color={colors.accentPink} />
            <Text style={styles.savedPillText}>Saved</Text>
          </View>
        ) : busy ? (
          <ActivityIndicator size="small" color={colors.accentPink} />
        ) : null}
        <Pressable onPress={confirmDelete} hitSlop={8} disabled={busy} style={styles.deleteIcon}>
          <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.panelRow}>
        <StylePhoto
          styleId={service.id}
          localUri={localImageUri}
          onPress={pickImage}
          busy={busy}
        />

        <View style={styles.fieldsColumn}>
          <Field
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="Knotless braids"
            fieldRef={titleRef}
            onFocus={() => onFieldFocus(titleRef.current)}
          />
          <Field
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Tell clients what is included"
            multiline
            fieldRef={descriptionRef}
            onFocus={() => onFieldFocus(descriptionRef.current)}
          />
          <Field
            label="Price"
            value={price}
            onChangeText={setPrice}
            placeholder="150"
            keyboardType="decimal-pad"
            fieldRef={priceRef}
            onFocus={() => onFieldFocus(priceRef.current)}
          />
          <DurationPicker
            value={durationMinutes}
            onChange={setDurationMinutes}
            disabled={busy}
          />
        </View>
      </View>
    </View>
  );
}

function AddStylePanel({
  onAdd,
  isAdding,
  onFieldFocus,
}: {
  onAdd: (
    input: { title: string; description: string; price: number; durationMinutes: number },
    imageUri: string | null,
    mimeType: string | null,
  ) => Promise<void>;
  isAdding: boolean;
  onFieldFocus: (fieldRef: View | null) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_STYLE_DURATION_MINUTES);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const titleRef = useRef<View>(null);
  const descriptionRef = useRef<View>(null);
  const priceRef = useRef<View>(null);

  const parsedPrice = Number(price.replace(/[^0-9.]/g, '')) || 0;
  const canAdd = title.trim().length > 0 && !isAdding;

  const pickImage = async () => {
    const picked = await pickSiteImageFromLibrary(
      'Allow photo library access to upload style images.',
    );
    if (!picked) return;
    setImageUri(picked.uri);
    setImageMimeType(picked.mimeType ?? null);
  };

  const submit = async () => {
    if (!canAdd) return;
    try {
      await onAdd(
        {
          title: title.trim(),
          description: description.trim(),
          price: parsedPrice,
          durationMinutes,
        },
        imageUri,
        imageMimeType,
      );
      setTitle('');
      setDescription('');
      setPrice('');
      setDurationMinutes(DEFAULT_STYLE_DURATION_MINUTES);
      setImageUri(null);
      setImageMimeType(null);
    } catch {
      // parent alerts
    }
  };

  return (
    <View style={styles.panel}>
      <View style={styles.panelRow}>
        <StylePhoto
          localUri={imageUri}
          onPress={pickImage}
          disabled={isAdding}
          placeholder
        />

        <View style={styles.fieldsColumn}>
          <Field
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="Silk press"
            editable={!isAdding}
            fieldRef={titleRef}
            onFocus={() => onFieldFocus(titleRef.current)}
          />
          <Field
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="What clients should know"
            multiline
            editable={!isAdding}
            fieldRef={descriptionRef}
            onFocus={() => onFieldFocus(descriptionRef.current)}
          />
          <Field
            label="Price"
            value={price}
            onChangeText={setPrice}
            placeholder="120"
            keyboardType="decimal-pad"
            editable={!isAdding}
            fieldRef={priceRef}
            onFocus={() => onFieldFocus(priceRef.current)}
          />
          <DurationPicker
            value={durationMinutes}
            onChange={setDurationMinutes}
            disabled={isAdding}
          />

          <Pressable
            style={[styles.addButton, !canAdd && styles.addButtonDisabled]}
            onPress={submit}
            disabled={!canAdd}
          >
            {isAdding ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.addButtonText}>Add style</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function StylesEditorBody({
  onFieldFocus,
}: {
  onFieldFocus: (fieldRef: View | null) => void;
}) {
  const { catalogServices, isLoading, error, upsertStyle, isSaving } = useServiceCatalog();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null);
  const { width } = useWindowDimensions();
  const panelScrollRef = useRef<ScrollView>(null);
  const panelWidth = Math.max(width - 40, 320);
  const panelStride = panelWidth + 12;

  useEffect(() => {
    if (selectedId === 'new') return;
    if (selectedId && catalogServices.some((service) => service.id === selectedId)) return;
    if (catalogServices.length > 0) {
      setSelectedId(catalogServices[0].id);
    } else {
      setSelectedId('new');
    }
  }, [catalogServices, selectedId]);

  useEffect(() => {
    if (selectedId === null) return;

    const index =
      selectedId === 'new'
        ? 0
        : catalogServices.findIndex((service) => service.id === selectedId) + 1;

    if (index < 0) return;

    panelScrollRef.current?.scrollTo({
      x: index * panelStride,
      animated: true,
    });
  }, [catalogServices, panelStride, selectedId]);

  const handlePanelScrollEnd = (offsetX: number) => {
    const index = Math.round(offsetX / panelStride);
    if (index <= 0) {
      setSelectedId('new');
      return;
    }
    const service = catalogServices[index - 1];
    if (service) setSelectedId(service.id);
  };

  const handleAdd = async (
    input: { title: string; description: string; price: number; durationMinutes: number },
    imageUri: string | null,
    mimeType: string | null,
  ) => {
    setIsAdding(true);
    try {
      const id = await upsertStyle(input, imageUri, mimeType);
      setSelectedId(id);
    } catch (err) {
      Alert.alert('Add failed', err instanceof Error ? err.message : 'Could not add style.');
      throw err;
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accentPink} />
        <Text style={styles.helper}>Loading your styles…</Text>
      </View>
    );
  }

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  return (
    <View>
      <Text style={styles.helper}>
        Swipe the pills to pick a style. Tap fields to edit — the view moves up for the keyboard.
      </Text>

      <Text style={styles.groupTitle}>Your styles</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          style={[styles.addPill, selectedId === 'new' && styles.addPillSelected]}
          onPress={() => setSelectedId('new')}
        >
          <Ionicons
            name="add"
            size={18}
            color={selectedId === 'new' ? colors.accentPink : colors.textMuted}
          />
          <Text style={[styles.addPillText, selectedId === 'new' && styles.addPillTextSelected]}>
            Add
          </Text>
        </Pressable>
        {catalogServices.map((service) => (
          <StylePill
            key={service.id}
            service={service}
            selected={selectedId === service.id}
            onPress={() => setSelectedId(service.id)}
          />
        ))}
      </ScrollView>

      <Text style={styles.groupTitle}>Edit style</Text>

      <ScrollView
        ref={panelScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        decelerationRate="fast"
        snapToInterval={panelStride}
        snapToAlignment="start"
        contentContainerStyle={styles.panelCarousel}
        keyboardShouldPersistTaps="handled"
        onMomentumScrollEnd={(event) =>
          handlePanelScrollEnd(event.nativeEvent.contentOffset.x)
        }
      >
        <View style={[styles.panelSlide, { width: panelWidth }]}>
          <AddStylePanel onAdd={handleAdd} isAdding={isAdding || isSaving} onFieldFocus={onFieldFocus} />
        </View>
        {catalogServices.map((service) => (
          <View key={service.id} style={[styles.panelSlide, { width: panelWidth }]}>
            <StyleEditorPanel
              service={service}
              busy={busyId === service.id}
              onBusyChange={setBusyId}
              onFieldFocus={onFieldFocus}
            />
          </View>
        ))}
      </ScrollView>

      {catalogServices.length === 0 ? (
        <Text style={styles.emptyHint}>Swipe left after adding your first style.</Text>
      ) : null}
    </View>
  );
}

export default function SiteStylesEditor({ manageKeyboard = false }: SiteStylesEditorProps) {
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const [keyboardPadding, setKeyboardPadding] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardPadding(event.endCoordinates.height + 24);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardPadding(24);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollToField = useCallback((fieldRef: View | null) => {
    if (!fieldRef || !contentRef.current || !scrollRef.current) return;

    setTimeout(() => {
      fieldRef.measureLayout(
        contentRef.current as View,
        (_x, y, _width, height) => {
          scrollRef.current?.scrollTo({
            y: Math.max(0, y + height - 220),
            animated: true,
          });
        },
        () => undefined,
      );
    }, Platform.OS === 'ios' ? 100 : 250);
  }, []);

  const body = <StylesEditorBody onFieldFocus={scrollToField} />;

  if (!manageKeyboard) {
    return body;
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: keyboardPadding || 40 },
        ]}
      >
        <View ref={contentRef} collapsable={false}>
          {body}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  centered: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  error: {
    color: '#f87171',
    fontSize: 14,
    lineHeight: 20,
  },
  groupTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 10,
  },
  pillRow: {
    gap: 10,
    paddingBottom: 4,
    paddingRight: 4,
  },
  stylePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    paddingRight: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    maxWidth: 200,
  },
  stylePillSelected: {
    borderWidth: 1.5,
  },
  stylePillCopy: {
    flexShrink: 1,
    gap: 2,
  },
  stylePillTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  stylePillMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  durationChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  durationChipSelected: {
    borderColor: colors.accentPinkBorder,
    backgroundColor: colors.accentPinkMuted,
  },
  durationChipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  durationChipTextSelected: {
    color: colors.accentPink,
    fontWeight: '700',
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderStyle: 'dashed',
    backgroundColor: colors.card,
  },
  addPillSelected: {
    borderColor: colors.accentPinkBorder,
    backgroundColor: colors.accentPinkMuted,
    borderStyle: 'solid',
  },
  addPillText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  addPillTextSelected: {
    color: colors.accentPink,
  },
  panelCarousel: {
    gap: 12,
    paddingRight: 20,
  },
  panelSlide: {
    flexShrink: 0,
  },
  panel: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
    marginBottom: 12,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  panelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  fieldsColumn: {
    flex: 1,
    minWidth: 0,
  },
  savedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 'auto',
  },
  savedPillText: {
    color: colors.accentPink,
    fontSize: 12,
    fontWeight: '700',
  },
  deleteIcon: {
    marginLeft: 'auto',
  },
  photoArea: {
    width: PHOTO_WIDTH,
    aspectRatio: 4 / 5,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    position: 'relative',
    flexShrink: 0,
  },
  photoImage: {
    ...StyleSheet.absoluteFillObject,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoPlaceholderText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  photoOverlay: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    marginBottom: 8,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 14,
    backgroundColor: colors.background,
  },
  inputMultiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  addButton: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.accentPink,
    borderRadius: 10,
    paddingVertical: 10,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
});
