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
  Dimensions,
  PanResponder,
  Keyboard,
  TouchableWithoutFeedback,
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
  getDoc,
  doc,
  updateDoc,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { MotiView } from 'moti';
import * as Clipboard from 'expo-clipboard';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderEmail?: string;
  timestamp: any;
  read: boolean;
  reactions?: { [emoji: string]: string[] };
}

export default function ChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({
    x: 0,
    y: 0,
  });
  const flatListRef = useRef<FlatList>(null);
  const chatId = [auth.currentUser?.uid, userId].sort().join('_');

  useEffect(() => {
    const messagesRef = collection(db, 'chatRooms', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          text: data.text,
          senderId: data.senderId,
          senderEmail: data.senderEmail,
          timestamp: data.timestamp,
          read: data.read,
          reactions: data.reactions || {},
        } as Message;
      });

      setMessages(newMessages);
      setLoading(false);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      const unread = newMessages.filter(
        (m) => m.senderId !== auth.currentUser?.uid && !m.read
      );
      if (unread.length) {
        const batch = writeBatch(db);
        unread.forEach((m) =>
          batch.update(doc(db, 'chatRooms', chatId, 'messages', m.id), {
            read: true,
          })
        );
        batch.commit();
      }
    });

    return () => unsubscribe();
  }, [chatId]);

  const sendMessage = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    const messagesRef = collection(db, 'chatRooms', chatId, 'messages');
    const chatRoomRef = doc(db, 'chatRooms', chatId);
    const currentUid = auth.currentUser?.uid;

    const newMsg = {
      text: message.trim(),
      senderId: currentUid,
      senderEmail: auth.currentUser?.email,
      timestamp: serverTimestamp(),
      read: false,
    };

    try {
      const docSnap = await getDoc(chatRoomRef);
      if (!docSnap.exists()) {
        await setDoc(chatRoomRef, {
          participants: [currentUid, userId],
          createdAt: serverTimestamp(),
          unreadCount: { [userId as string]: 1 },
          lastMessage: { ...newMsg },
        });
      } else {
        const prev = docSnap.data();
        await updateDoc(chatRoomRef, {
          lastMessage: { ...newMsg },
          unreadCount: {
            ...prev.unreadCount,
            [userId as string]: (prev.unreadCount?.[userId as string] || 0) + 1,
          },
        });
      }

      await addDoc(messagesRef, newMsg);
      setMessage('');
    } catch (err) {
      console.error('Send error', err);
    } finally {
      setSending(false);
    }
  };

  const handleReaction = async (msgId: string, emoji: string) => {
    const msgRef = doc(db, 'chatRooms', chatId, 'messages', msgId);
    const snap = await getDoc(msgRef);
    const uid = auth.currentUser?.uid;

    if (!snap.exists() || !uid) return;
    const msg = snap.data() as Message;
    const reactions = msg.reactions || {};

    Object.keys(reactions).forEach((e) => {
      reactions[e] = reactions[e].filter((id) => id !== uid);
      if (reactions[e].length === 0) delete reactions[e];
    });

    reactions[emoji] = reactions[emoji] || [];
    reactions[emoji].push(uid);
    await updateDoc(msgRef, { reactions });
    setShowContextMenu(false);
  };

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    setShowContextMenu(false);
  };

  const handleLongPress = (msg: Message, e: any) => {
    const { pageX, pageY } = e.nativeEvent;
    const x = Math.min(pageX, windowWidth - 240);
    const y = Math.min(pageY, windowHeight - 160);

    setSelectedMessage(msg);
    setContextMenuPosition({ x, y });
    setShowContextMenu(true);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setShowContextMenu(false);
        setSelectedMessage(null);
      },
    })
  ).current;

  const renderItem = ({ item }: { item: Message }) => {
    const isOwn = item.senderId === auth.currentUser?.uid;
    const userReaction = Object.entries(item.reactions || {}).find(([, uids]) =>
      uids.includes(auth.currentUser?.uid || '')
    )?.[0];

    function formatTime(date: Date) {
      let h = date.getHours();
      const m = date.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12; // convert 0 → 12
      const mm = m < 10 ? `0${m}` : m;
      return `${h}:${mm} ${ampm}`;
    }

    const date = item.timestamp?.toDate?.();
    // For testing: force an AM time to see if it displays "AM"
    if (date) date.setHours(9); // Set to 9 AM
    const timeString = date ? formatTime(date) : '...';

    return (
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        style={[styles.messageRow, isOwn ? styles.right : styles.left]}
      >
        <TouchableOpacity
          onLongPress={(e) => handleLongPress(item, e)}
          delayLongPress={300}
          style={[
            styles.bubble,
            isOwn ? styles.bubbleRight : styles.bubbleLeft,
          ]}
        >
          <Text style={isOwn ? styles.textRight : styles.textLeft}>
            {item.text}
          </Text>
          <Text
            style={styles.timestamp}
            // includeFontPadding={false}
            numberOfLines={1}
            ellipsizeMode="clip"
          >
            {timeString}
          </Text>
          {!!item.reactions && (
            <View style={styles.reactions}>
              {Object.entries(item.reactions).map(([emoji, users]) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.reaction,
                    userReaction === emoji && styles.reactionActive,
                  ]}
                  onPress={() => handleReaction(item.id, emoji)}
                >
                  <Text>{emoji}</Text>
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

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
        style={{ flex: 1 }}
      >
        <Stack.Screen options={{ title: 'Chat', headerBackTitle: 'Back' }} />

        <View {...panResponder.panHandlers} style={styles.container}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
          />

          {showContextMenu && selectedMessage && (
            <View
              style={[
                styles.contextMenu,
                {
                  top: contextMenuPosition.y,
                  left: contextMenuPosition.x,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.contextItem}
                onPress={() => handleCopy(selectedMessage.text)}
              >
                <Ionicons name="copy-outline" size={18} color="#333" />
                <Text
                  style={styles.contextText}
                  // includeFontPadding={false}
                  numberOfLines={1}
                  ellipsizeMode="clip"
                >
                  Copyy
                </Text>
              </TouchableOpacity>
              <View style={styles.emojiRow}>
                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => handleReaction(selectedMessage.id, emoji)}
                  >
                    <Text style={styles.emoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={message}
              onChangeText={setMessage}
              placeholder="Type a message"
              placeholderTextColor="#aaa"
              multiline
            />
            <TouchableOpacity
              onPress={sendMessage}
              disabled={!message.trim()}
              style={styles.send}
            >
              {sending ? (
                <ActivityIndicator color="#1A237E" />
              ) : (
                <Ionicons name="send" size={22} color="#1A237E" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  list: { flexGrow: 1, padding: 16, paddingBottom: 90 },
  messageRow: { marginBottom: 12, maxWidth: '80%' },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end' },
  bubble: { padding: 12, borderRadius: 16 },
  bubbleLeft: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderColor: '#ddd',
    borderWidth: 1,
  },
  bubbleRight: {
    backgroundColor: '#1A237E',
    borderBottomRightRadius: 4,
  },
  textLeft: { color: '#000' },
  textRight: { color: '#fff' },
  timestamp: {
    fontSize: 11,
    color: '#666',
    alignSelf: 'flex-end',
    marginTop: 4,
    minWidth: 48, // ensures never clipped
    textAlign: 'right',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    backgroundColor: '#f1f1f1',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 120,
  },
  send: {
    marginLeft: 10,
    backgroundColor: '#E3F2FD',
    padding: 10,
    borderRadius: 20,
  },
  contextMenu: {
    position: 'absolute',
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 12,
    elevation: 6,
    zIndex: 999,
    // REMOVE minWidth, width, or overflow (let it autosize)
  },
  contextItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16, // give more room!
  },
  contextText: {
    fontSize: 16,
    marginLeft: 8,
    color: '#333',
    flexShrink: 0,
    width: 'auto', // let it autosize!
  },

  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  emoji: { fontSize: 22 },
  reactions: { flexDirection: 'row', marginTop: 4 },
  reaction: {
    flexDirection: 'row',
    backgroundColor: '#eee',
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
  },
  reactionCount: { fontSize: 12, marginLeft: 4, color: '#555' },
  reactionActive: { backgroundColor: '#D0E8FF' },
});
