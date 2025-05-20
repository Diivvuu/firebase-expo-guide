import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  SectionList,
} from 'react-native';
import React, { useEffect, useState, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db, auth } from '../../FirebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';

interface User {
  id: string;
  name: string;
  email: string;
  lastSeen?: any;
  hasChat?: boolean;
}

interface Section {
  title: string;
  data: User[];
}

export default function UsersScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sections, setSections] = useState<Section[]>([]);

  const fetchUsers = async () => {
    try {
      const usersRef = collection(db, 'users');
      const querySnapshot = await getDocs(usersRef);

      const usersList: User[] = [];
      for (const doc of querySnapshot.docs) {
        const userData = doc.data();
        // Skip the current user
        if (userData.uid === auth.currentUser?.uid) continue;

        usersList.push({
          id: doc.id,
          name: userData.name || 'Unknown User',
          email: userData.email || '',
          lastSeen: userData.lastSeen,
        });
      }

      // Check for existing chats
      const chatRoomsRef = collection(db, 'chatRooms');
      const chatQuery = query(
        chatRoomsRef,
        where('participants', 'array-contains', auth.currentUser?.uid)
      );
      const chatSnapshot = await getDocs(chatQuery);

      const usersWithChats = new Set<string>();
      chatSnapshot.forEach((doc) => {
        const data = doc.data();
        const otherUserId = data.participants.find(
          (id: string) => id !== auth.currentUser?.uid
        );
        if (otherUserId) {
          usersWithChats.add(otherUserId);
        }
      });

      // Mark users with existing chats
      const usersWithChatStatus = usersList.map((user) => ({
        ...user,
        hasChat: usersWithChats.has(user.id),
      }));

      setUsers(usersWithChatStatus);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const filteredUsers = users.filter(
      (user) =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const existingChats = filteredUsers.filter((user) => user.hasChat);
    const newUsers = filteredUsers.filter((user) => !user.hasChat);

    setSections([
      {
        title: 'Existing Chats',
        data: existingChats,
      },
      {
        title: 'New Users',
        data: newUsers,
      },
    ]);
  }, [users, searchQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUsers();
  }, []);

  const handleChatPress = (userId: string) => {
    router.push({
      pathname: '/chat',
      params: { userId },
    });
  };

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => handleChatPress(item.id)}
    >
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarText}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
      </View>
      <Ionicons
        name={item.hasChat ? 'chatbubble' : 'chatbubble-outline'}
        size={24}
        color={item.hasChat ? '#1A237E' : '#666'}
      />
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A237E" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Users',
          headerShown: true,
        }}
      />
      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={20}
          color="#666"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        {searchQuery ? (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        ) : null}
      </View>

      <SectionList
        sections={sections}
        renderItem={renderUserItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        }
      />
    </View>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F5F5F5',
    margin: 16,
    borderRadius: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  listContent: {
    padding: 16,
  },
  sectionHeader: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1A237E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
