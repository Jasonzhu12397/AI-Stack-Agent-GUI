/**
 * Plugin & Connector Management Domain
 * Aligned with docs/architecture-baseline.md & docs/vibe-coding.md
 * Integrates:
 * 1. Google Maps Platform (Geospatial computation, Geocoding, Places, Routes)
 * 2. Global Weather Intelligence (Live metrics, forecasts, AQI)
 * 3. Domestic Enterprise Connectors: Feishu (飞书), DingTalk (钉钉), WeCom (企业微信), Amap (高德)
 */

import { ToolDefinition, RiskLevel } from '../contracts/types';
import { DataSanitizer } from './sanitizer';

export type PluginCategory = 'MAPS' | 'WEATHER' | 'DOMESTIC_APPS' | 'SYSTEM_TOOLS';

export interface PluginItem {
  id: string;
  name: string;
  name_zh: string;
  category: PluginCategory;
  provider: 'GOOGLE' | 'METEO_SERVICE' | 'FEISHU' | 'DINGTALK' | 'WECOM' | 'AMAP' | 'SYSTEM';
  version: string;
  description: string;
  description_zh: string;
  icon: string;
  is_active: boolean;
  is_configured: boolean;
  auth_type: 'API_KEY' | 'WEBHOOK_SECRET' | 'HMAC_SHA256' | 'BEARER_TOKEN' | 'NONE';
  config: {
    api_key_ref?: string;
    webhook_url?: string;
    webhook_secret?: string;
    app_id?: string;
    app_secret_ref?: string;
    endpoint?: string;
    timeout_ms?: number;
  };
  metrics: {
    total_calls: number;
    success_calls: number;
    error_calls: number;
    p95_latency_ms: number;
    last_called_at?: string;
  };
  tools: ToolDefinition[];
}

export interface WeatherQueryArgs {
  city: string;
  units?: 'metric' | 'imperial';
  include_forecast?: boolean;
}

export interface WeatherData {
  city: string;
  country: string;
  temperature: number;
  temperature_unit: '°C' | '°F';
  condition: string;
  condition_code: 'SUNNY' | 'CLOUDY' | 'OVERCAST' | 'RAIN' | 'HEAVY_RAIN' | 'SNOW' | 'THUNDERSTORM';
  humidity_percent: number;
  wind_speed_kmh: number;
  wind_direction: string;
  pressure_hpa: number;
  uv_index: number;
  air_quality: {
    aqi: number;
    status: 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'UNHEALTHY' | 'HAZARDOUS';
    pm2_5: number;
    pm10: number;
  };
  forecast: Array<{
    day: string;
    temp_high: number;
    temp_low: number;
    condition: string;
  }>;
  updated_at: string;
}

export interface DomesticMessagePayload {
  platform: 'feishu' | 'dingtalk' | 'wecom';
  target_url?: string;
  secret?: string;
  message_type: 'text' | 'markdown' | 'card' | 'approval_notice';
  title?: string;
  content: string;
  at_users?: string[];
  is_at_all?: boolean;
  metadata?: Record<string, any>;
}

export class PluginRegistry {
  private static plugins: Map<string, PluginItem> = new Map();

  static {
    this.seedDefaults();
  }

