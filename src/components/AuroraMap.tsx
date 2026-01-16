import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { riskZonesService, RiskZone } from '../services/risk-zones.service';
import { appEnv } from '../lib/env';
import { logger } from '../lib/logger';

interface AuroraMapProps {
  userLocation?: { lat: number; lng: number } | null;
  sosMarkers?: Array<{
    id: string;
    lat: number;
    lng: number;
    riskScore: number;
  }>;
  height?: string;
  onLocationUpdate?: (location: { lat: number; lng: number }) => void;
  enableGeolocation?: boolean;
}

export default function AuroraMap({
  userLocation,
  sosMarkers = [],
  height = '400px',
  onLocationUpdate,
  enableGeolocation = true,
}: AuroraMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [riskZones, setRiskZones] = useState<RiskZone[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const geolocationWatchIdRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);
  const riskZoneIdsRef = useRef<string[]>([]);
  const hasAutoFitRef = useRef(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || isInitializedRef.current) return;

    if (!mapboxgl.supported()) {
      setInitError('Mapbox is not supported in this browser/environment (WebGL unavailable).');
      return;
    }

    const mapboxToken = appEnv.mapboxToken();
    if (!mapboxToken) {
      setTokenMissing(true);
      return;
    }

    isInitializedRef.current = true;
    mapboxgl.accessToken = mapboxToken;

    const firstSos = sosMarkers.find((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
    const initialCenter: [number, number] = userLocation
      ? [userLocation.lng, userLocation.lat]
      : firstSos
        ? [firstSos.lng, firstSos.lat]
        : [-122.4194, 37.7749];

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: initialCenter, // Default to SF
        zoom: userLocation || firstSos ? 15 : 12,
      });

      map.current.on('load', () => {
        map.current?.resize();
        setMapLoaded(true);
      });

      map.current.on('error', (e) => {
        const message = (e as any)?.error?.message || 'Mapbox failed to load map resources.';
        setInitError(message);
      });
    } catch (error: any) {
      setInitError(error?.message || 'Failed to initialize Mapbox map.');
      return;
    }

    // Get user's current location if not provided
    if (enableGeolocation && !userLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          if (map.current) {
            map.current.setCenter([loc.lng, loc.lat]);
            if (onLocationUpdate) {
              onLocationUpdate(loc);
            }
          }
        },
        (error) => {
          logger.warn('Geolocation error:', error);
        }
      );

      // Watch position for live updates
      geolocationWatchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          if (!map.current) return;

          if (!userMarkerRef.current) {
            const el = document.createElement('div');
            el.className = 'user-marker';
            el.style.width = '20px';
            el.style.height = '20px';
            el.style.borderRadius = '50%';
            el.style.backgroundColor = '#4F46E5';
            el.style.border = '3px solid white';
            el.style.boxShadow = '0 0 10px rgba(79, 70, 229, 0.5)';
            userMarkerRef.current = new mapboxgl.Marker(el).setLngLat([loc.lng, loc.lat]).addTo(map.current);
          } else {
            userMarkerRef.current.setLngLat([loc.lng, loc.lat]);
          }

          map.current.setCenter([loc.lng, loc.lat]);
          if (onLocationUpdate) {
            onLocationUpdate(loc);
          }
        },
        (error) => {
          logger.warn('Geolocation watch error:', error);
        }
      );
    }

    return () => {
      if (geolocationWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(geolocationWatchIdRef.current);
        geolocationWatchIdRef.current = null;
      }
      if (map.current) {
        map.current.remove();
        map.current = null;
        isInitializedRef.current = false;
      }
    };
  }, [enableGeolocation, onLocationUpdate, sosMarkers, userLocation]);

  // Load risk zones
  useEffect(() => {
    riskZonesService
      .getRiskZones()
      .then((zones) => {
        setRiskZones(zones);
      })
      .catch((error) => {
        logger.error('Failed to load risk zones:', error);
      });
  }, []);

  // Add risk zone polygons to map
  useEffect(() => {
    if (!map.current || !mapLoaded || riskZones.length === 0) return;

    const mapInstance = map.current;
    if (!mapInstance) return;

    const existingIds = riskZoneIdsRef.current;
    const currentIds = riskZones.map((z) => z.id);

    existingIds.forEach((id) => {
      if (currentIds.includes(id)) return;

      const sourceId = `risk-zone-${id}`;
      const layerId = `risk-zone-layer-${id}`;
      const outlineLayerId = `${layerId}-outline`;

      if (mapInstance.getLayer(outlineLayerId)) {
        mapInstance.removeLayer(outlineLayerId);
      }
      if (mapInstance.getLayer(layerId)) {
        mapInstance.removeLayer(layerId);
      }
      if (mapInstance.getSource(sourceId)) {
        mapInstance.removeSource(sourceId);
      }
    });

    // Add sources and layers
    riskZones.forEach((zone) => {
      const sourceId = `risk-zone-${zone.id}`;
      const layerId = `risk-zone-layer-${zone.id}`;
      const outlineLayerId = `${layerId}-outline`;

      // Add source
      if (!mapInstance?.getSource(sourceId)) {
        mapInstance?.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: zone.polygon,
            properties: {
              name: zone.name,
              type: zone.type,
            },
          },
        });
      } else {
        try {
          (mapInstance.getSource(sourceId) as any)?.setData({
            type: 'Feature',
            geometry: zone.polygon,
            properties: {
              name: zone.name,
              type: zone.type,
            },
          });
        } catch (error) {
          // Ignore if source type does not support setData
        }
      }

      // Add layer
      if (!mapInstance?.getLayer(layerId)) {
        mapInstance?.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': zone.type === 'high' ? '#ef4444' : '#10b981', // red for high, green for low
            'fill-opacity': zone.type === 'high' ? 0.4 : 0.3,
          },
        });
      } else {
        mapInstance.setPaintProperty(layerId, 'fill-color', zone.type === 'high' ? '#ef4444' : '#10b981');
        mapInstance.setPaintProperty(layerId, 'fill-opacity', zone.type === 'high' ? 0.4 : 0.3);
      }

      // Add outline
      if (!mapInstance?.getLayer(outlineLayerId)) {
        mapInstance?.addLayer({
          id: outlineLayerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': zone.type === 'high' ? '#dc2626' : '#059669',
            'line-width': 2,
          },
        });
      } else {
        mapInstance.setPaintProperty(outlineLayerId, 'line-color', zone.type === 'high' ? '#dc2626' : '#059669');
        mapInstance.setPaintProperty(outlineLayerId, 'line-width', 2);
      }
    });

    riskZoneIdsRef.current = currentIds;
  }, [mapLoaded, riskZones]);

  // Update user location marker
  useEffect(() => {
    if (!map.current || !mapLoaded || !userLocation) return;

    const mapInstance = map.current;
    if (!mapInstance) return;

    if (!userMarkerRef.current) {
      // Create user marker
      const el = document.createElement('div');
      el.className = 'user-marker';
      el.style.width = '20px';
      el.style.height = '20px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#4F46E5';
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 0 10px rgba(79, 70, 229, 0.5)';

      userMarkerRef.current = new mapboxgl.Marker(el)
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(mapInstance);
    } else {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    }
  }, [userLocation, mapLoaded]);

  // Update SOS markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const mapInstance = map.current;
    if (!mapInstance) return;

    // Remove existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add new markers
    sosMarkers.forEach((sos) => {
      const el = document.createElement('div');
      el.className = 'sos-marker';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = sos.riskScore >= 50 ? '#ef4444' : sos.riskScore >= 25 ? '#f59e0b' : '#10b981';
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.8)';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.fontSize = '12px';
      el.style.fontWeight = 'bold';
      el.style.color = 'white';
      el.textContent = '!';

      const marker = new mapboxgl.Marker(el)
        .setLngLat([sos.lng, sos.lat])
        .addTo(mapInstance);

      markersRef.current.push(marker);
    });

    if (!hasAutoFitRef.current && sosMarkers.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      sosMarkers.forEach((m) => {
        if (Number.isFinite(m.lat) && Number.isFinite(m.lng)) {
          bounds.extend([m.lng, m.lat]);
        }
      });
      if (userLocation && Number.isFinite(userLocation.lat) && Number.isFinite(userLocation.lng)) {
        bounds.extend([userLocation.lng, userLocation.lat]);
      }
      if (!bounds.isEmpty()) {
        mapInstance.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 0 });
        hasAutoFitRef.current = true;
      }
    }
  }, [sosMarkers, mapLoaded, userLocation]);

  return (
    <div className="relative w-full rounded-lg overflow-hidden" style={{ height }}>
      {tokenMissing || initError ? (
        <div className="w-full h-full flex items-center justify-center bg-slate-700 text-slate-200 text-sm px-4 text-center">
          {tokenMissing ? 'Map is not configured. Set MAPBOX_TOKEN.' : initError}
        </div>
      ) : (
        <div ref={mapContainer} className="w-full h-full" />
      )}
      <style>{`
        .mapboxgl-popup-content {
          background: #1e293b;
          color: white;
          border-radius: 8px;
          padding: 12px;
        }
        .mapboxgl-popup-tip {
          border-top-color: #1e293b;
        }
      `}</style>
    </div>
  );
}
