import React, { useState, useEffect } from 'react';
import {
  CloudSun,
  Sun,
  CloudRain,
  Cloud,
  Wind,
  Droplets,
  Gauge,
  Activity,
  Search,
  RefreshCw,
  Terminal,
  CheckCircle2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { WeatherData } from '../domain/plugins';
import { useLanguage } from '../context/LanguageContext';

const PRESET_CITIES = [
  { name: 'Beijing', name_zh: '北京' },
  { name: 'Shanghai', name_zh: '上海' },
  { name: 'Hangzhou', name_zh: '杭州' },
  { name: 'Shenzhen', name_zh: '深圳' },
  { name: 'Tokyo', name_zh: '东京' },
  { name: 'New York', name_zh: '纽约' },
  { name: 'London', name_zh: '伦敦' },
  { name: 'Paris', name_zh: '巴黎' },
  { name: 'Singapore', name_zh: '新加坡' },
];

export const WeatherPluginView: React.FC = () => {
  const { t, language } = useLanguage();
  const [selectedCity, setSelectedCity] = useState<string>('Beijing');
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchCity, setSearchCity] = useState<string>('');
  const [agentJsonOutput, setAgentJsonOutput] = useState<any>(null);

  const fetchWeather = async (city: string, unit: 'metric' | 'imperial') => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/weather/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, units: unit }),
      });
      const json = await res.json();
      if (json.data) {
        setWeatherData(json.data);
        setAgentJsonOutput({
          tool: 'weather_current',
          invoked_at: json.data.updated_at,
          status: 'SUCCESS',
          output: {
            city: json.data.city,
            temperature: `${json.data.temperature}${json.data.temperature_unit}`,
            condition: json.data.condition,
            humidity: `${json.data.humidity_percent}%`,
            wind: `${json.data.wind_speed_kmh} km/h (${json.data.wind_direction})`,
            aqi: json.data.air_quality,
          },
        });
      }
    } catch (err) {
      console.error('Weather fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather(selectedCity, units);
  }, [selectedCity, units]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchCity.trim()) {
      setSelectedCity(searchCity.trim());
      setSearchCity('');
    }
  };

  const getConditionIcon = (conditionCode?: string) => {
    switch (conditionCode) {
      case 'SUNNY':
        return <Sun className="w-10 h-10 text-amber-400 animate-spin-slow" />;
      case 'RAIN':
      case 'HEAVY_RAIN':
        return <CloudRain className="w-10 h-10 text-cyan-400" />;
      case 'THUNDERSTORM':
        return <CloudRain className="w-10 h-10 text-purple-400" />;
      case 'CLOUDY':
      case 'OVERCAST':
        return <Cloud className="w-10 h-10 text-slate-300" />;
      default:
        return <CloudSun className="w-10 h-10 text-amber-300" />;
    }
  };

  const getAqiColor = (status?: string) => {
    switch (status) {
      case 'EXCELLENT':
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-800';
      case 'GOOD':
        return 'text-cyan-400 bg-cyan-950/60 border-cyan-800';
      case 'MODERATE':
        return 'text-amber-400 bg-amber-950/60 border-amber-800';
      default:
        return 'text-rose-400 bg-rose-950/60 border-rose-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-2.5 py-0.5 rounded flex items-center gap-1.5">
              <CloudSun className="w-3.5 h-3.5" />
              Meteorological Intelligence API
            </span>
            <span className="text-xs text-slate-500">|</span>
            <span className="text-xs text-slate-400 font-mono">Real-time Telemetry & Forecasting</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">{t.weatherTitle}</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">{t.weatherSubtitle}</p>
        </div>

        {/* Unit Toggle & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
            <button
              onClick={() => setUnits('metric')}
              className={`px-2.5 py-1 rounded transition ${
                units === 'metric'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              °C (Metric)
            </button>
            <button
              onClick={() => setUnits('imperial')}
              className={`px-2.5 py-1 rounded transition ${
                units === 'imperial'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              °F (Imperial)
            </button>
          </div>

          <button
            onClick={() => fetchWeather(selectedCity, units)}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Preset Cities Strip */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {PRESET_CITIES.map((city) => {
            const isSelected = selectedCity.toLowerCase() === city.name.toLowerCase();
            return (
              <button
                key={city.name}
                onClick={() => setSelectedCity(city.name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-950/80 border border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {language === 'zh' ? city.name_zh : city.name}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSearch} className="relative min-w-[220px]">
          <input
            type="text"
            value={searchCity}
            onChange={(e) => setSearchCity(e.target.value)}
            placeholder={t.weatherSearchPlaceholder}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-12 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <button
            type="submit"
            className="absolute right-1 top-1 bottom-1 px-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-medium transition"
          >
            Query
          </button>
        </form>
      </div>

      {/* Weather Dashboard Grid */}
      {weatherData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Weather Card */}
          <div className="lg:col-span-7 p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    {weatherData.city}
                  </h2>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {weatherData.country}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Telemetry Updated: {new Date(weatherData.updated_at).toLocaleTimeString()}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                {getConditionIcon(weatherData.condition_code)}
              </div>
            </div>

            {/* Temperature Big Display */}
            <div className="flex items-baseline gap-4">
              <span className="text-6xl font-extrabold text-white tracking-tighter">
                {weatherData.temperature}{weatherData.temperature_unit}
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-200">
                  {weatherData.condition}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  UV Index: {weatherData.uv_index} / 10 • Pressure: {weatherData.pressure_hpa} hPa
                </div>
              </div>
            </div>

            {/* Detailed Metric Gauges */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t.weatherHumidity}</span>
                </div>
                <div className="text-base font-bold text-white">
                  {weatherData.humidity_percent}%
                </div>
                <div className="text-[10px] text-slate-400">Relative Saturation</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{t.weatherWind}</span>
                </div>
                <div className="text-base font-bold text-white">
                  {weatherData.wind_speed_kmh} km/h
                </div>
                <div className="text-[10px] text-slate-400">
                  Direction: {weatherData.wind_direction}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t.weatherAqi}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-bold text-white">
                    {weatherData.air_quality.aqi}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold ${getAqiColor(
                      weatherData.air_quality.status
                    )}`}
                  >
                    {weatherData.air_quality.status}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  PM2.5: {weatherData.air_quality.pm2_5} μg/m³
                </div>
              </div>
            </div>

            {/* 5-Day Forecast Row */}
            <div>
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t.weatherForecast5Day}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {weatherData.forecast.map((day, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-center space-y-1"
                  >
                    <div className="text-[11px] font-medium text-slate-400">{day.day}</div>
                    <div className="text-xs font-bold text-white">
                      {day.temp_high}° / <span className="text-slate-400 font-normal">{day.temp_low}°</span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{day.condition}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Agent Tool Invocation Payload & Schema Inspector */}
          <div className="lg:col-span-5 p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-semibold text-white">
                    {t.weatherAgentJsonPreview}
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-2 py-0.5 rounded">
                  Schema Strict
                </span>
              </div>

              <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
                {language === 'zh'
                  ? '当编排自治智能体（如 SRE Sentinel 或 Weather Assistant）并在提示词中要求查询某地天气时，执行引擎在沙箱内调用 weather_current 工具，返回如下标准结构：'
                  : 'When autonomous agents execute tools during runs, the sandbox invokes weather_current and returns this structured payload to the model:'}
              </p>

              {agentJsonOutput && (
                <div className="mt-3 p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-[360px]">
                  <pre>{JSON.stringify(agentJsonOutput, null, 2)}</pre>
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-800/40 text-[11px] text-indigo-300 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
              <span>
                {language === 'zh'
                  ? '此插件已注册为平台全局可用工具，并赋予 APP_DEVELOPER 权限。在「智能体编排」的工具白名单中可直接勾选 weather_current 与 weather_forecast。'
                  : 'Registered as a global platform tool with APP_DEVELOPER grant. Ready to be added to any agent tool whitelist.'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