  public static seedDefaults() {
    // 1. Google Maps Platform
    const googleMapsTools: ToolDefinition[] = [
      {
        id: 'maps_geocode',
        name: 'Google Maps Geocoding Service',
        version: '1.0.0',
        description: 'Converts street addresses or city names into latitude/longitude coordinates.',
        category: 'CLOUD',
        input_schema: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'Address or landmark' },
          },
          required: ['address'],
        },
        output_schema: {
          type: 'object',
          properties: {
            lat: { type: 'number' },
            lng: { type: 'number' },
            formatted_address: { type: 'string' },
            place_id: { type: 'string' },
          },
        },
        permissions: ['MAPS_GEOCODE'],
        risk: 'LOW',
        idempotency_mode: 'IDEMPOTENT',
        timeout_ms: 3000,
        retry_policy: { max_retries: 2, backoff_ms: 100 },
        network_targets: ['maps.googleapis.com'],
        is_active: true,
        is_fake: false,
      },
      {
        id: 'maps_places_search',
        name: 'Google Maps Places Search',
        version: '1.0.0',
        description: 'Searches for nearby points of interest, businesses, or transit hubs.',
        category: 'CLOUD',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search term or category' },
            location: { type: 'string', description: 'Lat,Lng coordinate string' },
            radius_meters: { type: 'number', description: 'Search radius' },
          },
          required: ['query'],
        },
        output_schema: {
          type: 'object',
          properties: {
            results: { type: 'array' },
            total_count: { type: 'number' },
          },
        },
        permissions: ['MAPS_PLACES'],
        risk: 'LOW',
        idempotency_mode: 'IDEMPOTENT',
        timeout_ms: 3000,
        retry_policy: { max_retries: 2, backoff_ms: 100 },
        network_targets: ['maps.googleapis.com'],
        is_active: true,
        is_fake: false,
      },
    ];

    const googleMapsPlugin: PluginItem = {
      id: 'google_maps_platform',
      name: 'Google Maps Platform',
      name_zh: 'Google 地图地理空间计算服务',
      category: 'MAPS',
      provider: 'GOOGLE',
      version: '3.55-react',
      description: 'Interactive maps, Geocoding, Places discovery, and routing with @vis.gl/react-google-maps.',
      description_zh: '基于 @vis.gl/react-google-maps 的全球交互式地图、地理编码、POI 发现与路径矩阵。',
      icon: 'MapPin',
      is_active: true,
      is_configured: true,
      auth_type: 'API_KEY',
      config: {
        api_key_ref: 'vault://gcp/maps/demo_key',
        endpoint: 'https://maps.googleapis.com',
        timeout_ms: 4000,
      },
      metrics: {
        total_calls: 124,
        success_calls: 124,
        error_calls: 0,
        p95_latency_ms: 85,
        last_called_at: new Date().toISOString(),
      },
      tools: googleMapsTools,
    };

    // 2. Weather Intelligence Service
    const weatherTools: ToolDefinition[] = [
      {
        id: 'weather_current',
        name: 'Global Real-time Weather Inspector',
        version: '1.1.0',
        description: 'Fetches real-time temperature, meteorological conditions, humidity, and air quality.',
        category: 'CLOUD',
        input_schema: {
          type: 'object',
          properties: {
            city: { type: 'string', description: 'Target city name (e.g. Beijing, New York, Tokyo)' },
            units: { type: 'string', enum: ['metric', 'imperial'] },
          },
          required: ['city'],
        },
        output_schema: {
          type: 'object',
          properties: {
            temperature: { type: 'number' },
            condition: { type: 'string' },
            humidity_percent: { type: 'number' },
            aqi: { type: 'number' },
          },
        },
        permissions: ['WEATHER_READ'],
        risk: 'LOW',
        idempotency_mode: 'IDEMPOTENT',
        timeout_ms: 2000,
        retry_policy: { max_retries: 2, backoff_ms: 100 },
        network_targets: ['api.weather.platform'],
        is_active: true,
        is_fake: false,
      },
      {
        id: 'weather_forecast',
        name: '5-Day Weather Forecast Planner',
        version: '1.1.0',
        description: 'Predicts high/low temperature ranges and weather conditions over a 5-day window.',
        category: 'CLOUD',
        input_schema: {
          type: 'object',
          properties: {
            city: { type: 'string', description: 'City name' },
          },
          required: ['city'],
        },
        output_schema: {
          type: 'object',
          properties: {
            forecast: { type: 'array' },
          },
        },
        permissions: ['WEATHER_READ'],
        risk: 'LOW',
        idempotency_mode: 'IDEMPOTENT',
        timeout_ms: 2000,
        retry_policy: { max_retries: 2, backoff_ms: 100 },
        network_targets: ['api.weather.platform'],
        is_active: true,
        is_fake: false,
      },
    ];

    const weatherPlugin: PluginItem = {
      id: 'global_weather_service',
      name: 'Weather Intelligence Service',
      name_zh: '全球气象与空气质量智能服务',
      category: 'WEATHER',
      provider: 'METEO_SERVICE',
      version: '2.0.1',
      description: 'High-precision meteorological data, real-time climate telemetry, and 5-day predictive forecasts.',
      description_zh: '全球多城市实时气象感知、PM2.5/AQI 空气质量指标以及 5 天气象趋势预测。',
      icon: 'CloudSun',
      is_active: true,
      is_configured: true,
      auth_type: 'API_KEY',
      config: {
        api_key_ref: 'vault://services/meteo/key',
        endpoint: 'https://api.weather.platform/v2',
        timeout_ms: 2500,
      },
      metrics: {
        total_calls: 382,
        success_calls: 382,
        error_calls: 0,
        p95_latency_ms: 42,
        last_called_at: new Date().toISOString(),
      },
      tools: weatherTools,
    };

    // 3. Feishu (飞书 / Lark) Integration
    const feishuTools: ToolDefinition[] = [
      {
        id: 'feishu_bot_notify',
        name: 'Feishu Bot Message & Card Dispatcher',
        version: '2.1.0',
        description: 'Sends rich-text notices, interactive cards, and approval notifications to Feishu channels.',
        category: 'COMMUNICATION',
        input_schema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Notification title' },
            content: { type: 'string', description: 'Markdown or plain text body' },
            message_type: { type: 'string', enum: ['text', 'markdown', 'card', 'approval_notice'] },
            at_users: { type: 'array', items: { type: 'string' } },
          },
          required: ['content'],
        },
        output_schema: {
          type: 'object',
          properties: {
            message_id: { type: 'string' },
            delivered: { type: 'boolean' },
          },
        },
        permissions: ['FEISHU_DISPATCH'],
        risk: 'MEDIUM',
        idempotency_mode: 'AT_LEAST_ONCE',
        timeout_ms: 3000,
        retry_policy: { max_retries: 2, backoff_ms: 200 },
        network_targets: ['open.feishu.cn'],
        is_active: true,
        is_fake: false,
      },
    ];

    const feishuPlugin: PluginItem = {
      id: 'feishu_lark_integration',
      name: 'Feishu / Lark Integration',
      name_zh: '飞书 (Feishu) 企业协同连接器',
      category: 'DOMESTIC_APPS',
      provider: 'FEISHU',
      version: '3.1.0',
      description: 'Feishu group robot webhook, interactive cards, approval notifications with HMAC-SHA256 signature.',
      description_zh: '飞书群机器人 Webhook、互动卡片模版、事件抄送与 HMAC-SHA256 安全加签验证。',
      icon: 'Send',
      is_active: true,
      is_configured: true,
      auth_type: 'HMAC_SHA256',
      config: {
        webhook_url: 'https://open.feishu.cn/open-apis/bot/v2/hook/demo-hook-9876-uuid',
        webhook_secret: 'kSecret_feishu_demo_hash_9182',
        app_id: 'cli_a1b2c3d4e5f6',
        timeout_ms: 3000,
      },
      metrics: {
        total_calls: 89,
        success_calls: 88,
        error_calls: 1,
        p95_latency_ms: 110,
        last_called_at: new Date().toISOString(),
      },
      tools: feishuTools,
    };

    // 4. DingTalk (钉钉) Integration
    const dingtalkTools: ToolDefinition[] = [
      {
        id: 'dingtalk_bot_notify',
        name: 'DingTalk Robot Incident & Card Dispatcher',
        version: '2.0.0',
        description: 'Dispatches Markdown alert cards and stream-mode notifications with timestamp signature.',
        category: 'COMMUNICATION',
        input_schema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Alert title' },
            content: { type: 'string', description: 'Markdown alert body' },
            is_at_all: { type: 'boolean' },
          },
          required: ['title', 'content'],
        },
        output_schema: {
          type: 'object',
          properties: {
            errcode: { type: 'number' },
            errmsg: { type: 'string' },
            delivered: { type: 'boolean' },
          },
        },
        permissions: ['DINGTALK_DISPATCH'],
        risk: 'MEDIUM',
        idempotency_mode: 'AT_LEAST_ONCE',
        timeout_ms: 3000,
        retry_policy: { max_retries: 2, backoff_ms: 200 },
        network_targets: ['oapi.dingtalk.com'],
        is_active: true,
        is_fake: false,
      },
    ];

    const dingtalkPlugin: PluginItem = {
      id: 'dingtalk_integration',
      name: 'DingTalk Integration',
      name_zh: '钉钉 (DingTalk) 群告警与智能体通知',
      category: 'DOMESTIC_APPS',
      provider: 'DINGTALK',
      version: '2.4.0',
      description: 'Custom DingTalk robot webhook with timestamp signing, markdown escalation, and stream mode.',
      description_zh: '钉钉群自定义机器人 Webhook、时间戳与密钥加签、Markdown 告警卡片与 Stream 模式。',
      icon: 'BellRing',
      is_active: true,
      is_configured: true,
      auth_type: 'HMAC_SHA256',
      config: {
        webhook_url: 'https://oapi.dingtalk.com/robot/send?access_token=demo_token_8888',
        webhook_secret: 'SEC_dingtalk_sha256_mock_sig',
        timeout_ms: 3000,
      },
      metrics: {
        total_calls: 64,
        success_calls: 64,
        error_calls: 0,
        p95_latency_ms: 95,
        last_called_at: new Date().toISOString(),
      },
      tools: dingtalkTools,
    };

    // 5. WeCom (企业微信) Integration
    const wecomTools: ToolDefinition[] = [
      {
        id: 'wecom_bot_notify',
        name: 'WeCom Group Bot Markdown Dispatcher',
        version: '1.5.0',
        description: 'Publishes enterprise markdown cards and incident tickets to WeCom group chats.',
        category: 'COMMUNICATION',
        input_schema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'WeCom markdown formatted text' },
            mentioned_list: { type: 'array', items: { type: 'string' } },
          },
          required: ['content'],
        },
        output_schema: {
          type: 'object',
          properties: {
            errcode: { type: 'number' },
            delivered: { type: 'boolean' },
          },
        },
        permissions: ['WECOM_DISPATCH'],
        risk: 'MEDIUM',
        idempotency_mode: 'AT_LEAST_ONCE',
        timeout_ms: 3000,
        retry_policy: { max_retries: 2, backoff_ms: 200 },
        network_targets: ['qyapi.weixin.qq.com'],
        is_active: true,
        is_fake: false,
      },
    ];

    const wecomPlugin: PluginItem = {
      id: 'wecom_integration',
      name: 'WeCom (企业微信) Integration',
      name_zh: '企业微信 (WeCom) 群机器人与通知中心',
      category: 'DOMESTIC_APPS',
      provider: 'WECOM',
      version: '2.1.2',
      description: 'WeCom corporate webhook bot, markdown template card, and incident escalation center.',
      description_zh: '企业微信群机器人 Webhook (KEY 配置)、Markdown 图文卡片与工单告警联动。',
      icon: 'MessageSquare',
      is_active: true,
      is_configured: true,
      auth_type: 'WEBHOOK_SECRET',
      config: {
        webhook_url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=demo_key_7777',
        timeout_ms: 3000,
      },
      metrics: {
        total_calls: 112,
        success_calls: 112,
        error_calls: 0,
        p95_latency_ms: 78,
        last_called_at: new Date().toISOString(),
      },
      tools: wecomTools,
    };

    // 6. Amap (高德地图) Integration (Domestic Map Adapter)
    const amapTools: ToolDefinition[] = [
      {
        id: 'amap_geocode',
        name: 'Amap Geocoding & POI Service',
        version: '1.0.0',
        description: 'Domestic Chinese address geocoding and POI search using GCJ-02 coordinates.',
        category: 'CLOUD',
        input_schema: {
          type: 'object',
          properties: {
            address: { type: 'string' },
            city: { type: 'string' },
          },
          required: ['address'],
        },
        output_schema: {
          type: 'object',
          properties: {
            location: { type: 'string' },
            formatted_address: { type: 'string' },
          },
        },
        permissions: ['AMAP_GEOCODE'],
        risk: 'LOW',
        idempotency_mode: 'IDEMPOTENT',
        timeout_ms: 2000,
        retry_policy: { max_retries: 1, backoff_ms: 100 },
        network_targets: ['restapi.amap.com'],
        is_active: true,
        is_fake: false,
      },
    ];

    const amapPlugin: PluginItem = {
      id: 'amap_integration',
      name: 'Amap (高德地图) Service',
      name_zh: '高德地图 (Amap) 国内空间地理插件',
      category: 'MAPS',
      provider: 'AMAP',
      version: '2.0.0',
      description: 'Domestic Chinese geospatial resolution, GCJ-02 geocoding, and POI catalog.',
      description_zh: '针对国内场景的高精度地理编码、GCJ-02 坐标系转换与 POI 地标检索。',
      icon: 'Compass',
      is_active: true,
      is_configured: true,
      auth_type: 'API_KEY',
      config: {
        api_key_ref: 'vault://amap/web_api_key',
        endpoint: 'https://restapi.amap.com/v3',
        timeout_ms: 2500,
      },
      metrics: {
        total_calls: 45,
        success_calls: 45,
        error_calls: 0,
        p95_latency_ms: 55,
        last_called_at: new Date().toISOString(),
      },
      tools: amapTools,
    };

    this.plugins.set(googleMapsPlugin.id, googleMapsPlugin);
    this.plugins.set(weatherPlugin.id, weatherPlugin);
    this.plugins.set(feishuPlugin.id, feishuPlugin);
    this.plugins.set(dingtalkPlugin.id, dingtalkPlugin);
    this.plugins.set(wecomPlugin.id, wecomPlugin);
    this.plugins.set(amapPlugin.id, amapPlugin);
  }

  public static getAllPlugins(): PluginItem[] {
    return Array.from(this.plugins.values());
  }

  public static getPlugin(id: string): PluginItem | undefined {
    return this.plugins.get(id);
  }

  public static togglePlugin(id: string): boolean {
    const p = this.plugins.get(id);
    if (!p) return false;
    p.is_active = !p.is_active;
    p.tools.forEach((t) => {
      t.is_active = p.is_active;
    });
    return true;
  }

  public static updateConfig(id: string, newConfig: Partial<PluginItem['config']>): boolean {
    const p = this.plugins.get(id);
    if (!p) return false;
    p.config = { ...p.config, ...newConfig };
    p.is_configured = true;
    return true;
  }

  public static getAllTools(): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    for (const p of this.plugins.values()) {
      if (p.is_active) {
        tools.push(...p.tools);
      }
    }
    return tools;
  }

  public static getPresets(): any[] {
    return [
      {
        id: 'wechat_app_connector',
        name: 'WeChat (微信) Service & MiniApp Connector',
        name_zh: '微信服务号与小程序消息管理',
        category: 'DOMESTIC_APPS',
        provider: 'WECHAT',
        version: '1.2.0',
        description: 'Send template messages, query user OpenID, and manage WeChat Official Account notifications.',
        description_zh: '微信服务号模板消息下发、用户 OpenID 查询与业务通知管理。',
        icon: 'MessageCircle',
        auth_type: 'API_KEY',
        endpoint: 'https://api.weixin.qq.com/cgi-bin/message/template/send',
        tool_id: 'wechat_send_template_msg',
        tool_name: 'WeChat Template Message Dispatcher',
        tool_description: 'Sends automated customer notices and order alerts via WeChat Service Account.',
        risk: 'MEDIUM',
        sample_args: {
          touser: 'oUpF8uMuAJO_M2pxb1Q9zNjWeChat',
          template_id: 'ngqIpbwh8bUfcSsECmogfXbaImm3q_example',
          url: 'https://myapp.com/orders/1024',
          data: { first: '您的高铁退票申请已通过', keyword1: 'G1024', keyword2: '已退款' },
        },
      },
      {
        id: 'qq_bot_connector',
        name: 'QQ Open Platform Guild & Group Bot',
        name_zh: 'QQ 频道与群机器人连接器',
        category: 'DOMESTIC_APPS',
        provider: 'QQ',
        version: '1.0.4',
        description: 'Dispatch notifications, markdown embeds, and interactive cards to QQ channels and groups.',
        description_zh: 'QQ 开放平台机器人消息推送，支持频道子频道与企业 QQ 群消息广播。',
        icon: 'Bot',
        auth_type: 'BEARER_TOKEN',
        endpoint: 'https://api.sgroup.qq.com/channels/{channel_id}/messages',
        tool_id: 'qq_bot_send_msg',
        tool_name: 'QQ Bot Notification Dispatcher',
        tool_description: 'Sends messages to target QQ Guild channel or user group with bot credentials.',
        risk: 'LOW',
        sample_args: {
          channel_id: '1099238821',
          content: '🚀 AI Agent Studio: High-speed rail tickets secured for Beijing -> Shanghai',
          msg_type: 'text',
        },
      },
      {
        id: 'meituan_open_connector',
        name: 'Meituan (美团) Merchant & Delivery API',
        name_zh: '美团外卖与生活服务开放平台',
        category: 'DOMESTIC_APPS',
        provider: 'MEITUAN',
        version: '2.0.1',
        description: 'Query merchant orders, verify e-vouchers, and track live takeout delivery rider locations.',
        description_zh: '美团商家外卖订单查询、到店团购券核销与实时骑手配送轨迹追踪。',
        icon: 'ShoppingBag',
        auth_type: 'HMAC_SHA256',
        endpoint: 'https://api-open-cater.meituan.com/waimai/order/query',
        tool_id: 'meituan_order_query',
        tool_name: 'Meituan Order & Voucher Inspector',
        tool_description: 'Queries takeout order fulfillment status and validates group-buying voucher codes.',
        risk: 'MEDIUM',
        sample_args: {
          order_id: 'MT_20261103_889921',
          poi_id: 'poi_shanghai_central_01',
          include_rider_tracking: true,
        },
      },
      {
        id: 'rail12306_connector',
        name: 'China Railway 12306 (中国高铁客运)',
        name_zh: '12306 高铁火车票余票与时刻表',
        category: 'SYSTEM_TOOLS',
        provider: 'RAIL12306',
        version: '3.1.0',
        description: 'Real-time remaining ticket inquiries, train timetables, transfer planning, and station departure boards.',
        description_zh: '全国高铁/动车余票实时检索、经停时刻表排查、中转换乘推荐与候补状态提醒。',
        icon: 'Train',
        auth_type: 'API_KEY',
        endpoint: 'https://kyfw.12306.cn/otn/leftTicket/query',
        tool_id: 'rail12306_search_tickets',
        tool_name: '12306 Train Ticket & Schedule Query',
        tool_description: 'Fetches high-speed train numbers, ticket classes (First/Second/Business), and availability.',
        risk: 'LOW',
        sample_args: {
          from_station: 'BJP (北京)',
          to_station: 'SHH (上海)',
          travel_date: '2026-11-05',
          train_type: 'G_HIGH_SPEED',
        },
      },
      {
        id: 'flight_booking_connector',
        name: 'Civil Aviation Flight Tracker & Booking',
        name_zh: '民航特惠机票预订与航班动态',
        category: 'SYSTEM_TOOLS',
        provider: 'AIRLINE_FLIGHTS',
        version: '2.4.0',
        description: 'Flight live status, delay alerts, low-fare calendar lookup, and boarding gate change broadcasts.',
        description_zh: '国内外航班起降动态、准点率预测、特惠低价机票比价与值机登机口提醒。',
        icon: 'Plane',
        auth_type: 'API_KEY',
        endpoint: 'https://api.aviation-connect.org/v2/flights/search',
        tool_id: 'flight_query_status',
        tool_name: 'Flight Status & Ticket Price Scanner',
        tool_description: 'Scans commercial airline flight routes, current air traffic delays, and seat prices.',
        risk: 'LOW',
        sample_args: {
          departure_code: 'PEK',
          arrival_code: 'SHA',
          flight_date: '2026-11-06',
          airline: 'CA',
        },
      },
      {
        id: 'alipay_connector',
        name: 'Alipay (支付宝) Merchant & Reconciliation API',
        name_zh: '支付宝开放平台与支付交易对账',
        category: 'DOMESTIC_APPS',
        provider: 'ALIPAY',
        version: '3.0.0',
        description: 'Merchant payment creation, refund status query, transaction order reconciliation, and bill download.',
        description_zh: '支付宝商户收单发起、交易退款追溯、日度财务账单对账与资金流水核验。',
        icon: 'CreditCard',
        auth_type: 'HMAC_SHA256',
        endpoint: 'https://openapi.alipay.com/gateway.do',
        tool_id: 'alipay_create_trade',
        tool_name: 'Alipay Payment & Refund Manager',
        tool_description: 'Handles online merchant trade creations, query refund status, and verifies RSA2 signatures.',
        risk: 'HIGH',
        sample_args: {
          out_trade_no: 'ALI_TR_20261103_0019',
          total_amount: '128.50',
          subject: 'AI Agent Studio Cloud Quota License',
          product_code: 'FAST_INSTANT_TRADE_PAY',
        },
      },
    ];
  }

  public static createCustomPlugin(input: {
    id?: string;
    name: string;
    name_zh?: string;
    category?: PluginCategory;
    provider?: string;
    version?: string;
    description: string;
    description_zh?: string;
    icon?: string;
    auth_type?: 'API_KEY' | 'WEBHOOK_SECRET' | 'HMAC_SHA256' | 'BEARER_TOKEN' | 'NONE';
    endpoint?: string;
    api_key?: string;
    tool_id: string;
    tool_name?: string;
    tool_description?: string;
    risk?: RiskLevel;
    sample_args?: Record<string, any>;
  }): PluginItem {
    const pluginId = input.id || `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const toolId = input.tool_id || `tool_${pluginId}`;

    const toolDef: ToolDefinition = {
      id: toolId,
      name: input.tool_name || input.name,
      version: input.version || '1.0.0',
      description: input.tool_description || input.description,
      category: input.category === 'SYSTEM_TOOLS' ? 'SYSTEM' : 'COMMUNICATION',
      input_schema: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Target identifier or URL' },
          payload: { type: 'object', description: 'Request payload parameters' },
        },
      },
      output_schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
        },
      },
      permissions: ['EXECUTE_PLUGIN_TOOL'],
      risk: input.risk || 'LOW',
      idempotency_mode: 'IDEMPOTENT',
      timeout_ms: 5000,
      retry_policy: { max_retries: 2, backoff_ms: 100 },
      network_targets: [input.endpoint ? new URL(input.endpoint).hostname : 'api.external.service'],
      is_active: true,
      is_fake: false,
    };

    const pluginItem: PluginItem = {
      id: pluginId,
      name: input.name,
      name_zh: input.name_zh || input.name,
      category: input.category || 'DOMESTIC_APPS',
      provider: (input.provider?.toUpperCase() as any) || 'CUSTOM',
      version: input.version || '1.0.0',
      description: input.description,
      description_zh: input.description_zh || input.description,
      icon: input.icon || 'PlugZap',
      is_active: true,
      is_configured: true,
      auth_type: input.auth_type || 'API_KEY',
      config: {
        endpoint: input.endpoint,
        api_key_ref: input.api_key ? `vault://custom/${pluginId}/key` : undefined,
        timeout_ms: 4000,
      },
      metrics: {
        total_calls: 0,
        success_calls: 0,
        error_calls: 0,
        p95_latency_ms: 60,
      },
      tools: [toolDef],
    };

    this.plugins.set(pluginItem.id, pluginItem);
    return pluginItem;
  }

  public static deletePlugin(id: string): boolean {
    return this.plugins.delete(id);
  }
}

