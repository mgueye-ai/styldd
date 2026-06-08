import { StyleSheet, View } from 'react-native';
import { BookingHours } from '../../data/bookingHours';
import { colors } from '../../theme';
import {
  buildScheduleClosedOverlays,
  getOverlayHeight,
  getOverlayTop,
  overlayFromBlock,
  TimelineOverlay,
} from './timelineUtils';
import { BlockedInterval } from '../../lib/siteAdmin';
import { toDateKey } from '../../lib/siteData';

type TimelineClosedLayersProps = {
  selectedDate: Date;
  bookingHours: BookingHours;
  blocks?: BlockedInterval[];
  timelineStartHour?: number;
  hourHeight?: number;
};

export default function TimelineClosedLayers({
  selectedDate,
  bookingHours,
  blocks = [],
  timelineStartHour = 0,
  hourHeight = 56,
}: TimelineClosedLayersProps) {
  const dateKey = toDateKey(selectedDate);
  const closedOverlays = buildScheduleClosedOverlays(selectedDate, bookingHours);
  const blockOverlays = blocks
    .map((block) => overlayFromBlock(block, dateKey))
    .filter((overlay): overlay is TimelineOverlay => overlay !== null);

  const layers = [...closedOverlays, ...blockOverlays];

  return (
    <>
      {layers.map((overlay) => (
        <View
          key={`${overlay.variant}-${overlay.id}`}
          style={[
            styles.layer,
            overlay.variant === 'closed' && styles.layerClosed,
            overlay.variant === 'block' && styles.layerBlock,
            {
              top: getOverlayTop(overlay, timelineStartHour),
              height: getOverlayHeight(overlay),
            },
          ]}
          pointerEvents="none"
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1,
    borderRadius: 12,
  },
  layerClosed: {
    backgroundColor: 'rgba(148, 163, 184, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.32)',
  },
  layerBlock: {
    backgroundColor: 'rgba(248, 113, 113, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
});
