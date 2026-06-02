import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import BusinessScreenLayout from '../../components/business/BusinessScreenLayout';
import ServiceImage from '../../components/ServiceImage';
import { useServiceCatalog } from '../../context/ServiceCatalogContext';
import { useSiteData } from '../../context/SiteDataContext';
import { groupCatalogByCategory } from '../../data/serviceCatalog';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { colors } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Prices'>;

const PRICE_STEP = 5;

function PriceRow({
  styleId,
  name,
  variant,
  venueLabel,
  price,
  onDecrease,
  onIncrease,
  onSetPrice,
}: {
  styleId: string;
  name: string;
  variant: string;
  venueLabel: string;
  price: number;
  onDecrease: () => void;
  onIncrease: () => void;
  onSetPrice: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(price));

  useEffect(() => {
    setDraft(String(price));
  }, [price]);

  return (
    <View style={styles.row}>
      <ServiceImage styleId={styleId} size={56} radius={10} />
      <View style={styles.rowContent}>
        <Text style={styles.venue}>{venueLabel}</Text>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.variant}>{variant}</Text>
        <View style={styles.stepper}>
          <Pressable style={styles.stepBtn} onPress={onDecrease}>
            <Text style={styles.stepText}>−$5</Text>
          </Pressable>
          <TextInput
            style={styles.priceInput}
            value={draft}
            keyboardType="number-pad"
            onChangeText={setDraft}
            onBlur={() => {
              const parsed = Number(draft);
              if (Number.isFinite(parsed) && parsed >= 0) onSetPrice(parsed);
              else setDraft(String(price));
            }}
          />
          <Pressable style={styles.stepBtn} onPress={onIncrease}>
            <Text style={styles.stepText}>+$5</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function PricesScreen({ navigation }: Props) {
  const { hasLinkedSite } = useSiteData();
  const {
    catalogServices,
    error,
    getPrice,
    isLoading,
    isSaving,
    persistPrices,
    refresh,
    saveError,
    setLocalPrice,
  } = useServiceCatalog();
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sections = useMemo(() => groupCatalogByCategory(catalogServices), [catalogServices]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  useEffect(
    () => () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    },
    [],
  );

  const scheduleSave = () => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(async () => {
      try {
        await persistPrices();
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2000);
      } catch {
        setSaveState('idle');
      }
    }, 700);
  };

  const updatePrice = (styleId: string, price: number) => {
    setLocalPrice(styleId, price);
    setSaveState('idle');
    scheduleSave();
  };

  return (
    <BusinessScreenLayout
      title="Prices"
      onBack={() => navigation.goBack()}
      hasLinkedSite={hasLinkedSite}
      linkMessage="Link hairbynadjae_site to edit live prices on your booking site."
      isLoading={hasLinkedSite && isLoading}
      error={hasLinkedSite && !isLoading ? error : null}
      onRefresh={refresh}
      headerRight={
        isSaving ? (
          <ActivityIndicator size="small" color={colors.accentPink} />
        ) : saveState === 'saved' ? (
          <Text style={styles.saved}>Saved</Text>
        ) : null
      }
      scroll={false}
    >
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.section}>{title}</Text>
        )}
        renderItem={({ item }) => (
          <PriceRow
            styleId={item.id}
            name={item.name}
            variant={item.variant}
            venueLabel={item.venueLabel}
            price={getPrice(item.id)}
            onDecrease={() => updatePrice(item.id, getPrice(item.id) - PRICE_STEP)}
            onIncrease={() => updatePrice(item.id, getPrice(item.id) + PRICE_STEP)}
            onSetPrice={(value) => updatePrice(item.id, value)}
          />
        )}
        ListFooterComponent={saveError ? <Text style={styles.error}>{saveError}</Text> : null}
      />
    </BusinessScreenLayout>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 40 },
  section: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  rowContent: { flex: 1 },
  venue: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  name: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 2 },
  variant: { color: colors.textMuted, fontSize: 13, marginBottom: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.accentPinkMuted,
    borderWidth: 1,
    borderColor: colors.accentPinkBorder,
  },
  stepText: { color: colors.accentPink, fontSize: 12, fontWeight: '700' },
  priceInput: {
    minWidth: 52,
    textAlign: 'center',
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 4,
  },
  saved: { color: colors.accentPink, fontSize: 13, fontWeight: '600' },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center', marginTop: 12 },
});