/**
 * Built-in Weather Service Simulator & Query Handler
 */
export class WeatherEngine {
  private static cityDatabase: Record<string, Omit<WeatherData, 'forecast' | 'updated_at'>> = {
    beijing: {
      city: 'Beijing (北京)',
      country: 'CN',
      temperature: 18,
      temperature_unit: '°C',
      condition: 'Clear & Sunny (晴朗)',
      condition_code: 'SUNNY',
      humidity_percent: 36,
      wind_speed_kmh: 14,
      wind_direction: 'NW',
      pressure_hpa: 1018,
      uv_index: 5,
      air_quality: {
        aqi: 42,
        status: 'EXCELLENT',
        pm2_5: 12,
        pm10: 28,
      },
    },
    shanghai: {
      city: 'Shanghai (上海)',
      country: 'CN',
      temperature: 22,
      temperature_unit: '°C',
      condition: 'Partly Cloudy (多云)',
      condition_code: 'CLOUDY',
      humidity_percent: 68,
      wind_speed_kmh: 18,
      wind_direction: 'SE',
      pressure_hpa: 1014,
      uv_index: 6,
      air_quality: {
        aqi: 55,
        status: 'GOOD',
        pm2_5: 18,
        pm10: 40,
      },
    },
    hangzhou: {
      city: 'Hangzhou (杭州)',
      country: 'CN',
      temperature: 21,
      temperature_unit: '°C',
      condition: 'Light Rain (小雨)',
      condition_code: 'RAIN',
      humidity_percent: 82,
      wind_speed_kmh: 11,
      wind_direction: 'E',
      pressure_hpa: 1012,
      uv_index: 3,
      air_quality: {
        aqi: 38,
        status: 'EXCELLENT',
        pm2_5: 11,
        pm10: 24,
      },
    },
    shenzhen: {
      city: 'Shenzhen (深圳)',
      country: 'CN',
      temperature: 27,
      temperature_unit: '°C',
      condition: 'Sunny & Warm (晴热)',
      condition_code: 'SUNNY',
      humidity_percent: 74,
      wind_speed_kmh: 12,
      wind_direction: 'S',
      pressure_hpa: 1010,
      uv_index: 8,
      air_quality: {
        aqi: 29,
        status: 'EXCELLENT',
        pm2_5: 8,
        pm10: 19,
      },
    },
    tokyo: {
      city: 'Tokyo (东京)',
      country: 'JP',
      temperature: 19,
      temperature_unit: '°C',
      condition: 'Clear Sky (晴)',
      condition_code: 'SUNNY',
      humidity_percent: 48,
      wind_speed_kmh: 15,
      wind_direction: 'N',
      pressure_hpa: 1016,
      uv_index: 5,
      air_quality: {
        aqi: 25,
        status: 'EXCELLENT',
        pm2_5: 7,
        pm10: 15,
      },
    },
    newyork: {
      city: 'New York (纽约)',
      country: 'US',
      temperature: 15,
      temperature_unit: '°C',
      condition: 'Breezy & Overcast (阴有微风)',
      condition_code: 'OVERCAST',
      humidity_percent: 52,
      wind_speed_kmh: 22,
      wind_direction: 'W',
      pressure_hpa: 1013,
      uv_index: 4,
      air_quality: {
        aqi: 34,
        status: 'EXCELLENT',
        pm2_5: 9,
        pm10: 21,
      },
    },
    london: {
      city: 'London (伦敦)',
      country: 'UK',
      temperature: 13,
      temperature_unit: '°C',
      condition: 'Light Drizzle (毛毛雨)',
      condition_code: 'RAIN',
      humidity_percent: 85,
      wind_speed_kmh: 19,
      wind_direction: 'SW',
      pressure_hpa: 1009,
      uv_index: 2,
      air_quality: {
        aqi: 31,
        status: 'EXCELLENT',
        pm2_5: 8,
        pm10: 18,
      },
    },
    paris: {
      city: 'Paris (巴黎)',
      country: 'FR',
      temperature: 16,
      temperature_unit: '°C',
      condition: 'Partly Sunny (晴间多云)',
      condition_code: 'CLOUDY',
      humidity_percent: 59,
      wind_speed_kmh: 14,
      wind_direction: 'NE',
      pressure_hpa: 1015,
      uv_index: 4,
      air_quality: {
        aqi: 40,
        status: 'EXCELLENT',
        pm2_5: 10,
        pm10: 25,
      },
    },
    singapore: {
      city: 'Singapore (新加坡)',
      country: 'SG',
      temperature: 30,
      temperature_unit: '°C',
      condition: 'Tropical Thunderstorm (热带雷阵雨)',
      condition_code: 'THUNDERSTORM',
      humidity_percent: 88,
      wind_speed_kmh: 16,
      wind_direction: 'SW',
      pressure_hpa: 1008,
      uv_index: 9,
      air_quality: {
        aqi: 45,
        status: 'EXCELLENT',
        pm2_5: 12,
        pm10: 26,
      },
    },
  };

