declare namespace naver {
  namespace maps {
    class Map {
      constructor(el: HTMLElement, options: any);
      setCenter(latlng: LatLng): void;
      setZoom(zoom: number): void;
    }
    class LatLng {
      constructor(lat: number, lng: number);
    }
    class Point {
      constructor(x: number, y: number);
    }
    class Marker {
      constructor(options: any);
      setMap(map: Map | null): void;
      setIcon(icon: any): void;
      setPosition(latlng: LatLng): void;
    }
    class Polyline {
      constructor(options: any);
      setMap(map: Map | null): void;
      setOptions(options: any): void;
    }
    class Polygon {
      constructor(options: any);
      setMap(map: Map | null): void;
    }
    const MapTypeId: { NORMAL: string; SATELLITE: string; HYBRID: string; TERRAIN: string };
  }
}