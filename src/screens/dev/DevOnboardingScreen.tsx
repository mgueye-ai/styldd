import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AccountOnboardingFlow from '../onboarding/AccountOnboardingFlow';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';

type Props = NativeStackScreenProps<ProfileStackParamList, 'DevOnboarding'>;

export default function DevOnboardingScreen({ navigation }: Props) {
  return (
    <AccountOnboardingFlow previewOnly onComplete={() => navigation.goBack()} />
  );
}
