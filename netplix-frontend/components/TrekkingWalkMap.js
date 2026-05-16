'use client';

import { useEffect, useMemo } from 'react';

let L;
let MapContainer;
let TileLayer;
let Polyline;
let CircleMarker;
let useMap;

function loadLeaflet() {
  if (L) return;
  L = require('leaflet');
  const rl = require('react-leaflet');
  MapContainer = rl.MapContainer;
  TileLayer = rl.TileLayer;
  Polyline = rl.Polyline;
  CircleMarker = rl.CircleMarker;
  useMap = rl.useMap;
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

function FitBounds({ points, userPoint }) {
  const map = useMap();
  const all = useMemo(() => {
    const arr = [...(points || [])];
    if (userPoint) arr.push(userPoint);
    return arr;
  }, [points, userPoint]);

  useEffect(() => {
    if (!map || all.length === 0) return;
    const bounds = L.latLngBounds(all.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
  }, [map, all]);

  return null;
}

/**
 * @param {{ courseTrack: {lat:number,lng:number}[], userTrack: {lat:number,lng:number}[], userPosition: {lat:number,lng:number}|null }} props
 */
export default function TrekkingWalkMap({ courseTrack = [], userTrack = [], userPosition = null }) {
  loadLeaflet();

  const center = useMemo(() => {
    if (userPosition) return [userPosition.lat, userPosition.lng];
    if (courseTrack.length) return [courseTrack[0].lat, courseTrack[0].lng];
    return [36.5, 127.8];
  }, [courseTrack, userPosition]);

  const courseLine = useMemo(
    () => courseTrack.map((p) => [p.lat, p.lng]),
    [courseTrack],
  );
  const walkedLine = useMemo(
    () => userTrack.map((p) => [p.lat, p.lng]),
    [userTrack],
  );

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ width: '100%', height: '100%', minHeight: 280 }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={courseTrack} userPoint={userPosition} />
      {courseLine.length > 1 && (
        <Polyline positions={courseLine} pathOptions={{ color: '#38bdf8', weight: 4, opacity: 0.85 }} />
      )}
      {walkedLine.length > 1 && (
        <Polyline positions={walkedLine} pathOptions={{ color: '#4ade80', weight: 5, opacity: 0.9 }} />
      )}
      {userPosition && (
        <CircleMarker
          center={[userPosition.lat, userPosition.lng]}
          radius={9}
          pathOptions={{ color: '#fff', fillColor: '#22c55e', fillOpacity: 1, weight: 2 }}
        />
      )}
    </MapContainer>
  );
}
