import type { MapCommand } from "@/src/components/map/map-html";
import type { Place } from "@/src/types";

export type TransitStop = { id: string; type: string; name: string; lines: string[]; lat: number; lng: number };

export type LeafletMapProps = {
  places: Place[];
  stops: TransitStop[];
  onOpenPlace: (id: string) => void;
};

export type LeafletMapHandle = { send: (c: MapCommand) => void };
