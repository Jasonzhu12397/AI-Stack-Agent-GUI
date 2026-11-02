import React, { useState, useEffect, useCallback } from 'react';
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import {
  MapPin,
  Search,
  Navigation,
  Layers,
  Compass,
  AlertTriangle,
  Info,
  CheckCircle2,
  ExternalLink,
  Shield,
  Route,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface CityPreset {
  name: string;
  name_zh: string;
  lat: number;
  lng: number;
  zoom: number;
}

const CITY_PRESETS: CityPreset[] = [
  { name: 'Beijing', name_zh: '北京', lat: 39.9042, lng: 116.4074, zoom: 12 },
  { name: 'Shanghai', name_zh: '上海', lat: 31.2304, lng: 121.4737, zoom: 12 },
  { name: 'Tokyo', name_zh: '东京', lat: 35.6762, lng: 139.6503, zoom: 12 },
  { name: 'San Francisco', name_zh: '旧金山', lat: 37.7749, lng: -122.4194, zoom: 12 },
  { name: 'New York', name_zh: '纽约', lat: 40.7128, lng: -74.006, zoom: 12 },
  { name: 'London', name_zh: '伦敦', lat: 51.5074, lng: -0.1278, zoom: 12 },
];

export const GoogleMapsView: React.FC = () => {
  const { t, language } = useLanguage();
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: 39.9042,
    lng: 116.4074,
  });
  const [zoom, setZoom] = useState<number>(12);
  const [activeCity, setActiveCity] = useState<string>('Beijing');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>({
    lat: 39.9042,
    lng: 116.4074,
  });
  const [markerTitle, setMarkerTitle] = useState<string>('Beijing Central Hub');
  const [quotaExceeded, setQuotaExceeded] = useState<boolean>(false);
  const [poiResults, setPoiResults] = useState<Array<{ name: string; type: string; distance: string }>>([
    { name: 'Chaoyang Science Park', type: 'Technology Hub', distance: '1.2 km' },
    { name: 'Financial Street Center', type: 'Commercial Core', distance: '3.4 km' },
    { name: 'Olympic Green District', type: 'Public Landmark', distance: '5.1 km' },
  ]);
  const [distanceCalc, setDistanceCalc] = useState<{
    origin: string;
    destination: string;
    distance: string;
    duration: string;
    routeSteps: string[];
  } | null>(null);

  // Mandatory Quota error handler listening on `gmp-quota-exceeded`
  useEffect(() => {
    const onQuotaExceeded = () => {
      setQuotaExceeded(true);
    };
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
    };
  }, []);

  const handleSelectCity = (city: CityPreset) => {
    setActiveCity(city.name);
    setCenter({ lat: city.lat, lng: city.lng });
    setMarkerPosition({ lat: city.lat, lng: city.lng });
    setZoom(city.zoom);
    setMarkerTitle(`${city.name} (${city.name_zh}) Center`);

    if (city.name === 'Shanghai') {
      setPoiResults([
        { name: 'Lujiazui Financial Tower', type: 'Finance Hub', distance: '0.8 km' },
        { name: 'Zhangjiang Hi-Tech Park', type: 'Innovation Center', distance: '6.2 km' },
        { name: 'Hongqiao Transportation Hub', type: 'Transit Hub', distance: '12.0 km' },
      ]);
    } else if (city.name === 'Tokyo') {
      setPoiResults([
        { name: 'Shibuya Crossing', type: 'Urban Landmark', distance: '0.5 km' },
        { name: 'Marunouchi Station', type: 'Transit Interchange', distance: '2.1 km' },
        { name: 'Roppongi Tech Center', type: 'Digital HQ', distance: '3.8 km' },
      ]);
    } else if (city.name === 'San Francisco') {
      setPoiResults([
        { name: 'Market Street Hub', type: 'Tech District', distance: '0.6 km' },
        { name: 'Mission Bay BioPark', type: 'Research Cluster', distance: '2.4 km' },
        { name: 'SOMA Innovation Labs', type: 'Co-Working Campus', distance: '1.5 km' },
      ]);
    } else {
      setPoiResults([
        { name: `${city.name} Central Terminal`, type: 'Transit Station', distance: '1.0 km' },
        { name: `${city.name} Innovation Square`, type: 'Business District', distance: '2.3 km' },
        { name: `${city.name} Metropolitan Center`, type: 'Civic Core', distance: '4.1 km' },
      ]);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const lower = searchQuery.toLowerCase();
    const matched = CITY_PRESETS.find(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.name_zh.includes(searchQuery) ||
        lower.includes(c.name.toLowerCase())
    );

    if (matched) {
      handleSelectCity(matched);
    } else {
      // Simulate geocoding result
      const newLat = center.lat + (Math.random() - 0.5) * 0.05;
      const newLng = center.lng + (Math.random() - 0.5) * 0.05;
      setCenter({ lat: newLat, lng: newLng });
      setMarkerPosition({ lat: newLat, lng: newLng });
      setMarkerTitle(searchQuery);
    }
  };

  const handleCalculateRoute = () => {
    setDistanceCalc({
      origin: `${activeCity} Node Alpha`,
      destination: `${activeCity} Airport Logistics Terminal`,
      distance: '24.8 km',
      duration: '32 mins (Moderate Traffic)',
      routeSteps: [
        'Head northeast along Metro Ring Expressway',
        'Take exit 14B toward Logistics Central Park',
        'Merge onto Innovation Boulevard for 4.2 km',
        'Destination terminal is on the right',
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-2.5 py-0.5 rounded flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {t.mapsDemoKeyActive}
            </span>
            <span className="text-xs text-slate-500">|</span>
            <span className="text-xs text-slate-400 font-mono">@vis.gl/react-google-maps v1.5.0</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">{t.mapsTitle}</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">{t.mapsSubtitle}</p>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-400">{t.mapsCoordinates}:</span>
          <span className="text-emerald-400 font-bold">
            {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Quota Exceeded Notification Banner */}
      {quotaExceeded && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800 text-amber-300 text-xs flex items-start gap-3 shadow-lg">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-amber-200">{t.mapsQuotaWarning}</div>
            <p className="text-[11px] text-amber-400/90 leading-relaxed">
              Google Maps Demo Key daily request limit reached. In production, configure an enterprise key in Google Cloud Console with HTTP referrer restrictions.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Controls + Interactive Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Preset Cities, Geocoding Search, POI List */}
        <div className="lg:col-span-4 space-y-4">
          {/* Geocoding Search */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.mapsSearchPlaceholder}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-16 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-2.5" />
              <button
                type="submit"
                className="absolute right-1 top-1 bottom-1 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-medium transition"
              >
                Go
              </button>
            </form>

            {/* City Preset Pills */}
            <div>
              <div className="text-[11px] text-slate-400 font-medium mb-1.5">
                {language === 'zh' ? '预置核心枢纽城市' : 'Preset Hub Cities'}:
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {CITY_PRESETS.map((city) => {
                  const isSelected = activeCity === city.name;
                  return (
                    <button
                      key={city.name}
                      onClick={() => handleSelectCity(city)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium text-center transition flex items-center justify-center gap-1 ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <Compass className="w-3 h-3 opacity-70" />
                      <span>{language === 'zh' ? city.name_zh : city.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* POI / Places Nearby */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                {language === 'zh' ? '周边空间设施检索 (Places API)' : 'Nearby POI Search (Places API)'}
              </span>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-900">
                Active
              </span>
            </div>

            <div className="space-y-2">
              {poiResults.map((poi, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between hover:border-slate-700 transition"
                >
                  <div>
                    <div className="font-medium text-slate-200">{poi.name}</div>
                    <div className="text-[10px] text-slate-400">{poi.type}</div>
                  </div>
                  <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800">
                    {poi.distance}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handleCalculateRoute}
              className="w-full py-2 px-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition"
            >
              <Route className="w-3.5 h-3.5 text-cyan-400" />
              <span>{language === 'zh' ? '测算路径矩阵与通勤时间' : 'Calculate Distance Matrix & Routes'}</span>
            </button>

            {distanceCalc && (
              <div className="p-3 rounded-lg bg-slate-950 border border-indigo-900/60 text-xs space-y-2">
                <div className="flex justify-between items-center text-indigo-300 font-semibold text-[11px]">
                  <span>{distanceCalc.origin} → {distanceCalc.destination}</span>
                  <span className="text-emerald-400 font-mono">{distanceCalc.distance}</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {distanceCalc.duration}
                </div>
                <ol className="text-[10px] text-slate-400 list-decimal pl-4 space-y-0.5">
                  {distanceCalc.routeSteps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Google Maps Interactive Canvas */}
        <div className="lg:col-span-8 p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-semibold text-white">
                {language === 'zh' ? '高精度空间渲染画布' : 'High-Precision Geospatial Canvas'}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                (Center: {center.lat.toFixed(4)}, {center.lng.toFixed(4)} | Zoom: {zoom})
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              Target ID: <span className="text-indigo-300">gmp_mcp_codeassist_v1_aistudio</span>
            </div>
          </div>

          {/* Map Container */}
          <div className="w-full h-[520px] rounded-lg overflow-hidden border border-slate-800 bg-slate-950 relative">
            {apiKey ? (
              <APIProvider apiKey={apiKey}>
                <Map
                  center={center}
                  zoom={zoom}
                  gestureHandling="greedy"
                  disableDefaultUI={false}
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  className="w-full h-full"
                  onCameraChanged={(ev) => {
                    setCenter(ev.detail.center);
                    setZoom(ev.detail.zoom);
                  }}
                >
                  {markerPosition && (
                    <Marker
                      position={markerPosition}
                      title={markerTitle}
                    />
                  )}
                </Map>
              </APIProvider>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
                <div className="text-sm font-semibold text-white">Google Maps API Key Missing</div>
                <p className="text-xs max-w-sm mt-1">
                  Please ensure VITE_GOOGLE_MAPS_API_KEY is configured in .env.local to initialize the interactive map.
                </p>
              </div>
            )}

            {/* Overlay Attribution Badge */}
            <div className="absolute bottom-6 left-3 bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-md px-2.5 py-1 text-[10px] text-slate-300 font-mono shadow-md flex items-center gap-1.5 pointer-events-none">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>GHP Demo Project | Non-Commercial AI Studio License</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
