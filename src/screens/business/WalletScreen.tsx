import { NativeStackScreenProps } from '@react-navigation/native-stack';
import WalletBalanceSection from '../../components/WalletBalanceSection';
import BusinessScreenLayout from '../../components/business/BusinessScreenLayout';
import { useSiteData } from '../../context/SiteDataContext';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Wallet'>;

export default function WalletScreen({ navigation }: Props) {
  const { hasLinkedSite } = useSiteData();

  return (
    <BusinessScreenLayout
      title="Payments"
      onBack={() => navigation.goBack()}
      hasLinkedSite={hasLinkedSite}
      linkMessage="Link your booking site before setting up payments."
    >
      <WalletBalanceSection />
    </BusinessScreenLayout>
  );
}
