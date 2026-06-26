import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { firstName } from '@/lib/format';

type Sender = 'me' | 'agent';
type Message = { id: string; from: Sender; text: string };

const QUICK_TOPICS = [
  'I was charged twice',
  'A payment was blocked',
  'I lost my phone',
  'How do I report fraud?',
];

function botReply(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('block')) {
    return 'If SafePay AI blocked a payment, open the Alerts tab and tap the flagged transaction. You can confirm it was you to release it, or report it as fraud. Want me to walk you through it?';
  }
  if (t.includes('fraud') || t.includes('report')) {
    return 'To report fraud: go to Alerts → open the transaction → tap “No, block & report”. You can also freeze your account from Profile → Freeze account. Shall I freeze it for you now?';
  }
  if (t.includes('lost') || t.includes('phone') || t.includes('stolen')) {
    return 'Sorry to hear that. First, go to Profile → Trusted devices and revoke the lost device. Then change your PIN. Would you like me to freeze your account while you sort it out?';
  }
  if (t.includes('charged') || t.includes('twice') || t.includes('double')) {
    return 'I can help with a duplicate charge. Please share the transaction reference (you’ll find it on the receipt) and our team will review it within 24 hours.';
  }
  return 'Thanks — a customer-care agent will pick this up shortly. In the meantime, you can check Alerts for anything SafePay AI flagged, or browse your Activity for transaction details.';
}

let seq = 0;
const nextId = () => `m${seq++}`;

export default function SupportScreen() {
  const { user } = useAuth();
  const greetingName = firstName(user?.full_name) || 'there';
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: nextId(),
      from: 'agent',
      text: `Hi ${greetingName}! 👋 I’m the SafePay support assistant. How can I help you today?`,
    },
  ]);
  const [draft, setDraft] = useState('');

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const mine: Message = { id: nextId(), from: 'me', text: trimmed };
    const reply: Message = { id: nextId(), from: 'agent', text: botReply(trimmed) };
    setMessages((prev) => [...prev, mine, reply]);
    setDraft('');
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        right={
          <View style={styles.headerRight}>
            <View style={styles.onlineDot} />
            <Text style={styles.headerTitle}>Support</Text>
          </View>
        }
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.thread}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {messages.map((m) => (
            <View
              key={m.id}
              style={[styles.bubble, m.from === 'me' ? styles.bubbleMe : styles.bubbleAgent]}>
              <Text style={[styles.bubbleText, m.from === 'me' && styles.bubbleTextMe]}>
                {m.text}
              </Text>
            </View>
          ))}

          {messages.length <= 1 && (
            <View style={styles.topics}>
              <Text style={styles.topicsLabel}>Common questions</Text>
              {QUICK_TOPICS.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => send(q)}
                  style={({ pressed }) => [styles.topic, pressed && { opacity: 0.85 }]}>
                  <Text style={styles.topicText}>{q}</Text>
                  <Ionicons name="arrow-forward" size={15} color={Brand.primary} />
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message…"
            placeholderTextColor={Brand.textMuted}
            style={styles.input}
            multiline
            onSubmitEditing={() => send(draft)}
          />
          <Pressable
            onPress={() => send(draft)}
            disabled={!draft.trim()}
            style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]}>
            <Ionicons name="send" size={18} color={Brand.textOnPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Brand.success },
  headerTitle: { fontSize: 15, fontWeight: '700', color: Brand.text },
  thread: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 10,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.lg,
  },
  bubbleAgent: {
    alignSelf: 'flex-start',
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    borderBottomLeftRadius: 4,
  },
  bubbleMe: {
    alignSelf: 'flex-end',
    backgroundColor: Brand.primary,
    borderBottomRightRadius: 4,
  },
  bubbleText: { fontSize: 14, lineHeight: 20, color: Brand.text },
  bubbleTextMe: { color: Brand.textOnPrimary },
  topics: { gap: 8, marginTop: Spacing.sm },
  topicsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Brand.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  topic: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  topicText: { fontSize: 14, fontWeight: '600', color: Brand.text },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.bg,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    fontSize: 14,
    color: Brand.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
