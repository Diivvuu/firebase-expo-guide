import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../FirebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { MotiView } from 'moti';

interface UserProfile {
  email: string;
  name: string;
  bio: string;
  phoneNumber: string;
  lastSeen: any;
}

export default function ProfileScreen() {
  const params = useLocalSearchParams();
  const userId = params.userId as string;
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const isOwnProfile = userId === auth.currentUser?.uid;

  useEffect(() => {
    const fetchProfile = async () => {
      console.log('Fetching profile for userId:', userId);
      if (!userId) {
        console.log('No userId provided');
        setLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        console.log('User doc exists:', userDoc.exists());
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('User data:', userData);
          setProfile(userData as UserProfile);
        } else {
          console.error('User document does not exist for ID:', userId);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  const handleEditProfile = () => {
    router.push('/edit-profile');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A237E" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Profile not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen
        options={{
          title: isOwnProfile ? 'My Profile' : profile.name,
          headerShown: true,
          headerRight: () =>
            isOwnProfile ? (
              <TouchableOpacity
                onPress={handleEditProfile}
                style={styles.editButton}
              >
                <Ionicons name="create-outline" size={24} color="#1A237E" />
              </TouchableOpacity>
            ) : null,
        }}
      />

      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300 }}
        style={styles.profileHeader}
      >
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {profile.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.email}>{profile.email}</Text>
      </MotiView>

      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300, delay: 100 }}
        style={styles.infoContainer}
      >
        {profile.phoneNumber && (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={24} color="#666" />
            <Text style={styles.infoText}>{profile.phoneNumber}</Text>
          </View>
        )}

        {profile.bio && (
          <View style={styles.infoRow}>
            <Ionicons
              name="information-circle-outline"
              size={24}
              color="#666"
            />
            <Text style={styles.infoText}>{profile.bio}</Text>
          </View>
        )}

        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={24} color="#666" />
          <Text style={styles.infoText}>
            Last seen:{' '}
            {profile.lastSeen?.toDate?.()?.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }) || 'Offline'}
          </Text>
        </View>
      </MotiView>
    </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  editButton: {
    marginRight: 16,
  },
  profileHeader: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1A237E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 40,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: '#666',
  },
  infoContainer: {
    padding: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  backButton: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#1A237E',
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
