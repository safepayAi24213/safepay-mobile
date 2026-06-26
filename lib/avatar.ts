import { useState } from 'react';
import { Alert } from 'react-native';

import { ApiError, users } from './api';
import { useAuth } from './auth-context';

/**
 * Profile-picture picker: take a selfie or choose from the gallery, upload to
 * the backend, and reflect the new photo in the auth context immediately.
 *
 * expo-image-picker is imported lazily (only when the user actually picks) so
 * the Profile screen never evaluates the native module at mount — that keeps
 * the screen resilient even right after the package is added to a running app.
 */

type PickedAsset = { uri: string; fileName?: string | null; mimeType?: string | null };

export function useAvatarPicker() {
  const { token, updateUser } = useAuth();
  const [busy, setBusy] = useState(false);

  const upload = async (asset: PickedAsset) => {
    if (!token) return;
    setBusy(true);
    try {
      const updated = await users.uploadAvatar(token, {
        uri: asset.uri,
        name: asset.fileName ?? 'avatar.jpg',
        mimeType: asset.mimeType ?? 'image/jpeg',
      });
      updateUser({ avatar_url: updated.avatar_url });
    } catch (err) {
      Alert.alert('Upload failed', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const fromCamera = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera blocked', 'Enable camera access in Settings to take a selfie.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      });
      if (!res.canceled && res.assets[0]) await upload(res.assets[0]);
    } catch {
      Alert.alert('Camera unavailable', 'Please fully restart the app and try again.');
    }
  };

  const fromLibrary = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Photos blocked', 'Enable photo access in Settings to choose a picture.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      });
      if (!res.canceled && res.assets[0]) await upload(res.assets[0]);
    } catch {
      Alert.alert('Gallery unavailable', 'Please fully restart the app and try again.');
    }
  };

  const remove = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const updated = await users.removeAvatar(token);
      updateUser({ avatar_url: updated.avatar_url });
    } catch (err) {
      Alert.alert('Could not remove', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return { busy, fromCamera, fromLibrary, remove };
}
