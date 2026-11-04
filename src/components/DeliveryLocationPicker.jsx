import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
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

function MapViewport({ location }) {
  const map = useMap();

  useEffect(() => {
    if (location) {
      map.flyTo([location.lat, location.lng], Math.max(map.getZoom(), 16), { duration: 0.8 });
    }
  }, [location?.lat, location?.lng, map]);

  return null;
}

function getLocationAddress(result) {
  const address = result.address || {};
  const street = [
    address.house_number,
    address.road || address.pedestrian || address.footway,
    address.neighbourhood || address.suburb || address.quarter,
  ].filter(Boolean).join(", ");
  const city = address.city || address.town || address.village ||
    address.municipality || address.county || "";

  return {
    street,
    city,
    zip: address.postcode || "",
    display: result.display_name || "",
  };
}

export default function DeliveryLocationPicker({ location, onSelect }) {
  const [lookupStatus, setLookupStatus] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const lookupControllerRef = useRef(null);
  const searchControllerRef = useRef(null);
  const lastLookupAtRef = useRef(0);

  const searchAddress = async (event) => {
    event.preventDefault();
    const query = addressQuery.trim();
    if (!query) {
      setLookupStatus("Enter an address to search.");
      return;
    }

    lookupControllerRef.current?.abort();
    searchControllerRef.current?.abort();
    const controller = new AbortController();
    searchControllerRef.current = controller;
    setSearching(true);
    setSearchResults([]);
    setLookupStatus("Searching for address...");

    const lookupAt = Math.max(Date.now(), lastLookupAtRef.current + 1100);
    lastLookupAtRef.current = lookupAt;
    const wait = Math.max(0, lookupAt - Date.now());
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    if (controller.signal.aborted) return;

    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        addressdetails: "1",
        limit: "5",
        countrycodes: "ph",
        q: query,
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        signal: controller.signal,
        headers: { "Accept-Language": "en" },
      });
      if (!response.ok) throw new Error(`Address search failed (${response.status}).`);
      const results = await response.json();
      if (controller.signal.aborted) return;
      if (!results.length) {
        setLookupStatus("No matching address found. Try adding a city or province.");
        return;
      }
      setSearchResults(results);
      setLookupStatus("Choose an address to show it on the map.");
    } catch (error) {
      if (error.name !== "AbortError") {
        setLookupStatus("Address search failed. Please try again.");
      }
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  };

  const selectSearchResult = (result) => {
    const point = { lat: Number(result.lat), lng: Number(result.lon) };
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
      setLookupStatus("The selected address has invalid map coordinates. Try another result.");
      return;
    }
    lookupControllerRef.current?.abort();
    searchControllerRef.current?.abort();
    setSearching(false);
    setSearchResults([]);
    setAddressQuery(result.display_name || addressQuery);
    onSelect({ ...point, address: getLocationAddress(result) });
    setLookupStatus(`Address selected: ${result.display_name}`);
  };

  const pickLocation = async ({ lat, lng }) => {
    const point = { lat: Number(lat.toFixed(7)), lng: Number(lng.toFixed(7)) };
    searchControllerRef.current?.abort();
    setSearching(false);
    setSearchResults([]);
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
      const locationAddress = getLocationAddress(result);
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
      <form onSubmit={searchAddress} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          type="search"
          value={addressQuery}
          onChange={(event) => setAddressQuery(event.target.value)}
          placeholder="Type your delivery address"
          aria-label="Search delivery address"
          style={{ flex: 1, minWidth: 0, padding: "10px 12px", border: "1.5px solid #fce7f3", borderRadius: 10, fontSize: 13 }}
        />
        <button
          type="submit"
          disabled={searching}
          style={{ border: "none", borderRadius: 10, padding: "0 16px", background: searching ? "#e5e5e5" : "#be185d", color: searching ? "#777" : "#fff", fontWeight: 700, cursor: searching ? "wait" : "pointer" }}
        >
          {searching ? "Searching..." : "Search"}
        </button>
      </form>
      {searchResults.length > 0 && (
        <div role="listbox" aria-label="Address search results" style={{ marginBottom: 10, border: "1px solid #fce7f3", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          {searchResults.map((result) => (
            <button
              key={result.place_id}
              type="button"
              role="option"
              aria-selected="false"
              onClick={() => selectSearchResult(result)}
              style={{ display: "block", width: "100%", padding: "10px 12px", border: "none", borderBottom: "1px solid #fce7f3", background: "#fff", color: "#333", textAlign: "left", fontSize: 12, cursor: "pointer" }}
            >
              {result.display_name}
            </button>
          ))}
        </div>
      )}
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
        <MapViewport location={location} />
        <MapClickHandler onPick={pickLocation} />
        {location && <Marker position={[location.lat, location.lng]} icon={pinIcon} />}
      </MapContainer>
      <p role="status" style={{ color: location ? "#166534" : "#888", fontSize: 12, margin: "8px 0 0" }}>
        {location
          ? `${lookupStatus || "Pin selected"} · ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
          : lookupStatus || "Search for your address or click the map to pin the exact delivery drop-off point."}
      </p>
    </div>
  );
}
