import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../FirebaseConfig';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';

interface UserProfile {
  name: string;
  email: string;
  phoneNumber?: string;
  bio?: string;
}

export default function EditProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    email: '',
    phoneNumber: '',
    bio: '',
  });
  const [errors, setErrors] = useState<Partial<UserProfile>>({});

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      if (!auth.currentUser?.uid) return;

      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setProfile({
          name: data.name || '',
          email: data.email || '',
          phoneNumber: data.phoneNumber || '',
          bio: data.bio || '',
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const validateInputs = () => {
    const newErrors: Partial<UserProfile> = {};

    if (!profile.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (profile.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (profile.phoneNumber && !/^\+?[\d\s-]{10,}$/.test(profile.phoneNumber)) {
      newErrors.phoneNumber = 'Invalid phone number format';
    }

    if (profile.bio && profile.bio.length > 200) {
      newErrors.bio = 'Bio must be less than 200 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateInputs()) return;

    try {
      setSaving(true);
      if (!auth.currentUser?.uid) return;

      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        name: profile.name.trim(),
        phoneNumber: profile.phoneNumber?.trim() || null,
        bio: profile.bio?.trim() || null,
        updatedAt: new Date(),
      });

      Alert.alert('Success', 'Profile updated successfully');
      router.back();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A237E" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen
        options={{
          title: 'Edit Profile',
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={styles.saveButton}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#1A237E" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.scrollView}>
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300 }}
        >
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {profile.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={[styles.input, errors.name ? styles.inputError : null]}
                value={profile.name}
                onChangeText={(text) => {
                  setProfile((prev) => ({ ...prev, name: text }));
                  if (errors.name) {
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                placeholder="Enter your name"
                placeholderTextColor="#999"
              />
              {errors.name && (
                <Text style={styles.errorText}>{errors.name}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, styles.disabledInput]}
                value={profile.email}
                editable={false}
                placeholderTextColor="#999"
              />
              <Text style={styles.helperText}>Email cannot be changed</Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={[
                  styles.input,
                  errors.phoneNumber ? styles.inputError : null,
                ]}
                value={profile.phoneNumber}
                onChangeText={(text) => {
                  setProfile((prev) => ({ ...prev, phoneNumber: text }));
                  if (errors.phoneNumber) {
                    setErrors((prev) => ({ ...prev, phoneNumber: undefined }));
                  }
                }}
                placeholder="Enter your phone number"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
              {errors.phoneNumber && (
                <Text style={styles.errorText}>{errors.phoneNumber}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.bioInput,
                  errors.bio ? styles.inputError : null,
                ]}
                value={profile.bio}
                onChangeText={(text) => {
                  setProfile((prev) => ({ ...prev, bio: text }));
                  if (errors.bio) {
                    setErrors((prev) => ({ ...prev, bio: undefined }));
                  }
                }}
                placeholder="Tell us about yourself"
                placeholderTextColor="#999"
                multiline
                maxLength={200}
              />
              <Text style={styles.helperText}>
                {profile.bio?.length || 0}/200 characters
              </Text>
              {errors.bio && <Text style={styles.errorText}>{errors.bio}</Text>}
            </View>
          </View>
        </MotiView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1A237E',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 24,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  form: {
    padding: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#D32F2F',
  },
  disabledInput: {
    backgroundColor: '#F5F5F5',
    color: '#666',
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
    marginTop: 4,
  },
  helperText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  saveButton: {
    marginRight: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    color: '#1A237E',
    fontSize: 16,
    fontWeight: '600',
  },
});
