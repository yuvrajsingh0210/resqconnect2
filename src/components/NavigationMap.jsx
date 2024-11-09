import { useEffect, useRef } from 'react';

export default function NavigationMap({ origin, destination }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (!origin || mapInstance.current) return;

    // Initialize map only once
    mapInstance.current = new window.maplibregl.Map({
      container: mapRef.current,
      style: `https://maps.geoapify.com/v1/styles/osm-carto/style.json?apiKey=1ea6f877eb5344abb30e11c55bcf56c8`,
      center: [origin.lng, origin.lat],
      zoom: 12
    });

    // Add origin (volunteer location) marker
    new window.maplibregl.Marker({ color: '#ef4444' })
      .setLngLat([origin.lng, origin.lat])
      .addTo(mapInstance.current);

    return () => {
      mapInstance.current.remove();
      mapInstance.current = null;
    };
  }, [origin]);

  useEffect(() => {
    if (!mapInstance.current || !destination) return;

    mapInstance.current.on('load', () => {
      const routingUrl = `https://api.geoapify.com/v1/routing?waypoints=${origin.lat},${origin.lng}|${destination.lat},${destination.lng}&mode=drive&apiKey=2780201a77744f8e89350dfb5c5e7566`;

      fetch(routingUrl)
        .then(res => res.json())
        .then(result => {
          mapInstance.current.addSource('route', {
            type: 'geojson',
            data: result
          });

          mapInstance.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#3b82f6',
              'line-width': 4
            }
          });

          // Add destination (evacuee location) marker
          new window.maplibregl.Marker({ color: '#22c55e' })
            .setLngLat([destination.lng, destination.lat])
            .addTo(mapInstance.current);

          // Fit map bounds to include both markers
          const bounds = new window.maplibregl.LngLatBounds();
          bounds.extend([origin.lng, origin.lat]);
          bounds.extend([destination.lng, destination.lat]);
          mapInstance.current.fitBounds(bounds, { padding: 50 });
        });
    });
  }, [destination, origin]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
}