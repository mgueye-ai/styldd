import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export type PickedSiteImage = {
  uri: string;
  mimeType?: string | null;
};

export async function pickSiteImageFromLibrary(
  permissionMessage: string,
): Promise<PickedSiteImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permission needed', permissionMessage);
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? null,
  };
}
