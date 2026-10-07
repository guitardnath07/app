import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { View } from "react-native";

import { MAP_HTML, MapCommand } from "@/src/components/map/map-html";
import type { LeafletMapHandle, LeafletMapProps } from "@/src/components/map/types";

// Web preview: same Leaflet page rendered in a same-origin iframe.
export const LeafletMap = forwardRef<LeafletMapHandle, LeafletMapProps>(function LeafletMap(
  { places, stops, onOpenPlace },
  ref,
) {
  const frame = useRef<any>(null);
  const ready = useRef(false);
  const latest = useRef({ places, stops, onOpenPlace });
  latest.current = { places, stops, onOpenPlace };

  const send = (c: MapCommand) => {
    if (!ready.current) return;
    frame.current?.contentWindow?.postMessage({ __cmd: c }, "*");
  };

  useImperativeHandle(ref, () => ({ send }));

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!e.data || !e.data.__citypulse || e.source !== frame.current?.contentWindow) return;
      try {
        const m = JSON.parse(e.data.data);
        if (m.type === "ready") {
          ready.current = true;
          send({ type: "places", data: latest.current.places });
          send({ type: "stops", data: latest.current.stops });
        } else if (m.type === "open") latest.current.onOpenPlace(m.id);
      } catch {}
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    send({ type: "places", data: places });
  }, [places]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    send({ type: "stops", data: stops });
  }, [stops]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ flex: 1 }} testID="leaflet-map">
      {React.createElement("iframe", {
        ref: frame,
        srcDoc: MAP_HTML,
        title: "Carte CityPulse",
        style: { border: 0, width: "100%", height: "100%", display: "block" },
      })}
    </View>
  );
});