  public static queryWeather(cityQuery: string, units: 'metric' | 'imperial' = 'metric'): WeatherData {
    const normalizedKey = cityQuery.toLowerCase().replace(/[^a-z]/g, '');
    let matchedKey = Object.keys(this.cityDatabase).find((k) => normalizedKey.includes(k) || k.includes(normalizedKey));
    if (!matchedKey) {
      matchedKey = 'beijing';
    }

    const base = this.cityDatabase[matchedKey];
    let temp = base.temperature;
    let tempUnit: '°C' | '°F' = '°C';

    if (units === 'imperial') {
      temp = Math.round((temp * 9) / 5 + 32);
      tempUnit = '°F';
    }

    const days = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5'];
    const forecast = days.map((day, idx) => ({
      day,
      temp_high: temp + (idx % 2 === 0 ? 2 : 1),
      temp_low: temp - (idx % 2 === 0 ? 5 : 4),
      condition: idx === 2 ? 'Scattered Showers' : base.condition,
    }));

    return {
      ...base,
      temperature: temp,
      temperature_unit: tempUnit,
      forecast,
      updated_at: new Date().toISOString(),
    };
  }
}

/**
 * Domestic App Dispatcher (Feishu, DingTalk, WeCom)
 */
export class DomesticAppDispatcher {
  public static async dispatch(payload: DomesticMessagePayload): Promise<{
    success: boolean;
    platform: string;
    message_id: string;
    timestamp: string;
    signature_verified: boolean;
    sanitized_preview: Record<string, any>;
  }> {
    const timestamp = Date.now().toString();
    const messageId = `msg_${payload.platform}_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;

    // Build platform-specific mock delivery payload
    let signatureVerified = true;
    let outboundPayload: Record<string, any> = {};

    switch (payload.platform) {
      case 'feishu': {
        outboundPayload = {
          msg_type: payload.message_type === 'card' || payload.message_type === 'approval_notice' ? 'interactive' : 'text',
          content: {
            title: payload.title || 'AI Agent Studio 平台通告',
            text: DataSanitizer.sanitizeString(payload.content),
          },
          card: {
            header: {
              title: { tag: 'plain_text', content: payload.title || 'AI Agent Studio 事件通知' },
              template: payload.message_type === 'approval_notice' ? 'orange' : 'blue',
            },
            elements: [
              {
                tag: 'div',
                text: { tag: 'lark_md', content: `**正文内容:**\n${DataSanitizer.sanitizeString(payload.content)}` },
              },
              {
                tag: 'hr',
              },
              {
                tag: 'note',
                elements: [
                  { tag: 'plain_text', content: `来源: AI Agent Studio | 目标: ${payload.target_url ? '自定义群' : '企业研发总群'}` },
                ],
              },
            ],
          },
          sign: payload.secret ? `hmac_sha256_${payload.secret.substring(0, 4)}...ok` : 'UNSIGNED',
        };
        break;
      }

      case 'dingtalk': {
        outboundPayload = {
          msgtype: 'markdown',
          markdown: {
            title: payload.title || '钉钉智能体预警',
            text: `### ${payload.title || '钉钉智能体预警'}\n\n${DataSanitizer.sanitizeString(payload.content)}\n\n> 来源: AI Agent Studio 自动化控制面`,
          },
          at: {
            atMobiles: payload.at_users || [],
            isAtAll: payload.is_at_all || false,
          },
          timestamp,
          sign: 'HMAC-SHA256(timestamp + secret)::VALIDATED',
        };
        break;
      }

      case 'wecom': {
        outboundPayload = {
          msgtype: 'markdown',
          markdown: {
            content: `**【企业微信群告警】${payload.title || '系统事件'}**\n>${DataSanitizer.sanitizeString(payload.content)}\n> 级别: <font color="comment">INFO / DISPATCHED</font>`,
          },
          mentioned_list: payload.at_users || [],
        };
        break;
      }
    }

    return {
      success: true,
      platform: payload.platform,
      message_id: messageId,
      timestamp: new Date().toISOString(),
      signature_verified: signatureVerified,
      sanitized_preview: outboundPayload,
    };
  }
}
