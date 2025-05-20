import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Dimensions,
  PanResponder,
} from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../FirebaseConfig';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import { MotiView } from 'moti';
import { MotiPressable } from 'moti/interactions';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderEmail: string;
  timestamp: any;
  read: boolean;
  reactions?: {
    [key: string]: string[]; // emoji: [userId1, userId2]
  };
}

interface ChatRoomData {
  participants: string[];
  lastMessage: {
    text: string;
    timestamp: any;
    senderId: string;
    read: boolean;
  };
  unreadCount: {
    [key: string]: number;
  };
  createdAt: any;
}

export default function ChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({
    x: 0,
    y: 0,
  });
  const [showContextMenu, setShowContextMenu] = useState(false);
  const windowWidth = Dimensions.get('window').width;
  const windowHeight = Dimensions.get('window').height;
  const [localMessages, setLocalMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!auth.currentUser?.uid || !userId) return;

    const chatId = [auth.currentUser.uid, userId].sort().join('_');
    const messagesRef = collection(db, 'chatRooms', chatId, 'messages');
    const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messageList: Message[] = [];
      snapshot.forEach((doc) => {
        messageList.push({ id: doc.id, ...doc.data() } as Message);
      });

      // Merge with local messages if needed
      if (localMessages.length > 0) {
        const mergedMessages = [...localMessages];
        messageList.forEach((newMsg) => {
          const existingIndex = mergedMessages.findIndex(
            (m) => m.id === newMsg.id
          );
          if (existingIndex === -1) {
            mergedMessages.push(newMsg);
          } else {
            mergedMessages[existingIndex] = newMsg;
          }
        });
        setMessages(mergedMessages);
      } else {
        setMessages(messageList);
      }

      setLoading(false);

      // Scroll to bottom when new messages arrive
      if (messageList.length > 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    });

    return () => unsubscribe();
  }, [userId, localMessages]);

  useEffect(() => {
    const fetchOtherUser = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId as string));
        if (userDoc.exists()) {
          setOtherUser(userDoc.data());
        }
      } catch (error) {
        console.error('Error fetching other user:', error);
      }
    };

    fetchOtherUser();
  }, [userId]);

  const sendMessage = async () => {
    if (!message.trim() || !auth.currentUser?.uid || !userId || sending) return;

    try {
      setSending(true);
      const chatId = [auth.currentUser.uid, userId].sort().join('_');
      const messagesRef = collection(db, 'chatRooms', chatId, 'messages');
      const chatRoomRef = doc(db, 'chatRooms', chatId);

      // First, ensure the chat room exists
      const chatRoomDoc = await getDoc(chatRoomRef);
      if (!chatRoomDoc.exists()) {
        // Create new chat room if it doesn't exist
        await setDoc(chatRoomRef, {
          participants: [auth.currentUser.uid, userId],
          lastMessage: {
            text: message.trim(),
            timestamp: serverTimestamp(),
            senderId: auth.currentUser.uid,
            read: false,
          },
          createdAt: serverTimestamp(),
          unreadCount: {
            [userId]: 1,
          },
        } as ChatRoomData);
      } else {
        // Update unread count for the other user
        const chatRoomData = chatRoomDoc.data() as ChatRoomData;
        const currentUnreadCount = chatRoomData.unreadCount?.[userId] || 0;
        await updateDoc(chatRoomRef, {
          unreadCount: {
            ...chatRoomData.unreadCount,
            [userId]: currentUnreadCount + 1,
          },
        });
      }

      // Add the message
      await addDoc(messagesRef, {
        text: message.trim(),
        senderId: auth.currentUser.uid,
        senderEmail: auth.currentUser.email,
        timestamp: serverTimestamp(),
        read: false,
      });

      // Update last message in chat room
      await updateDoc(chatRoomRef, {
        lastMessage: {
          text: message.trim(),
          timestamp: serverTimestamp(),
          senderId: auth.currentUser.uid,
          read: false,
        },
      });

      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!auth.currentUser?.uid || !userId) return;

    const chatId = [auth.currentUser.uid, userId].sort().join('_');
    const messagesRef = collection(db, 'chatRooms', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];

      setMessages(newMessages);
      setLoading(false);

      // Mark messages as read
      const unreadMessages = newMessages.filter(
        (msg) => msg.senderId !== auth.currentUser?.uid && !msg.read
      );

      if (unreadMessages.length > 0) {
        const batch = writeBatch(db);
        unreadMessages.forEach((msg) => {
          const messageRef = doc(db, 'chatRooms', chatId, 'messages', msg.id);
          batch.update(messageRef, { read: true });
        });
        batch.commit();
      }
    });

    return () => unsubscribe();
  }, [userId]);

  // Add this effect to mark messages as read when viewing them
  useEffect(() => {
    if (!auth.currentUser?.uid || !userId) return;

    const chatId = [auth.currentUser.uid, userId].sort().join('_');
    const chatRoomRef = doc(db, 'chatRooms', chatId);

    // Mark messages as read and reset unread count
    const markMessagesAsRead = async () => {
      try {
        const chatRoomDoc = await getDoc(chatRoomRef);
        if (chatRoomDoc.exists()) {
          const chatRoomData = chatRoomDoc.data();
          const unreadMessages =
            chatRoomData.lastMessage?.senderId === userId &&
            !chatRoomData.lastMessage?.read;

          if (unreadMessages) {
            await updateDoc(chatRoomRef, {
              'lastMessage.read': true,
              [`unreadCount.${auth.currentUser?.uid}`]: 0,
            });
          }
        }
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    };

    markMessagesAsRead();
  }, [userId]);

  // Load messages from local storage
  useEffect(() => {
    const loadLocalMessages = async () => {
      if (!auth.currentUser?.uid || !userId) return;

      try {
        const chatId = [auth.currentUser.uid, userId].sort().join('_');
        const storedMessages = await AsyncStorage.getItem(`chat_${chatId}`);
        if (storedMessages) {
          const parsedMessages = JSON.parse(storedMessages);
          setLocalMessages(parsedMessages);
          setMessages(parsedMessages);
        }
      } catch (error) {
        console.error('Error loading local messages:', error);
      }
    };

    loadLocalMessages();
  }, [userId]);

  // Save messages to local storage whenever they change
  useEffect(() => {
    const saveMessagesLocally = async () => {
      if (!auth.currentUser?.uid || !userId || messages.length === 0) return;

      try {
        const chatId = [auth.currentUser.uid, userId].sort().join('_');
        await AsyncStorage.setItem(`chat_${chatId}`, JSON.stringify(messages));
        setLocalMessages(messages);
      } catch (error) {
        console.error('Error saving messages locally:', error);
      }
    };

    saveMessagesLocally();
  }, [messages]);

  const handleLongPress = (message: Message, event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    const menuWidth = 280; // Approximate width of the context menu
    const menuHeight = 120; // Approximate height of the context menu

    // Calculate position to ensure menu stays within screen bounds
    let x = pageX;
    let y = pageY;

    // Adjust horizontal position if menu would go off screen
    if (x + menuWidth > windowWidth) {
      x = windowWidth - menuWidth - 10;
    }

    // Adjust vertical position if menu would go off screen
    if (y + menuHeight > windowHeight) {
      y = pageY - menuHeight - 10;
    }

    setContextMenuPosition({ x, y });
    setSelectedMessage(message);
    setShowContextMenu(true);
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      setShowContextMenu(false);
      setSelectedMessage(null);
    },
  });

  const handleCopyText = async (text: string) => {
    await Clipboard.setStringAsync(text);
    setSelectedMessage(null);
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!auth.currentUser?.uid) return;

    try {
      const chatId = [auth.currentUser.uid, userId].sort().join('_');
      const messageRef = doc(db, 'chatRooms', chatId, 'messages', messageId);
      const messageDoc = await getDoc(messageRef);

      if (messageDoc.exists()) {
        const messageData = messageDoc.data() as Message;
        const reactions = messageData.reactions || {};

        // Remove user's previous reaction if any
        Object.keys(reactions).forEach((existingEmoji) => {
          const users = reactions[existingEmoji];
          const userIndex = users.indexOf(auth.currentUser!.uid);
          if (userIndex !== -1) {
            users.splice(userIndex, 1);
            if (users.length === 0) {
              delete reactions[existingEmoji];
            }
          }
        });

        // Add new reaction
        if (!reactions[emoji]) {
          reactions[emoji] = [];
        }
        reactions[emoji].push(auth.currentUser.uid);

        await updateDoc(messageRef, { reactions });
      }
    } catch (error) {
      console.error('Error updating reaction:', error);
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isOwnMessage = item.senderId === auth.currentUser?.uid;
    const reactions = item.reactions || {};
    const userReaction = Object.entries(reactions).find(([_, users]) =>
      users.includes(auth.currentUser?.uid || '')
    )?.[0];

    return (
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        // transition={{ delay: index * 10 }}
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        <TouchableOpacity
          onLongPress={(event) => handleLongPress(item, event)}
          delayLongPress={200}
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownBubble : styles.otherBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
            ]}
          >
            {item.text}
          </Text>
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.messageTime,
                isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime,
              ]}
            >
              {item.timestamp?.toDate?.()?.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }) || 'Sending...'}
            </Text>
            {isOwnMessage && (
              <Ionicons
                name={item.read ? 'checkmark-done' : 'checkmark'}
                size={16}
                color={item.read ? '#FFFFFF' : '#FFFFFF'}
                style={styles.readIcon}
              />
            )}
          </View>
          {Object.keys(reactions).length > 0 && (
            <View style={styles.reactionsContainer}>
              {Object.entries(reactions).map(([emoji, users]) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.reactionBubble,
                    userReaction === emoji && styles.userReactionBubble,
                  ]}
                  onPress={() => handleReaction(item.id, emoji)}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                  {users.length > 1 && (
                    <Text style={styles.reactionCount}>{users.length}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </TouchableOpacity>
      </MotiView>
    );
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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title: otherUser?.name || 'Chat',
          headerShown: true,
          headerBackTitle: 'Back',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push(`/profile?userId=${userId}`)}
              style={styles.profileButton}
            >
              <Ionicons
                name="person-circle-outline"
                size={24}
                color="#1A237E"
              />
            </TouchableOpacity>
          ),
        }}
      />
      <View {...panResponder.panHandlers} style={styles.container}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          onLayout={() => flatListRef.current?.scrollToEnd()}
        />

        {showContextMenu && selectedMessage && (
          <View
            style={[
              styles.contextMenu,
              {
                position: 'absolute',
                top: contextMenuPosition.y,
                left: contextMenuPosition.x,
              },
            ]}
          >
            <View style={styles.contextMenuContent}>
              <TouchableOpacity
                style={styles.contextMenuItem}
                onPress={() => {
                  handleCopyText(selectedMessage.text);
                  setShowContextMenu(false);
                }}
              >
                <Ionicons name="copy-outline" size={20} color="#1A237E" />
                <Text style={styles.contextMenuItemText}>Copy</Text>
              </TouchableOpacity>

              <View style={styles.reactionStrip}>
                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => {
                  const isUserReaction = selectedMessage.reactions?.[
                    emoji
                  ]?.includes(auth.currentUser?.uid || '');
                  return (
                    <TouchableOpacity
                      key={emoji}
                      style={[
                        styles.reactionButton,
                        isUserReaction && styles.userReactionButton,
                      ]}
                      onPress={() => {
                        handleReaction(selectedMessage.id, emoji);
                        setShowContextMenu(false);
                      }}
                    >
                      <Text style={styles.reactionEmoji}>{emoji}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            multiline
            editable={!sending}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!message.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!message.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#999" />
            ) : (
              <Ionicons
                name="send"
                size={24}
                color={message.trim() ? '#1A237E' : '#999'}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  ownBubble: {
    backgroundColor: '#1A237E',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#333333',
  },
  messageTime: {
    fontSize: 12,
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherMessageTime: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    fontSize: 16,
    maxHeight: 100,
    color: '#333',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  profileButton: {
    marginRight: 16,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  readIcon: {
    marginLeft: 8,
  },
  reactionsContainer: {
    flexDirection: 'row',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  reactionBubble: {
    backgroundColor: '#f0f0f0',
    padding: 4,
    borderRadius: 12,
    marginHorizontal: 2,
    marginVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionCount: {
    fontSize: 12,
    marginLeft: 4,
    color: '#666',
  },
  contextMenu: {
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 200,
    zIndex: 1000,
  },
  contextMenuContent: {
    padding: 8,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  contextMenuItemText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  reactionStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 4,
  },
  reactionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  userReactionBubble: {
    backgroundColor: '#E3F2FD',
    borderColor: '#1A237E',
    borderWidth: 1,
  },
  userReactionButton: {
    backgroundColor: '#E3F2FD',
    borderColor: '#1A237E',
    borderWidth: 1,
  },
});
