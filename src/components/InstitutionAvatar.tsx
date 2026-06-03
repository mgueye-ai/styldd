import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { resolveBankLogoSources } from '../lib/logokit';
import { resolveBankDomain } from '../lib/institutionDomains';
import { colors } from '../theme';

type Props = {
  institutionName?: string | null;
  institutionDomain?: string | null;
  institutionLogoUri?: string | null;
  size?: number;
};

/** Deterministic muted color from institution name initials. */
function initialsColor(name: string): string {
  const palette = [
    '#2d6a4f', '#1d3557', '#6d3b47', '#3d405b',
    '#5c4033', '#2e4057', '#4a4e69', '#355070',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export default function InstitutionAvatar({
  institutionName,
  institutionDomain,
  institutionLogoUri,
  size = 44,
}: Props) {
  const sources = resolveBankLogoSources({
    institutionName,
    institutionDomain,
    institutionLogoUri,
  });

  const [index, setIndex] = useState(0);
  const currentSrc = sources[index];

  const name = institutionName?.trim() || '?';
  const initials = getInitials(name);
  const bgColor = initialsColor(name);

  const radius = size / 4;

  if (currentSrc) {
    return (
      <Image
        source={{ uri: currentSrc }}
        style={[styles.logo, { width: size, height: size, borderRadius: radius }]}
        resizeMode="contain"
        onError={() => {
          if (index < sources.length - 1) {
            setIndex((i) => i + 1);
          } else {
            // All sources exhausted — trigger initials render by clearing index
            setIndex(sources.length); // out of range → falls through to initials
          }
        }}
      />
    );
  }

  // Initials fallback
  return (
    <View
      style={[
        styles.initials,
        { width: size, height: size, borderRadius: radius, backgroundColor: bgColor },
      ]}
    >
      <Text style={[styles.initialsText, { fontSize: size * 0.35 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    backgroundColor: '#fff',
  },
  initials: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
