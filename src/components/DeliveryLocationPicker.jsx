import { useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const PHILIPPINES_CENTER = [12.8797, 121.774];
const pinIcon = L.divIcon({
  className: "",
  html: '<div style="width:20px;height:20px;background:#be185d;border:3px solid #fff;border-radius:50% 50% 50% 0;box-shadow:0 2px 8px #0006;transform:rotate(-45deg)"></div>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

function MapClickHandler({ onPick }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng);
    },
  });
  return null;
}

export default function DeliveryLocationPicker({ location, onSelect }) {
  const [lookupStatus, setLookupStatus] = useState("");
  const lookupControllerRef = useRef(null);
  const lastLookupAtRef = useRef(0);

  const pickLocation = async ({ lat, lng }) => {
    const point = { lat: Number(lat.toFixed(7)), lng: Number(lng.toFixed(7)) };
    onSelect({ ...point, address: null });
    lookupControllerRef.current?.abort();

    const controller = new AbortController();
    lookupControllerRef.current = controller;
    setLookupStatus("Finding this address...");
    const lookupAt = Math.max(Date.now(), lastLookupAtRef.current + 1100);
    lastLookupAtRef.current = lookupAt;
    const wait = Math.max(0, lookupAt - Date.now());
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    if (controller.signal.aborted) return;

    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        addressdetails: "1",
        lat: String(point.lat),
        lon: String(point.lng),
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
        signal: controller.signal,
        headers: { "Accept-Language": "en" },
      });
      if (!response.ok) throw new Error(`Address lookup failed (${response.status}).`);
      const result = await response.json();
      const address = result.address || {};
      const street = [
        address.house_number,
        address.road || address.pedestrian || address.footway,
        address.neighbourhood || address.suburb || address.quarter,
      ].filter(Boolean).join(", ");
      const city = address.city || address.town || address.village ||
        address.municipality || address.county || "";
      const locationAddress = {
        street,
        city,
        zip: address.postcode || "",
        display: result.display_name || "",
      };
      onSelect({ ...point, address: locationAddress });
      setLookupStatus(locationAddress.display
        ? `Pin selected: ${locationAddress.display}`
        : "Pin selected. Add the street and city details below.");
    } catch (error) {
      if (error.name !== "AbortError") {
        setLookupStatus("Pin saved, but address lookup failed. Enter the street and city below.");
      }
    }
  };

  const initialPosition = location ? [location.lat, location.lng] : PHILIPPINES_CENTER;

  return (
    <div>
      <MapContainer
        center={initialPosition}
        zoom={location ? 16 : 6}
        scrollWheelZoom
        style={{ width: "100%", height: 300, borderRadius: 12, border: "1px solid #fce7f3", zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onPick={pickLocation} />
        {location && <Marker position={[location.lat, location.lng]} icon={pinIcon} />}
      </MapContainer>
      <p role="status" style={{ color: location ? "#166534" : "#888", fontSize: 12, margin: "8px 0 0" }}>
        {location
          ? `${lookupStatus || "Pin selected"} · ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
          : "Click the map to pin the exact delivery drop-off point."}
      </p>
    </div>
  );
}
