import React, { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { Sheet } from "@/src/components/sheet";
import { Button, PressableScale, T } from "@/src/components/ui";
import { font, radius, spacing, useTheme } from "@/src/theme";

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const ITEM = 44;

export function formatBirthdate(iso: string | null | undefined) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1].toLowerCase()} ${y}`;
}

function Column({ items, value, onChange, testPrefix }: { items: { v: number; l: string }[]; value: number; onChange: (v: number) => void; testPrefix: string }) {
  const { colors } = useTheme();
  const ref = useRef<ScrollView>(null);
  useEffect(() => {
    const i = items.findIndex((x) => x.v === value);
    setTimeout(() => ref.current?.scrollTo({ y: Math.max(0, (i - 2) * ITEM), animated: false }), 50);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ScrollView ref={ref} style={{ height: ITEM * 5, flex: 1 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
      {items.map((it) => {
        const on = it.v === value;
        return (
          <PressableScale
            key={it.v}
            testID={`${testPrefix}-${it.v}`}
            onPress={() => onChange(it.v)}
            style={{ height: ITEM, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: on ? colors.surfaceInverse : "transparent" }}
          >
            <Text style={{ fontFamily: on ? font.semibold : font.regular, fontSize: 15, color: on ? colors.onSurfaceInverse : colors.onSurfaceTertiary }}>{it.l}</Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

export function DatePickerSheet({
  visible,
  value,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  value: string | null | undefined;
  onClose: () => void;
  onConfirm: (iso: string) => void;
}) {
  const now = new Date();
  const init = value ? value.split("-").map(Number) : [2000, 1, 1];
  const [y, setY] = useState(init[0]);
  const [m, setM] = useState(init[1]);
  const [d, setD] = useState(init[2]);
  useEffect(() => {
    if (visible) {
      const v = value ? value.split("-").map(Number) : [2000, 1, 1];
      setY(v[0]);
      setM(v[1]);
      setD(v[2]);
    }
  }, [visible, value]);
  const maxDay = new Date(y, m, 0).getDate();
  const day = Math.min(d, maxDay);
  const years = Array.from({ length: now.getFullYear() - 1920 + 1 }, (_, i) => now.getFullYear() - i).map((v) => ({ v, l: String(v) }));
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const future = new Date(iso) > now;

  return (
    <Sheet visible={visible} onClose={onClose} testID="birthdate-picker-sheet">
      <View style={{ gap: spacing.lg }}>
        <T variant="h2">Date de naissance</T>
        {visible ? (
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Column items={Array.from({ length: maxDay }, (_, i) => ({ v: i + 1, l: String(i + 1) }))} value={day} onChange={setD} testPrefix="picker-day" />
            <Column items={MONTHS.map((l, i) => ({ v: i + 1, l }))} value={m} onChange={setM} testPrefix="picker-month" />
            <Column items={years} value={y} onChange={setY} testPrefix="picker-year" />
          </View>
        ) : null}
        <Button label={future ? "Date invalide" : `Valider · ${formatBirthdate(iso)}`} disabled={future} onPress={() => onConfirm(iso)} testID="birthdate-picker-confirm" />
      </View>
    </Sheet>
  );
}
