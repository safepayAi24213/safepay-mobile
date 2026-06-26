import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { TextField } from '@/components/ui/text-field';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { ApiError, onboarding } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type DocType = 'national_id' | 'passport';

export default function VerifyId() {
  const router = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ phone?: string }>();

  const [docType, setDocType] = useState<DocType>('national_id');
  const [docNumber, setDocNumber] = useState('');
  const [frontImageUri, setFrontImageUri] = useState<string | null>(null);
  const [backImageUri, setBackImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit =
    docNumber.length >= 6 &&
    frontImageUri !== null &&
    (docType === 'passport' || backImageUri !== null);

  const pickImage = async (side: 'front' | 'back') => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'We need access to your photo library to pick your document image.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        if (side === 'front') {
          setFrontImageUri(result.assets[0].uri);
        } else {
          setBackImageUri(result.assets[0].uri);
        }
      }
    } catch (err) {
      Alert.alert('Error picking image', 'Something went wrong. Please try again.');
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      if (token) {
        // 1. Submit KYC details
        await onboarding.verifyId(token, {
          id_type: docType,
          national_id: docNumber.trim(),
        });

        // 2. Upload front document photo (primary document image)
        if (frontImageUri) {
          await onboarding.uploadIdDocument(token, frontImageUri);
        }
      }
      router.replace({ pathname: '/(auth)/create-pin', params: { phone: params.phone } });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not save your ID.';
      Alert.alert('Verification failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets>
          <View style={styles.header}>
            <Text style={styles.title}>Verify your identity</Text>
            <Text style={styles.subtitle}>
              A quick check to confirm it&apos;s really you.
            </Text>
          </View>

          <View style={styles.tabRow}>
            {(['national_id', 'passport'] as DocType[]).map((t) => {
              const active = docType === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => {
                    setDocType(t);
                    setFrontImageUri(null);
                    setBackImageUri(null);
                  }}
                  style={[styles.tab, active && styles.tabActive]}>
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {t === 'national_id' ? 'National ID' : 'Passport'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextField
            label={docType === 'national_id' ? 'ID number' : 'Passport number'}
            leftIcon="card-outline"
            placeholder={
              docType === 'national_id' ? 'Enter your ID number' : 'Enter your passport number'
            }
            autoCapitalize="characters"
            value={docNumber}
            onChangeText={setDocNumber}
          />

          <View style={styles.uploads}>
            <UploadSlot
              label={docType === 'passport' ? 'Photo page' : 'Front of ID'}
              imageUri={frontImageUri}
              onPress={() => pickImage('front')}
            />
            {docType === 'national_id' && (
              <UploadSlot
                label="Back of ID"
                imageUri={backImageUri}
                onPress={() => pickImage('back')}
              />
            )}
          </View>

          <View style={styles.notice}>
            <Ionicons name="lock-closed-outline" size={16} color={Brand.success} />
            <Text style={styles.noticeText}>Your documents stay private.</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button label="Continue" onPress={submit} loading={loading} disabled={!canSubmit} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type SlotProps = {
  label: string;
  imageUri: string | null;
  onPress: () => void;
};

function UploadSlot({ label, imageUri, onPress }: SlotProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.slot,
        imageUri !== null && styles.slotCaptured,
        pressed && { opacity: 0.85 },
      ]}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.previewImage} />
      ) : (
        <Ionicons name="camera-outline" size={28} color={Brand.primary} />
      )}
      <Text style={[styles.slotLabel, imageUri !== null && { color: Brand.success }]}>
        {imageUri ? 'Captured' : label}
      </Text>
      {!imageUri && <Text style={styles.slotHint}>Tap to upload</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Brand.bg,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  header: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Brand.text,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: Brand.textSecondary,
    textAlign: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Brand.surface,
    borderRadius: Radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.sm + 2,
  },
  tabActive: {
    backgroundColor: Brand.surfaceElevated,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.textMuted,
  },
  tabLabelActive: {
    color: Brand.text,
  },
  uploads: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  slot: {
    flex: 1,
    height: 140,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderStyle: 'dashed',
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: Spacing.sm,
  },
  slotCaptured: {
    borderStyle: 'solid',
    borderColor: Brand.success,
    backgroundColor: Brand.successSoft,
  },
  previewImage: {
    width: '100%',
    height: 70,
    borderRadius: Radius.sm,
    marginBottom: 4,
  },
  slotLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.text,
    textAlign: 'center',
  },
  slotHint: {
    fontSize: 11,
    color: Brand.textMuted,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: Spacing.xs,
  },
  noticeText: {
    fontSize: 12,
    color: Brand.textMuted,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
});
