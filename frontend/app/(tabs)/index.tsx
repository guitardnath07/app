import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Bubble, PlaceStrip, ReneAvatar, ReneMessage, Typing } from "@/src/components/rene/chat-parts";
import { Sheet } from "@/src/components/sheet";
import { useToast } from "@/src/components/toast";
import { bounceProps, Chip, IconButton, Ionicons, PressableScale, Skeleton, T } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import type { Place } from "@/src/types";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

type Greeting = {
  greeting: string;
  suggestion: string;
  places: Place[];
  quick_actions: { id: string; label: string; icon: string }[];
};

const BUDGETS = [10, 20, 30, 50, 80, 120];

export default function Rene() {
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const scroll = useRef<ScrollView>(null);
  const [budget, setBudget] = useState(30);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ReneMessage[]>([]);

  useEffect(() => {
    storage.getItem("rene_budget", 30).then((b) => typeof b === "number" && setBudget(b));
  }, []);

  const greeting = useQuery({ queryKey: ["rene-greeting", budget, user?.age_group], queryFn: () => api<Greeting>(`/rene/greeting?budget=${budget}`) });
  const history = useQuery({ queryKey: ["rene-history"], queryFn: () => api<ReneMessage[]>("/rene/history") });
  useEffect(() => {
    if (history.data) setMessages(history.data);
  }, [history.data]);

  const toEnd = () => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);

  const send = async (message: string, action_id?: string) => {
    const m = message.trim();
    if (!m || sending) return;
    setText("");
    Keyboard.dismiss();
    const temp: ReneMessage = { id: `tmp-${Date.now()}`, role: "user", text: m, created_at: new Date().toISOString(), places: [], follow_ups: [] };
    setMessages((x) => [...x, temp]);
    setSending(true);
    toEnd();
    try {
      const r = await api<{ user: ReneMessage; assistant: ReneMessage }>("/rene/chat", { method: "POST", body: { message: m, budget, action_id } });
      setMessages((x) => [...x.filter((y) => y.id !== temp.id), r.user, r.assistant]);
    } catch {
      setMessages((x) => x.filter((y) => y.id !== temp.id));
      setText(m);
      toast("René est indisponible, réessaie", "error");
    } finally {
      setSending(false);
      toEnd();
    }
  };

  const clear = async () => {
    try {
      await api("/rene/history", { method: "DELETE" });
      setMessages([]);
      qc.setQueryData(["rene-history"], []);
      toast("Conversation effacée");
    } catch {
      toast("Impossible d'effacer", "error");
    }
  };

  const pickBudget = (b: number) => {
    setBudget(b);
    storage.setItem("rene_budget", b);
    setBudgetOpen(false);
  };

  const g = greeting.data;

  return (
    <View style={styles.screen} testID="rene-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <ReneAvatar size={42} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>René</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success }} />
            <Text style={styles.sub}>Ton assistant de sortie · Tours</Text>
          </View>
        </View>
        <PressableScale testID="rene-budget-pill" onPress={() => setBudgetOpen(true)} style={styles.budget}>
          <Ionicons name="wallet-outline" size={15} color={colors.brandPrimary} />
          <Text style={styles.budgetText}>{budget} €</Text>
        </PressableScale>
        {messages.length ? <IconButton icon="trash-outline" size={40} onPress={clear} testID="rene-clear-button" /> : null}
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={0} testID="rene-keyboard-avoiding">
        <ScrollView
          ref={scroll}
          testID="rene-chat-scroll"
          {...bounceProps}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
          onContentSizeChange={() => messages.length && scroll.current?.scrollToEnd({ animated: false })}
        >
          {/* Tap anywhere on the conversation background to hide the keyboard */}
          <Pressable testID="rene-chat-background" accessible={false} onPress={Keyboard.dismiss} style={{ flexGrow: 1, paddingVertical: spacing.lg, gap: spacing.lg }}>
          {greeting.isLoading ? (
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              <Skeleton style={{ height: 70, width: "80%" }} />
              <Skeleton style={{ height: 150 }} />
            </View>
          ) : g ? (
            <View style={{ gap: spacing.md }} testID="rene-welcome">
              <Animated.View entering={FadeInDown.springify().damping(18)} style={[styles.botRow, { paddingHorizontal: spacing.lg }]}>
                <ReneAvatar size={32} />
                <View style={styles.botBubble}>
                  <Text style={styles.botStrong}>{g.greeting}</Text>
                  <Text style={styles.botText} testID="rene-proactive-suggestion">{g.suggestion}</Text>
                </View>
              </Animated.View>
              <PlaceStrip places={g.places} testPrefix="rene-greeting" />
              <View style={styles.actions}>
                <Text style={styles.actionsTitle}>Raccourcis</Text>
                {g.quick_actions.map((a, i) => (
                  <Animated.View key={a.id} entering={FadeInDown.delay(150 + i * 50).springify().damping(18)}>
                    <PressableScale testID={`rene-quick-${a.id}`} disabled={sending} onPress={() => send(a.label, a.id)} style={styles.action}>
                      <View style={styles.actionIcon}>
                        <Ionicons name={a.icon as any} size={18} color={colors.onBrandTertiary} />
                      </View>
                      <Text style={styles.actionText}>{a.label}</Text>
                      <Ionicons name="arrow-forward" size={16} color={colors.muted} />
                    </PressableScale>
                  </Animated.View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={{ gap: spacing.lg, paddingHorizontal: spacing.lg }}>
            {messages.map((m, i) => (
              <Bubble key={m.id} m={m} last={i === messages.length - 1 && !sending} onFollowUp={(t) => send(t)} />
            ))}
            {sending ? <Typing /> : null}
          </View>
          </Pressable>
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: bottomChrome + spacing.sm }]}>
          <TextInput
            testID="rene-input"
            value={text}
            onChangeText={setText}
            placeholder="Demande à René…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
            maxLength={600}
            returnKeyType="send"
            enterKeyHint="send"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={() => (text.trim() ? send(text) : Keyboard.dismiss())}
            onKeyPress={(e: any) => {
              // Web textarea: Enter sends (Shift+Enter = new line)
              if (Platform.OS === "web" && e.nativeEvent.key === "Enter" && !e.nativeEvent.shiftKey) {
                e.preventDefault?.();
                if (text.trim()) send(text);
                (e.target as any)?.blur?.();
              }
            }}
          />
          <PressableScale testID="rene-send-button" disabled={!text.trim() || sending} onPress={() => send(text)} style={[styles.send, (!text.trim() || sending) && { opacity: 0.4 }]}>
            <Ionicons name="arrow-up" size={20} color={colors.onBrandPrimary} />
          </PressableScale>
        </View>
      </KeyboardAvoidingView>

      <Sheet visible={budgetOpen} onClose={() => setBudgetOpen(false)} testID="rene-budget-sheet">
        <View style={{ gap: spacing.lg }}>
          <T variant="h2">Ton budget par personne</T>
          <T style={{ color: colors.muted }}>René adapte ses recommandations à ce montant.</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {BUDGETS.map((b) => (
              <Chip key={b} testID={`rene-budget-${b}`} label={`${b} €`} selected={b === budget} onPress={() => pickBudget(b)} />
            ))}
          </ScrollView>
        </View>
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  title: { fontFamily: font.bold, fontSize: 22, letterSpacing: -0.5, color: c.onSurface },
  sub: { fontFamily: font.regular, fontSize: 12, color: c.muted },
  budget: { flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: c.brandTertiary },
  budgetText: { fontFamily: font.semibold, fontSize: 14, color: c.onBrandTertiary },
  botRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingRight: 40 },
  botBubble: { flexShrink: 1, gap: 4, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: 20, borderBottomLeftRadius: 6 },
  botStrong: { fontFamily: font.semibold, fontSize: 15, color: c.onSurface },
  botText: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: c.onSurfaceTertiary },
  actions: { paddingHorizontal: spacing.lg, gap: spacing.sm, marginTop: spacing.sm },
  actionsTitle: { fontFamily: font.semibold, fontSize: 12, color: c.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 },
  action: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  actionIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  actionText: { flex: 1, fontFamily: font.medium, fontSize: 14, color: c.onSurface },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: c.divider, backgroundColor: c.surface },
  input: { flex: 1, minHeight: 46, maxHeight: 120, borderRadius: 23, paddingHorizontal: spacing.lg, paddingTop: 13, paddingBottom: 13, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, fontFamily: font.regular, fontSize: 15, color: c.onSurface },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
}));
