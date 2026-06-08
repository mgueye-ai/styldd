import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Client } from '../../data/clients';
import {
  CLIENT_EMAIL_TEMPLATES,
  ClientEmailTemplateId,
  getClientEmailTemplate,
} from '../../data/clientEmailTemplates';
import { sendClientEmails } from '../../lib/clientEmail';
import { colors } from '../../theme';

type ClientContactSheetProps = {
  visible: boolean;
  clients: Client[];
  businessLabel: string;
  siteUrl: string;
  onClose: () => void;
  onSent: () => void;
};

function hasValidEmail(client: Client): boolean {
  const email = client.email.trim();
  return Boolean(email && email !== '—' && email.includes('@'));
}

export default function ClientContactSheet({
  visible,
  clients,
  businessLabel,
  siteUrl,
  onClose,
  onSent,
}: ClientContactSheetProps) {
  const [templateId, setTemplateId] = useState<ClientEmailTemplateId>('book_again');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const sendable = useMemo(() => clients.filter(hasValidEmail), [clients]);
  const missingEmail = clients.length - sendable.length;
  const template = getClientEmailTemplate(templateId);
  const isCustom = templateId === 'custom';

  useEffect(() => {
    if (!visible) return;
    const next = getClientEmailTemplate(templateId);
    if (templateId !== 'custom') {
      setSubject(next.defaultSubject);
    } else {
      setSubject('');
    }
  }, [visible, templateId]);

  const handleClose = () => {
    if (sending) return;
    setTemplateId('book_again');
    setSubject('');
    setMessage('');
    onClose();
  };

  const handleSend = async () => {
    if (!sendable.length) {
      Alert.alert('No email addresses', 'None of the selected clients have an email on file.');
      return;
    }

    if (!subject.trim()) {
      Alert.alert('Subject required', 'Add a subject line for your email.');
      return;
    }

    if (isCustom && !message.trim()) {
      Alert.alert('Message required', 'Write a message for your clients.');
      return;
    }

    setSending(true);
    try {
      const result = await sendClientEmails({
        templateId,
        recipients: sendable.map((client) => ({
          email: client.email.trim(),
          name: client.name,
        })),
        subject: subject.trim(),
        message: message.trim() || undefined,
      });

      if (result.sent === 0) {
        const detail = result.errors?.[0] ?? 'No emails were sent.';
        Alert.alert('Send failed', detail);
        return;
      }

      const parts = [`${result.sent} email${result.sent === 1 ? '' : 's'} sent.`];
      if (result.skipped > 0) parts.push(`${result.skipped} skipped (no email).`);
      if (result.failed > 0) parts.push(`${result.failed} failed.`);

      Alert.alert('Sent!', parts.join(' '), [
        {
          text: 'OK',
          onPress: () => {
            handleClose();
            onSent();
          },
        },
      ]);
    } catch (err) {
      Alert.alert('Could not send', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <Text style={styles.title}>Email clients</Text>
          <Text style={styles.subtitle}>
            Sending as {businessLabel}
            {siteUrl ? ` · ${siteUrl.replace(/^https?:\/\//, '')}` : ''}
          </Text>

          <View style={styles.recipientPill}>
            <Ionicons name="people" size={14} color={colors.accentPink} />
            <Text style={styles.recipientText}>
              {sendable.length} recipient{sendable.length === 1 ? '' : 's'}
              {missingEmail > 0 ? ` · ${missingEmail} without email` : ''}
            </Text>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sectionLabel}>Template</Text>
            <View style={styles.templateGrid}>
              {CLIENT_EMAIL_TEMPLATES.map((item) => {
                const active = item.id === templateId;
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.templateCard, active && styles.templateCardActive]}
                    onPress={() => setTemplateId(item.id)}
                  >
                    <Text style={[styles.templateLabel, active && styles.templateLabelActive]}>
                      {item.label}
                    </Text>
                    <Text style={styles.templateDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {!isCustom && template.previewLine ? (
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>Preview</Text>
                <Text style={styles.previewText}>{template.previewLine}</Text>
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>Subject</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="Email subject"
              placeholderTextColor={colors.textMuted}
            />

            {(isCustom || templateId === 'promo' || templateId === 'check_in') && (
              <>
                <Text style={styles.sectionLabel}>
                  {isCustom ? 'Message' : 'Add a personal note (optional)'}
                </Text>
                <TextInput
                  style={[styles.input, styles.messageInput]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder={isCustom ? 'Write your message…' : 'Extra details for this email…'}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  textAlignVertical="top"
                />
              </>
            )}

            <View style={styles.recipientList}>
              <Text style={styles.sectionLabel}>To</Text>
              {sendable.map((client) => (
                <View key={client.id} style={styles.recipientRow}>
                  <Text style={styles.recipientName} numberOfLines={1}>{client.name}</Text>
                  <Text style={styles.recipientEmail} numberOfLines={1}>{client.email}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <Pressable
            style={[styles.sendBtn, (sending || !sendable.length) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={sending || !sendable.length}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={16} color="#fff" />
                <Text style={styles.sendBtnText}>
                  Send to {sendable.length} client{sendable.length === 1 ? '' : 's'}
                </Text>
              </>
            )}
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={handleClose} disabled={sending}>
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
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    marginTop: 10,
    marginBottom: 16,
    opacity: 0.35,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 12,
  },
  recipientPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.accentPinkMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  recipientText: {
    color: colors.accentPink,
    fontSize: 12,
    fontWeight: '600',
  },
  scroll: {
    maxHeight: 420,
  },
  scrollContent: {
    paddingBottom: 8,
    gap: 8,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.06,
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 6,
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  templateCard: {
    width: '48%',
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
    gap: 4,
  },
  templateCardActive: {
    borderColor: colors.accentPinkBorder,
    backgroundColor: colors.accentPinkMuted,
  },
  templateLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  templateLabelActive: {
    color: colors.accentPink,
  },
  templateDesc: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  previewBox: {
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
    marginTop: 4,
  },
  previewLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.08,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  previewText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageInput: {
    minHeight: 110,
    paddingTop: 12,
  },
  recipientList: {
    marginTop: 4,
    gap: 6,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recipientName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  recipientEmail: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'right',
  },
  sendBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accentPink,
    borderRadius: 14,
    paddingVertical: 14,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
});
