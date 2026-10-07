import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

import { MAP_HTML, MapCommand } from "@/src/components/map/map-html";
import type { LeafletMapHandle, LeafletMapProps } from "@/src/components/map/types";

export const LeafletMap = forwardRef<LeafletMapHandle, LeafletMapProps>(function LeafletMap(
  { places, stops, onOpenPlace },
  ref,
) {
  const web = useRef<WebView>(null);
  const ready = useRef(false);

  const send = (c: MapCommand) => {
    if (!ready.current) return;
    web.current?.injectJavaScript(`window.__cmd(${JSON.stringify(JSON.stringify(c))}); true;`);
  };

  useImperativeHandle(ref, () => ({ send }));

  useEffect(() => {
    send({ type: "places", data: places });
  }, [places]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    send({ type: "stops", data: stops });
  }, [stops]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ flex: 1 }} testID="leaflet-map">
      <WebView
        ref={web}
        originWhitelist={["*"]}
        source={{ html: MAP_HTML, baseUrl: "https://citypulse.app/" }}
        style={{ flex: 1, backgroundColor: "transparent" }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setBuiltInZoomControls={false}
        onMessage={(e) => {
          try {
            const m = JSON.parse(e.nativeEvent.data);
            if (m.type === "ready") {
              ready.current = true;
              send({ type: "places", data: places });
              send({ type: "stops", data: stops });
            } else if (m.type === "open") onOpenPlace(m.id);
          } catch {}
        }}
      />
    </View>
  );
});
