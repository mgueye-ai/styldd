import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { maskMoneyInText } from '../utils/money';

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  time: string;
  icon: keyof typeof Ionicons.glyphMap;
  unread?: boolean;
};

type Props = {
  visible: boolean;
  notifications: AppNotification[];
  privacyMode: boolean;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
};

export default function NotificationsPanel({
  visible,
  notifications,
  privacyMode,
  onClose,
  onMarkRead,
  onMarkAllRead,
}: Props) {
  const insets = useSafeAreaInsets();
  const unreadCount = notifications.filter((item) => item.unread).length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Notifications</Text>
              <Text style={styles.subtitle}>
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </Text>
            </View>

            {unreadCount > 0 ? (
              <Pressable onPress={onMarkAllRead}>
                <Text style={styles.markAll}>Mark all read</Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {notifications.map((item, index) => (
              <Pressable
                key={item.id}
                style={[
                  styles.notificationRow,
                  index !== notifications.length - 1 && styles.notificationBorder,
                  item.unread && styles.notificationUnread,
                ]}
                onPress={() => onMarkRead(item.id)}
              >
                <View style={[styles.iconWrap, item.unread && styles.iconWrapUnread]}>
                  <Ionicons name={item.icon} size={18} color={colors.text} />
                </View>

                <View style={styles.notificationContent}>
                  <View style={styles.notificationTop}>
                    <Text style={styles.notificationTitle}>{item.title}</Text>
                    <Text style={styles.notificationTime}>{item.time}</Text>
                  </View>
                  <Text style={styles.notificationBody}>
                    {maskMoneyInText(item.body, privacyMode)}
                  </Text>
                </View>

                {item.unread ? <View style={styles.unreadDot} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  panel: {
    maxHeight: '72%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  markAll: {
    color: colors.chartBlue,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 8,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  notificationBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  notificationUnread: {
    backgroundColor: colors.accentPinkSoft,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconWrapUnread: {
    borderColor: colors.accentPinkRing,
    backgroundColor: colors.accentBlueMuted,
  },
  notificationContent: {
    flex: 1,
    paddingRight: 8,
  },
  notificationTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  notificationTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  notificationTime: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  notificationBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.chartBlue,
    marginTop: 6,
  },
});
