import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

export async function pickAvatarImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'Photo access needed',
      Platform.OS === 'web'
        ? 'Allow the browser to access your photos to upload a profile picture.'
        : 'Enable photo library access in Settings to upload a profile picture.',
    );
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return null;
  }

  return result.assets[0].uri;
}
