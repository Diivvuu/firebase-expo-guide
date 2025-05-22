import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import React, { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  getDocs,
  getDoc,
  doc,
  DocumentData,
  DocumentReference,
} from 'firebase/firestore';
import { db, auth } from '../../FirebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';

interface UserData {
  name?: string;
  email?: string;
}

interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage: {
    text: string;
    timestamp: any;
    senderId: string;
    read: boolean;
  };
  unreadCount: number;
  otherUserName: string;
  otherUserEmail: string;
}

interface ChatRoomData {
  participants: string[];
  lastMessage?: {
    text: string;
    timestamp: any;
    senderId: string;
    read: boolean;
  };
  unreadCount?: {
    [key: string]: number;
  };
  createdAt: any;
}

export default function ChatsScreen() {
  const router = useRouter();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser?.uid) return;

    const chatRoomsRef = collection(db, 'chatRooms');
    const q = query(
      chatRoomsRef,
      where('participants', 'array-contains', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const rooms: ChatRoom[] = [];
        let totalUnread = 0;

        // Sort rooms in memory after fetching
        const sortedDocs = snapshot.docs.sort((a, b) => {
          const aData = a.data() as ChatRoomData;
          const bData = b.data() as ChatRoomData;
          const aTime = aData.lastMessage?.timestamp?.toMillis?.() || 0;
          const bTime = bData.lastMessage?.timestamp?.toMillis?.() || 0;
          return bTime - aTime;
        });

        for (const docSnapshot of sortedDocs) {
          try {
            const data = docSnapshot.data() as ChatRoomData;
            const otherUserId = data.participants.find(
              (id: string) => id !== auth.currentUser?.uid
            );

            if (!otherUserId) continue;

            const userDocRef = doc(db, 'users', otherUserId);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
              console.warn(`User document not found for ID: ${otherUserId}`);
              continue;
            }

            const userData = userDoc.data() as UserData;
            const unreadCount =
              data.unreadCount?.[auth.currentUser?.uid || ''] || 0;
            totalUnread += unreadCount;

            rooms.push({
              id: docSnapshot.id,
              participants: data.participants,
              lastMessage: {
                text: data.lastMessage?.text || '',
                timestamp: data.lastMessage?.timestamp,
                senderId: data.lastMessage?.senderId || '',
                read: data.lastMessage?.read || false,
              },
              unreadCount,
              otherUserName: userData?.name || 'Unknown User',
              otherUserEmail: userData?.email || '',
            });
          } catch (error) {
            console.error('Error processing chat room:', error);
            continue;
          }
        }

        setChatRooms(rooms);
        setUnreadTotal(totalUnread);
        setError(null);
      } catch (error) {
        console.error('Error fetching chat rooms:', error);
        setError('Failed to load chat rooms');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const renderChatRoom = ({ item }: { item: ChatRoom }) => {
    const isOwnMessage = item.lastMessage.senderId === auth.currentUser?.uid;

    function formatTime(date: Date) {
      let h = date.getHours();
      const m = date.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      const mm = m < 10 ? `0${m}` : m;
      return `${h}:${mm} ${ampm}`;
    }
    const rawDate = item.lastMessage.timestamp?.toDate?.();
    const timestamp = rawDate ? formatTime(rawDate) : '';

    return (
      <TouchableOpacity
        style={styles.chatRoom}
        onPress={() => {
          const otherUserId = item.participants.find(
            (id) => id !== auth.currentUser?.uid
          );
          if (!otherUserId) return;

          router.push({
            pathname: '/chat',
            params: { userId: otherUserId },
          });
        }}
      >
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {item.otherUserName.charAt(0).toUpperCase()}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.userName}>{item.otherUserName}</Text>
            <Text
              style={styles.timestamp}
              numberOfLines={1}
              ellipsizeMode="clip"
            >
              {timestamp}
            </Text>
          </View>
          <View style={styles.messagePreview}>
            <Text
              style={[
                styles.lastMessage,
                item.unreadCount > 0 && styles.unreadMessage,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {isOwnMessage ? 'You: ' : ''}
              {item.lastMessage.text}
            </Text>
            {isOwnMessage && (
              <Ionicons
                name={item.lastMessage.read ? 'checkmark-done' : 'checkmark'}
                size={16}
                color={item.lastMessage.read ? '#1A237E' : '#999'}
                style={styles.readIcon}
              />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A237E" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setLoading(true);
            setError(null);
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Chats',
          headerRight: () => (
            <View style={styles.headerRight}>
              {unreadTotal > 0 && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{unreadTotal}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      {chatRooms.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No active chats</Text>
          <Text style={styles.emptySubText}>
            Start a conversation from the Users tab
          </Text>
        </View>
      ) : (
        <FlatList
          data={chatRooms}
          renderItem={renderChatRoom}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatList}
        />
      )}
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  list: {
    padding: 16,
  },
  chatContainer: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    alignItems: 'center',
  },
  chatInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    flexShrink: 1,
    minWidth: 30,
  },

  chatStatus: {
    alignItems: 'flex-end',
  },
  lastSeen: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  chatRoom: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    minWidth: 56, // enough room for "12:00 PM"
    textAlign: 'right',
    includeFontPadding: false,
  },

  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  headerBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginRight: 16,
  },
  headerBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  unreadMessage: {
    fontWeight: 'bold',
    color: '#000',
  },
  readIcon: {
    marginLeft: 4,
  },
  chatList: {
    padding: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#1A237E',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});
