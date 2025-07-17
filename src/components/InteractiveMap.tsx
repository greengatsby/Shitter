'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Rectangle, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { Badge } from '@/components/ui/badge';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface GridPoint {
  lat: number;
  lng: number;
  url: string;
}

interface InteractiveMapProps {
  bounds: MapBounds;
  gridPoints: GridPoint[];
  className?: string;
}

// Custom red pin icon
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// US boundary polygon (simplified)
const US_BOUNDARIES = {
  north: 49.384,
  south: 24.396,
  east: -66.934,
  west: -124.848
};

// Check if a point is within US boundaries (simplified)
function isInUnitedStates(lat: number, lng: number): boolean {
  // Basic bounding box check
  if (lat < US_BOUNDARIES.south || lat > US_BOUNDARIES.north ||
    lng < US_BOUNDARIES.west || lng > US_BOUNDARIES.east) {
    return false;
  }

  // Additional checks to exclude major non-US areas
  // Exclude most of Canada
  if (lat > 48.99 && lng > -95 && lng < -66.934) {
    return false;
  }

  // Exclude most of Mexico
  if (lat < 32.5 && lng > -117 && lng < -96) {
    return false;
  }

  return true;
}

// Component to handle zoom-based visibility
function ZoomBasedMarkers({ gridPoints, minZoom = 8 }: { gridPoints: GridPoint[], minZoom?: number }) {
  const map = useMap();
  const [currentZoom, setCurrentZoom] = useState(map.getZoom());
  const [visiblePoints, setVisiblePoints] = useState<GridPoint[]>([]);

  useEffect(() => {
    const handleZoomEnd = () => {
      const zoom = map.getZoom();
      setCurrentZoom(zoom);

      // Only show pins when zoomed in enough
      if (zoom >= minZoom) {
        // Filter points to only show those within US boundaries
        const usPoints = gridPoints.filter(point => isInUnitedStates(point.lat, point.lng));

        // If still too many points, sample them based on zoom level
        if (usPoints.length > 1000 && zoom < 10) {
          // Sample every nth point for performance
          const sampleRate = Math.max(1, Math.floor(usPoints.length / 500));
          setVisiblePoints(usPoints.filter((_, index) => index % sampleRate === 0));
        } else {
          setVisiblePoints(usPoints);
        }
      } else {
        setVisiblePoints([]);
      }
    };

    map.on('zoomend', handleZoomEnd);
    handleZoomEnd(); // Initial call

    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [map, gridPoints, minZoom]);

  return (
    <MarkerClusterGroup
      chunkedLoading
      maxClusterRadius={50}
      showCoverageOnHover={false}
      spiderfyOnMaxZoom={true}
      removeOutsideVisibleBounds={true}
    >
      {visiblePoints.map((point, index) => (
        <Marker
          key={`${point.lat}-${point.lng}-${index}`}
          position={[point.lat, point.lng]}
          icon={redIcon}
        >
          <Popup>
            <div className="text-sm">
              <strong>Scraping Point #{index + 1}</strong>
              <br />
              <strong>Coordinates:</strong> {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
              <br />
              <strong>URL:</strong>
              <br />
              <a
                href={point.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all text-xs"
              >
                {point.url}
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MarkerClusterGroup>
  );
}

export default function InteractiveMap({ bounds, gridPoints, className = '' }: InteractiveMapProps) {
  const mapRef = useRef<L.Map | null>(null);

  // US center coordinates
  const center: [number, number] = [39.8283, -98.5795];

  // Calculate rectangle bounds for the search area
  const rectangleBounds: [[number, number], [number, number]] = [
    [bounds.south, bounds.west],
    [bounds.north, bounds.east]
  ];

  // Filter grid points to only include US points for display count
  const usGridPoints = gridPoints.filter(point => isInUnitedStates(point.lat, point.lng));

  // Fit map to show search area (not all grid points for performance)
  useEffect(() => {
    if (mapRef.current) {
      const rectangle = L.rectangle(rectangleBounds);
      mapRef.current.fitBounds(rectangle.getBounds(), { padding: [20, 20] });
    }
  }, [bounds]);

  return (
    <div className={`bg-white rounded-lg border-2 shadow-lg ${className}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Interactive Map - Scraping Grid</h3>
          <div className="flex gap-2">
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {gridPoints.length} total points
            </Badge>
            <Badge variant="secondary" className="bg-red-100 text-red-800">
              {usGridPoints.length} US points
            </Badge>
          </div>
        </div>

        <div className="h-[500px] w-full rounded-lg overflow-hidden border">
          <MapContainer
            center={center}
            zoom={4}
            style={{ height: '100%', width: '100%' }}
            ref={mapRef}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Search area rectangle */}
            <Rectangle
              bounds={rectangleBounds}
              fillColor="green"
              fillOpacity={0.2}
              color="green"
              weight={2}
              dashArray="5, 5"
            />

            {/* Zoom-based clustered markers */}
            <ZoomBasedMarkers gridPoints={gridPoints} minZoom={8} />
          </MapContainer>
        </div>

        {/* Legend */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="font-semibold text-sm mb-2">Legend & Performance Info</h4>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-sm"></div>
              <span>Scraping Points (clustered)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-2 bg-green-500 opacity-50 border border-green-600 border-dashed"></div>
              <span>Search Area</span>
            </div>
            <div className="text-gray-600">
              Area: {Math.abs(bounds.east - bounds.west).toFixed(3)}° × {Math.abs(bounds.north - bounds.south).toFixed(3)}°
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            💡 Pins show when zoomed in (level 8+) • Points outside US boundaries are filtered out • Large clusters auto-sample for performance
          </div>
        </div>
      </div>
    </div>
  );
} 