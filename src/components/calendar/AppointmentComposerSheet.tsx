import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ServiceImage from '../ServiceImage';
import { Client } from '../../data/clients';
import { CatalogService, groupCatalogByCategory } from '../../data/serviceCatalog';
import { colors } from '../../theme';
import { formatTimeRange, TimeRange } from './timelineUtils';

type AppointmentComposerSheetProps = {
  visible: boolean;
  range: TimeRange | null;
  catalogServices: CatalogService[];
  clients: Client[];
  getPrice: (styleId: string) => number;
  saving?: boolean;
  onClose: () => void;
  onSave: (input: {
    range: TimeRange;
    style: CatalogService;
    fullName: string;
    phone: string;
    email: string;
    address: string;
    notes: string;
    hairLength: string;
    isPlaceholder: boolean;
  }) => void;
};

type Step = 'style' | 'client';

function ClientAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View style={styles.clientAvatar}>
      <Text style={styles.clientAvatarText}>{initials || '?'}</Text>
    </View>
  );
}

export default function AppointmentComposerSheet({
  visible,
  range,
  catalogServices,
  clients,
  getPrice,
  saving,
  onClose,
  onSave,
}: AppointmentComposerSheetProps) {
  const [step, setStep] = useState<Step>('style');
  const [selectedStyle, setSelectedStyle] = useState<CatalogService | null>(null);
  const [clientQuery, setClientQuery] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [hairLength, setHairLength] = useState('');
  const [isPlaceholder, setIsPlaceholder] = useState(false);

  const sections = useMemo(() => groupCatalogByCategory(catalogServices), [catalogServices]);

  const filteredClients = useMemo(() => {
    const query = clientQuery.trim().toLowerCase();
    if (!query) return clients;

    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(query) ||
        client.phone.includes(query) ||
        client.email.toLowerCase().includes(query),
    );
  }, [clientQuery, clients]);

  useEffect(() => {
    if (!visible) {
      setStep('style');
      setSelectedStyle(null);
      setClientQuery('');
      setFullName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setNotes('');
      setHairLength('');
      setIsPlaceholder(false);
    }
  }, [visible]);

  const handleClose = () => {
    onClose();
  };

  const selectClient = (client: Client) => {
    setIsPlaceholder(false);
    setFullName(client.name);
    setPhone(client.phone);
    setEmail(client.email);
  };

  const usePlaceholder = () => {
    setIsPlaceholder(true);
    setFullName('Reserved slot');
    setPhone('TBD');
    setEmail('');
  };

  const handleSave = () => {
    if (!range || !selectedStyle) return;
    if (!fullName.trim() || !phone.trim()) return;

    onSave({
      range,
      style: selectedStyle,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      notes: notes.trim(),
      hairLength: hairLength.trim(),
      isPlaceholder,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              {step === 'client' ? (
                <Pressable style={styles.backBtn} onPress={() => setStep('style')}>
                  <Ionicons name="chevron-back" size={20} color={colors.text} />
                </Pressable>
              ) : (
                <View style={styles.backBtn} />
              )}
              <Text style={styles.title}>
                {step === 'style' ? 'Choose a style' : 'Client details'}
              </Text>
              <Pressable style={styles.closeBtn} onPress={handleClose}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
            {range ? <Text style={styles.range}>{formatTimeRange(range.startsAt, range.endsAt)}</Text> : null}
          </View>

          {step === 'style' ? (
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              stickySectionHeadersEnabled={false}
              renderSectionHeader={({ section: { title } }) => (
                <Text style={styles.sectionTitle}>{title}</Text>
              )}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.styleRow,
                    selectedStyle?.id === item.id && styles.styleRowActive,
                  ]}
                  onPress={() => {
                    setSelectedStyle(item);
                    setStep('client');
                  }}
                >
                  <ServiceImage styleId={item.id} size={54} radius={14} />
                  <View style={styles.styleInfo}>
                    <Text style={styles.styleName}>{item.name}</Text>
                    {item.variant !== 'STANDARD' ? (
                      <Text style={styles.styleMeta}>{item.variant}</Text>
                    ) : null}
                    <Text style={styles.stylePrice}>${getPrice(item.id)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.empty}>No styles loaded yet. Link your site first.</Text>
              }
            />
          ) : (
            <ScrollView contentContainerStyle={styles.clientContent} showsVerticalScrollIndicator={false}>
              {selectedStyle ? (
                <View style={styles.selectedStyleCard}>
                  <ServiceImage styleId={selectedStyle.id} size={48} radius={12} />
                  <View style={styles.selectedStyleInfo}>
                    <Text style={styles.selectedStyleName}>{selectedStyle.name}</Text>
                    <Text style={styles.selectedStyleMeta}>
                      {selectedStyle.variant !== 'STANDARD' ? `${selectedStyle.variant} · ` : ''}$
                      {getPrice(selectedStyle.id)}
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.quickActions}>
                <Pressable
                  style={[styles.quickChip, isPlaceholder && styles.quickChipActive]}
                  onPress={usePlaceholder}
                >
                  <Ionicons name="bookmark-outline" size={14} color={colors.text} />
                  <Text style={styles.quickChipText}>Placeholder</Text>
                </Pressable>
              </View>

              <Text style={styles.sectionLabel}>Saved clients</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search clients"
                placeholderTextColor={colors.textMuted}
                value={clientQuery}
                onChangeText={setClientQuery}
              />

              {filteredClients.length === 0 ? (
                <Text style={styles.emptyClients}>No saved clients match your search.</Text>
              ) : (
                filteredClients.map((client) => (
                  <Pressable
                    key={client.id}
                    style={[
                      styles.clientRow,
                      fullName === client.name && !isPlaceholder && styles.clientRowActive,
                    ]}
                    onPress={() => selectClient(client)}
                  >
                    <ClientAvatar name={client.name} />
                    <View style={styles.clientInfo}>
                      <Text style={styles.clientName}>{client.name}</Text>
                      <Text style={styles.clientMeta}>{client.phone}</Text>
                    </View>
                  </Pressable>
                ))
              )}

              <Text style={styles.sectionLabel}>Or enter manually</Text>
              <Field label="Name" value={fullName} onChangeText={(value) => {
                setIsPlaceholder(false);
                setFullName(value);
              }} />
              <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
              <Field label="Hair length" value={hairLength} onChangeText={setHairLength} />
              <Field label="Notes" value={notes} onChangeText={setNotes} multiline />

              {selectedStyle?.venue === 'house' ? (
                <Field label="House call address" value={address} onChangeText={setAddress} />
              ) : null}

              <Pressable
                style={styles.primaryBtn}
                onPress={handleSave}
                disabled={saving || !selectedStyle || !fullName.trim() || !phone.trim()}
              >
                <Text style={styles.primaryBtnText}>
                  {saving ? 'Saving…' : 'Save appointment'}
                </Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.progressTrack,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  range: {
    color: colors.accentPink,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8,
  },
  styleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  styleRowActive: {
    backgroundColor: colors.accentPinkMuted,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  styleInfo: {
    flex: 1,
  },
  styleName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  styleMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  stylePrice: {
    color: colors.accentPink,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  clientContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  selectedStyleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.accentPinkMuted,
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
    marginBottom: 12,
  },
  selectedStyleInfo: {
    flex: 1,
  },
  selectedStyleName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  selectedStyleMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickChipActive: {
    backgroundColor: colors.accentPinkMuted,
    borderColor: colors.accentPinkBorder,
  },
  quickChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    marginBottom: 10,
  },
  emptyClients: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 16,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  clientRowActive: {
    backgroundColor: colors.accentPinkMuted,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.navbar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  clientMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  fieldWrap: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: colors.accentPink,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
});
