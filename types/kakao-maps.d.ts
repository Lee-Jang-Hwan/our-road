// ============================================
// Kakao Maps TypeScript Definitions
// ============================================

declare global {
  interface Window {
    kakao: {
      maps: {
        load: (callback: () => void) => void;
        Map: new (container: HTMLElement, options: MapOptions) => Map;
        LatLng: new (lat: number, lng: number) => LatLng;
        Marker: new (options: MarkerOptions) => Marker;
        Polyline: new (options: PolylineOptions) => Polyline;
        InfoWindow: new (options: InfoWindowOptions) => InfoInfoWindow;
        LatLngBounds: new () => LatLngBounds;
        event: {
          addListener: (
            target: any,
            type: string,
            handler: (...args: any[]) => void
          ) => void;
          removeListener: (
            target: any,
            type: string,
            handler: (...args: any[]) => void
          ) => void;
        };
        Size: new (width: number, height: number) => Size;
      };
    };
  }

  interface MapOptions {
    center: LatLng;
    level: number;
  }

  interface Map {
    setCenter: (latlng: LatLng) => void;
    getCenter: () => LatLng;
    setLevel: (level: number, options?: { animate?: boolean }) => void;
    getLevel: () => number;
    setBounds: (bounds: LatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number) => void;
    panTo: (latlng: LatLng) => void;
  }

  interface LatLng {
    getLat: () => number;
    getLng: () => number;
  }

  interface MarkerOptions {
    position: LatLng;
    map?: Map;
    image?: MarkerImage;
    title?: string;
    clickable?: boolean;
    zIndex?: number;
  }

  interface Marker {
    setMap: (map: Map | null) => void;
    getPosition: () => LatLng;
    setPosition: (latlng: LatLng) => void;
    setImage: (image: MarkerImage) => void;
    setZIndex: (zIndex: number) => void;
  }

  interface MarkerImage {
    // Marker image properties
  }

  interface PolylineOptions {
    path: LatLng[];
    strokeWeight?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeStyle?: 'solid' | 'shortdash' | 'shortdot' | 'shortdashdot' | 'shortdashdotdot' | 'dot' | 'dash' | 'dashdot' | 'longdash' | 'longdashdot' | 'longdashdotdot';
    endArrow?: boolean;
    zIndex?: number;
  }

  interface Polyline {
    setMap: (map: Map | null) => void;
    setPath: (path: LatLng[]) => void;
    getPath: () => LatLng[];
    setOptions: (options: Partial<PolylineOptions>) => void;
  }

  interface InfoWindowOptions {
    content: string | HTMLElement;
    position?: LatLng;
    removable?: boolean;
    zIndex?: number;
  }

  interface InfoWindow {
    open: (map: Map, marker?: Marker) => void;
    close: () => void;
    setContent: (content: string | HTMLElement) => void;
    setPosition: (position: LatLng) => void;
  }

  interface LatLngBounds {
    extend: (latlng: LatLng) => void;
    contain: (latlng: LatLng) => boolean;
    isEmpty: () => boolean;
    getSouthWest: () => LatLng;
    getNorthEast: () => LatLng;
  }

  interface Size {
    // Size properties
  }
}

export {};
