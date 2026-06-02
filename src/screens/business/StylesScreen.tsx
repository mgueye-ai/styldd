import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { ActivityIndicator } from 'react-native';
import BusinessScreenLayout from '../../components/business/BusinessScreenLayout';
import SiteStylesEditor from '../../components/site/SiteStylesEditor';
import { useServiceCatalog } from '../../context/ServiceCatalogContext';
import { useSiteData } from '../../context/SiteDataContext';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { colors } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Styles'>;

export default function StylesScreen({ navigation }: Props) {
  const { hasLinkedSite } = useSiteData();
  const { refresh, isSaving } = useServiceCatalog();

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  return (
    <BusinessScreenLayout
      title="Styles"
      onBack={() => navigation.goBack()}
      hasLinkedSite={hasLinkedSite}
      linkMessage="Link your site to add styles with photos, descriptions, and prices."
      scroll={false}
      headerRight={
        isSaving ? <ActivityIndicator size="small" color={colors.accentPink} /> : null
      }
    >
      <SiteStylesEditor manageKeyboard />
    </BusinessScreenLayout>
  );
}
