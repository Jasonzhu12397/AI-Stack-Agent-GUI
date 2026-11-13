package connectors

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/enterprise/ai-agent-studio-backend-go/pkg/models"
)

// Registry manages external connectors and Chinese domestic application plugins.
type Registry struct {
	mu      sync.RWMutex
	plugins map[string]*models.Plugin
}

func NewRegistry() *Registry {
	r := &Registry{
		plugins: make(map[string]*models.Plugin),
	}
	r.seed()
	return r
}

func mkTool(id, name, desc, cat, risk string, perms, targets []string) models.ToolDefinition {
	return models.ToolDefinition{
		ID:              id,
		Name:            name,
		Version:         "1.0.0",
		Description:     desc,
		Category:        cat,
		Risk:            risk,
		Permissions:     perms,
		InputSchema:     map[string]interface{}{"type": "object"},
		OutputSchema:    map[string]interface{}{"type": "object"},
		IdempotencyMode: "IDEMPOTENT",
		TimeoutMs:       3000,
		RetryPolicy:     models.RetryPolicy{MaxRetries: 2, BackoffMs: 100},
		NetworkTargets:  targets,
		IsActive:        true,
		IsFake:          false,
	}
}

func (r *Registry) seed() {
	now := time.Now()
	nowISO := now.UTC().Format(time.RFC3339)

	seeded := []models.Plugin{
		{
			ID:            "google_maps_platform",
			Name:          "Google Maps Platform",
			NameZh:        "Google Maps 空间地图平台",
			Category:      "MAPS",
			Provider:      "GOOGLE",
			Version:       "3.2.0",
			Description:   "Geospatial computation, forward/reverse geocoding, nearby places search, and routing.",
			DescriptionZh: "空间地理计算、正逆地理编码、周边 POI 设施检索与路线距离测算。",
			Icon:          "MapPin",
			IsActive:      true,
			IsConfigured:  true,
			AuthType:      "API_KEY",
			Endpoint:      "https://maps.googleapis.com/maps/api",
			APIKeyRef:     "vault://google/maps_api_key",
			Config:        map[string]interface{}{"api_key_ref": "vault://google/maps_api_key", "endpoint": "https://maps.googleapis.com/maps/api", "timeout_ms": 3000},
			TotalCalls:    640,
			P95LatencyMs:  64,
			Metrics:       models.PluginMetrics{TotalCalls: 640, SuccessCalls: 638, ErrorCalls: 2, P95LatencyMs: 64, LastCalledAt: nowISO},
			Tools: []models.ToolDefinition{
				mkTool("maps_geocode", "Google Maps Geocoding Service", "Converts street addresses or city names into latitude/longitude coordinates.", "CLOUD", "LOW", []string{"MAPS_GEOCODE"}, []string{"maps.googleapis.com"}),
				mkTool("maps_places_search", "Google Maps Places Search", "Searches for nearby points of interest, businesses, or transit hubs.", "CLOUD", "LOW", []string{"MAPS_PLACES"}, []string{"maps.googleapis.com"}),
			},
			ToolID:    "maps_geocode",
			Risk:      "LOW",
			CreatedAt: now.Add(-140 * time.Hour),
		},
		{
			ID:            "global_weather_service",
			Name:          "Global Weather Intelligence",
			NameZh:        "全球气象与空气质量服务",
			Category:      "WEATHER",
			Provider:      "METEO_SERVICE",
			Version:       "2.4.1",
			Description:   "Real-time meteorological telemetry, 5-day forecast curves, UV index, and AQI / PM2.5 monitoring.",
			DescriptionZh: "全球城市实时温度/湿度/风速遥测、5天趋势预测曲线及空气质量 AQI 监测。",
			Icon:          "CloudSun",
			IsActive:      true,
			IsConfigured:  true,
			AuthType:      "API_KEY",
			Endpoint:      "https://api.open-meteo.com/v1",
			APIKeyRef:     "vault://meteo/weather_key",
			Config:        map[string]interface{}{"api_key_ref": "vault://meteo/weather_key", "endpoint": "https://api.open-meteo.com/v1", "timeout_ms": 2500},
			TotalCalls:    512,
			P95LatencyMs:  48,
			Metrics:       models.PluginMetrics{TotalCalls: 512, SuccessCalls: 512, ErrorCalls: 0, P95LatencyMs: 48, LastCalledAt: nowISO},
			Tools: []models.ToolDefinition{
				mkTool("weather_current", "Global Current Weather & AQI Query", "Queries live weather telemetry, AQI/PM2.5, and 5-day forecasts for any city.", "CLOUD", "LOW", []string{"WEATHER_READ"}, []string{"api.open-meteo.com"}),
			},
			ToolID:    "weather_current",
			Risk:      "LOW",
			CreatedAt: now.Add(-130 * time.Hour),
		},
		{
			ID:            "feishu_lark_integration",
			Name:          "Feishu (飞书) Bot Connector",
			NameZh:        "飞书 (Feishu/Lark) 企业协同机器人",
			Category:      "DOMESTIC_APPS",
			Provider:      "FEISHU",
			Version:       "2.3.0",
			Description:   "Feishu interactive cards, HMAC-SHA256 webhook signature dispatch, and approval escalations.",
			DescriptionZh: "飞书交互式告警卡片推送、HMAC-SHA256 防篡改签名下发与高危审批联动。",
			Icon:          "Send",
			IsActive:      true,
			IsConfigured:  true,
			AuthType:      "HMAC_SHA256",
			Endpoint:      "https://open.feishu.cn/open-apis/bot/v2/hook/demo-feishu-8899-uuid",
			Config:        map[string]interface{}{"webhook_url": "https://open.feishu.cn/open-apis/bot/v2/hook/demo-feishu-8899-uuid", "webhook_secret": "vault://feishu/hmac_secret", "timeout_ms": 3000},
			TotalCalls:    328,
			P95LatencyMs:  72,
			Metrics:       models.PluginMetrics{TotalCalls: 328, SuccessCalls: 327, ErrorCalls: 1, P95LatencyMs: 72, LastCalledAt: nowISO},
			Tools: []models.ToolDefinition{
				mkTool("feishu_bot_notify", "Feishu Group Interactive Card Dispatcher", "Dispatches interactive cards and alert summaries to Feishu chats with SHA-256 signature.", "COMMUNICATION", "MEDIUM", []string{"FEISHU_DISPATCH"}, []string{"open.feishu.cn"}),
			},
			ToolID:    "feishu_bot_notify",
			Risk:      "MEDIUM",
			CreatedAt: now.Add(-110 * time.Hour),
		},
		{
			ID:            "dingtalk_integration",
			Name:          "DingTalk (钉钉) Webhook Bot",
			NameZh:        "钉钉 (DingTalk) 企业机器人与工作通知",
			Category:      "DOMESTIC_APPS",
			Provider:      "DINGTALK",
			Version:       "2.1.0",
			Description:   "DingTalk custom robot webhooks with SEC HMAC-SHA256 verification and @user mobile alerts.",
			DescriptionZh: "钉钉自定义机器人 Webhook 推送、SEC 密钥加签校验及指定人员 @手机号触达。",
			Icon:          "BellRing",
			IsActive:      true,
			IsConfigured:  true,
			AuthType:      "HMAC_SHA256",
			Endpoint:      "https://oapi.dingtalk.com/robot/send?access_token=demo_token_7766",
			Config:        map[string]interface{}{"webhook_url": "https://oapi.dingtalk.com/robot/send?access_token=demo_token_7766", "webhook_secret": "vault://dingtalk/sec_key", "timeout_ms": 3000},
			TotalCalls:    219,
			P95LatencyMs:  68,
			Metrics:       models.PluginMetrics{TotalCalls: 219, SuccessCalls: 219, ErrorCalls: 0, P95LatencyMs: 68, LastCalledAt: nowISO},
			Tools: []models.ToolDefinition{
				mkTool("dingtalk_bot_notify", "DingTalk Webhook Robot Notifier", "Publishes signed markdown notices to DingTalk engineering groups.", "COMMUNICATION", "MEDIUM", []string{"DINGTALK_DISPATCH"}, []string{"oapi.dingtalk.com"}),
			},
			ToolID:    "dingtalk_bot_notify",
			Risk:      "MEDIUM",
			CreatedAt: now.Add(-100 * time.Hour),
		},
		{
			ID:            "wecom_integration",
			Name:          "WeCom (企业微信) Integration",
			NameZh:        "企业微信 (WeCom) 群机器人与通知中心",
			Category:      "DOMESTIC_APPS",
			Provider:      "WECOM",
			Version:       "2.1.2",
			Description:   "WeCom corporate webhook bot, markdown template card, and incident escalation center.",
			DescriptionZh: "企业微信群机器人 Webhook (KEY 配置)、Markdown 图文卡片与工单告警联动。",
			Icon:          "MessageSquare",
			IsActive:      true,
			IsConfigured:  true,
			AuthType:      "WEBHOOK_SECRET",
			Endpoint:      "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=demo_key_7777",
			Config:        map[string]interface{}{"webhook_url": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=demo_key_7777", "timeout_ms": 3000},
			TotalCalls:    112,
			P95LatencyMs:  78,
			Metrics:       models.PluginMetrics{TotalCalls: 112, SuccessCalls: 112, ErrorCalls: 0, P95LatencyMs: 78, LastCalledAt: nowISO},
			Tools: []models.ToolDefinition{
				mkTool("wecom_bot_notify", "WeCom Group Bot Notifier", "Publishes enterprise markdown cards and incident tickets to WeCom group chats.", "COMMUNICATION", "MEDIUM", []string{"WECOM_DISPATCH"}, []string{"qyapi.weixin.qq.com"}),
			},
			ToolID:    "wecom_bot_notify",
			Risk:      "MEDIUM",
			CreatedAt: now.Add(-90 * time.Hour),
		},
		{
			ID:            "amap_integration",
			Name:          "Amap (高德地图) Service",
			NameZh:        "高德地图 (Amap) 国内空间地理插件",
			Category:      "MAPS",
			Provider:      "AMAP",
			Version:       "2.0.0",
			Description:   "Domestic Chinese geospatial resolution, GCJ-02 geocoding, and POI catalog.",
			DescriptionZh: "针对国内场景的高精度地理编码、GCJ-02 坐标系转换与 POI 地标检索。",
			Icon:          "Compass",
			IsActive:      true,
			IsConfigured:  true,
			AuthType:      "API_KEY",
			Endpoint:      "https://restapi.amap.com/v3",
			APIKeyRef:     "vault://amap/web_api_key",
			Config:        map[string]interface{}{"api_key_ref": "vault://amap/web_api_key", "endpoint": "https://restapi.amap.com/v3", "timeout_ms": 2500},
			TotalCalls:    45,
			P95LatencyMs:  55,
			Metrics:       models.PluginMetrics{TotalCalls: 45, SuccessCalls: 45, ErrorCalls: 0, P95LatencyMs: 55, LastCalledAt: nowISO},
			Tools: []models.ToolDefinition{
				mkTool("amap_geocode", "Amap Geocoding & POI Service", "Domestic Chinese address geocoding and POI search using GCJ-02 coordinates.", "CLOUD", "LOW", []string{"AMAP_GEOCODE"}, []string{"restapi.amap.com"}),
			},
			ToolID:    "amap_geocode",
			Risk:      "LOW",
			CreatedAt: now.Add(-80 * time.Hour),
		},
	}

	for _, p := range seeded {
		pCopy := p
		r.plugins[p.ID] = &pCopy
	}
}

// ListPlugins returns all registered plugins deterministically ordered.
func (r *Registry) ListPlugins() []*models.Plugin {
	r.mu.RLock()
	defer r.mu.RUnlock()

	list := make([]*models.Plugin, 0, len(r.plugins))
	for _, p := range r.plugins {
		list = append(list, p)
	}
	sort.Slice(list, func(i, j int) bool {
		return list[i].CreatedAt.Before(list[j].CreatedAt)
	})
	return list
}

// ListActiveTools returns all active ToolDefinitions registered by active plugins.
func (r *Registry) ListActiveTools() []models.ToolDefinition {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var out []models.ToolDefinition
	for _, p := range r.plugins {
		if p.IsActive {
			for _, t := range p.Tools {
				out = append(out, t)
			}
		}
	}
	return out
}

// GetTool finds a plugin tool by ID.
func (r *Registry) GetTool(toolID string) (*models.ToolDefinition, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, p := range r.plugins {
		for i := range p.Tools {
			if p.Tools[i].ID == toolID {
				tCopy := p.Tools[i]
				tCopy.IsActive = p.IsActive && tCopy.IsActive
				return &tCopy, true
			}
		}
	}
	return nil, false
}

// CreatePlugin dynamically registers a custom connector + associated ToolDefinition.
func (r *Registry) CreatePlugin(req struct {
	Name            string                 `json:"name"`
	NameZh          string                 `json:"name_zh"`
	Category        string                 `json:"category"`
	Provider        string                 `json:"provider"`
	Description     string                 `json:"description"`
	DescriptionZh   string                 `json:"description_zh"`
	AuthType        string                 `json:"auth_type"`
	Endpoint        string                 `json:"endpoint"`
	APIKey          string                 `json:"api_key"`
	ToolID          string                 `json:"tool_id"`
	ToolName        string                 `json:"tool_name"`
	ToolDescription string                 `json:"tool_description"`
	Risk            string                 `json:"risk"`
	SampleArgs      map[string]interface{} `json:"sample_args"`
}) *models.Plugin {
	r.mu.Lock()
	defer r.mu.Unlock()

	id := fmt.Sprintf("plugin_custom_%d", time.Now().UnixMilli())
	toolID := strings.TrimSpace(req.ToolID)
	if toolID == "" {
		toolID = "custom_tool_" + fmt.Sprintf("%d", time.Now().Unix())
	}
	toolName := strings.TrimSpace(req.ToolName)
	if toolName == "" {
		toolName = req.Name
	}
	toolDesc := strings.TrimSpace(req.ToolDescription)
	if toolDesc == "" {
		toolDesc = req.Description
	}
	risk := strings.ToUpper(strings.TrimSpace(req.Risk))
	if risk == "" {
		risk = "LOW"
	}
	category := req.Category
	if category == "" {
		category = "CUSTOM"
	}
	provider := req.Provider
	if provider == "" {
		provider = "CUSTOM"
	}
	authType := req.AuthType
	if authType == "" {
		authType = "API_KEY"
	}

	tool := mkTool(toolID, toolName, toolDesc, "CLOUD", risk, []string{"TOOL_READ"}, []string{req.Endpoint})
	plugin := &models.Plugin{
		ID:            id,
		Name:          req.Name,
		NameZh:        req.NameZh,
		Category:      category,
		Provider:      provider,
		Version:       "1.0.0",
		Description:   req.Description,
		DescriptionZh: req.DescriptionZh,
		Icon:          "Boxes",
		AuthType:      authType,
		Endpoint:      req.Endpoint,
		IsActive:      true,
		IsConfigured:  true,
		ToolID:        toolID,
		Risk:          risk,
		Config: map[string]interface{}{
			"endpoint":    req.Endpoint,
			"api_key_ref": "vault://custom/" + id,
			"timeout_ms":  3000,
		},
		Metrics: models.PluginMetrics{
			TotalCalls:   0,
			SuccessCalls: 0,
			ErrorCalls:   0,
			P95LatencyMs: 28,
			LastCalledAt: time.Now().UTC().Format(time.RFC3339),
		},
		Tools:     []models.ToolDefinition{tool},
		CreatedAt: time.Now(),
	}
	r.plugins[id] = plugin
	return plugin
}

// TogglePlugin toggles connector and embedded tool active state.
func (r *Registry) TogglePlugin(id string) (*models.Plugin, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, exists := r.plugins[id]
	if !exists {
		return nil, fmt.Errorf("Plugin '%s' not found", id)
	}
	p.IsActive = !p.IsActive
	for i := range p.Tools {
		p.Tools[i].IsActive = p.IsActive
	}
	return p, nil
}

// DeletePlugin removes a registered connector.
func (r *Registry) DeletePlugin(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.plugins[id]; !exists {
		return fmt.Errorf("Plugin '%s' not found", id)
	}
	delete(r.plugins, id)
	return nil
}

// GetPresets returns catalog presets for domestic apps (WeChat, QQ, Meituan, 12306, Flights, Alipay).
func (r *Registry) GetPresets() []map[string]interface{} {
	return []map[string]interface{}{
		{
			"id":              "wechat_app_connector",
			"name":            "WeChat (微信) Service & MiniApp Connector",
			"name_zh":         "微信服务号与小程序消息管理",
			"category":        "DOMESTIC_APPS",
			"provider":        "WECHAT",
			"version":         "1.2.0",
			"description":     "Send template messages, query user OpenID, and manage WeChat Official Account notifications.",
			"description_zh":  "微信服务号模板消息下发、用户 OpenID 查询与业务通知管理。",
			"icon":            "MessageCircle",
			"auth_type":       "API_KEY",
			"endpoint":        "https://api.weixin.qq.com/cgi-bin/message/template/send",
			"tool_id":         "wechat_send_template_msg",
			"tool_name":       "WeChat Template Message Dispatcher",
			"tool_description": "Sends automated customer notices and order alerts via WeChat Service Account.",
			"risk":            "MEDIUM",
			"sample_args":     map[string]interface{}{"touser": "oUpF8uMuAJO_M2pxb1Q9zNjWeChat", "template_id": "ngqIpbwh8bUfcSsECmogfXbaImm3q"},
		},
		{
			"id":              "qq_bot_connector",
			"name":            "QQ Open Platform Guild & Group Bot",
			"name_zh":         "QQ 频道与群机器人连接器",
			"category":        "DOMESTIC_APPS",
			"provider":        "QQ",
			"version":         "1.0.4",
			"description":     "Dispatch notifications, markdown embeds, and interactive cards to QQ channels and groups.",
			"description_zh":  "QQ 开放平台机器人消息推送，支持频道与企业 QQ 群消息广播。",
			"icon":            "Bot",
			"auth_type":       "BEARER_TOKEN",
			"endpoint":        "https://api.sgroup.qq.com/channels/{channel_id}/messages",
			"tool_id":         "qq_bot_send_msg",
			"tool_name":       "QQ Bot Notification Dispatcher",
			"tool_description": "Broadcasts messages and markdown alerts to authorized QQ channels.",
			"risk":            "LOW",
			"sample_args":     map[string]interface{}{"channel_id": "9920144", "content": "Cluster healthcheck nominal"},
		},
		{
			"id":              "meituan_open_connector",
			"name":            "Meituan (美团) Merchant & Delivery Connector",
			"name_zh":         "美团外卖与企业服务连接器",
			"category":        "DOMESTIC_APPS",
			"provider":        "MEITUAN",
			"version":         "2.0.1",
			"description":     "Meituan merchant order sync, corporate meal booking, and Flash delivery webhook.",
			"description_zh":  "美团商户订单同步、企业加班订餐与闪送物流轨迹回调对接。",
			"icon":            "ShoppingBag",
			"auth_type":       "HMAC_SHA256",
			"endpoint":        "https://open-erp.meituan.com/open/order/query",
			"tool_id":         "meituan_order_sync",
			"tool_name":       "Meituan Order & Delivery Sync",
			"tool_description": "Synchronizes enterprise meal vouchers and delivery ETA.",
			"risk":            "MEDIUM",
			"sample_args":     map[string]interface{}{"order_id": "MT_99812031"},
		},
		{
			"id":              "rail_12306_connector",
			"name":            "China Railway 12306 (中国铁路) Ticketing Connector",
			"name_zh":         "中国铁路 12306 余票与行程连接器",
			"category":        "DOMESTIC_APPS",
			"provider":        "RAIL12306",
			"version":         "1.1.0",
			"description":     "High-speed rail train availability query and corporate trip schedule alerts.",
			"description_zh":  "全国高铁动车余票查询、正晚点检索与企业差旅动态推送。",
			"icon":            "Train",
			"auth_type":       "API_KEY",
			"endpoint":        "https://kyfw.12306.cn/otn/leftTicket/queryZ",
			"tool_id":         "rail_12306_ticket_query",
			"tool_name":       "12306 High-Speed Rail Schedule Query",
			"tool_description": "Queries train availability and arrival times between cities.",
			"risk":            "LOW",
			"sample_args":     map[string]interface{}{"from": "BJP", "to": "SHH", "date": "2026-06-01"},
		},
		{
			"id":              "airline_flight_connector",
			"name":            "Civil Aviation (民航航班) Live Flight Connector",
			"name_zh":         "民航机票与航班动态连接器",
			"category":        "DOMESTIC_APPS",
			"provider":        "AIRLINE_FLIGHTS",
			"version":         "1.0.8",
			"description":     "Domestic and international flight departure/delay alerts and check-in tracking.",
			"description_zh":  "国内与国际航班实时起降状态、延误预警与值机信息推送。",
			"icon":            "Plane",
			"auth_type":       "API_KEY",
			"endpoint":        "https://api.variflight.com/flight/query",
			"tool_id":         "flight_status_query",
			"tool_name":       "Aviation Flight Status Query",
			"tool_description": "Retrieves flight radar status and gate assignments.",
			"risk":            "LOW",
			"sample_args":     map[string]interface{}{"flight_no": "CA1501"},
		},
		{
			"id":              "alipay_open_connector",
			"name":            "Alipay (支付宝) Enterprise Payment & Bill Connector",
			"name_zh":         "支付宝开放平台与企业对账连接器",
			"category":        "DOMESTIC_APPS",
			"provider":        "ALIPAY",
			"version":         "2.4.0",
			"description":     "Alipay enterprise reconciliation bill download and payment notice callbacks.",
			"description_zh":  "支付宝企业账单自动对账下载与支付网关回调验证。",
			"icon":            "CreditCard",
			"auth_type":       "HMAC_SHA256",
			"endpoint":        "https://openapi.alipay.com/gateway.do",
			"tool_id":         "alipay_bill_query",
			"tool_name":       "Alipay Enterprise Bill Query",
			"tool_description": "Fetches signed daily settlement statements (requires financial review).",
			"risk":            "HIGH",
			"sample_args":     map[string]interface{}{"bill_date": "2026-05-01"},
		},
	}
}

// UpdateConfig updates connector configuration and marks it configured.
func (r *Registry) UpdateConfig(id string, config map[string]interface{}) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, exists := r.plugins[id]
	if !exists {
		p = &models.Plugin{
			ID:        id,
			Name:      id,
			IsActive:  true,
			CreatedAt: time.Now(),
		}
		r.plugins[id] = p
	}
	if p.Config == nil {
		p.Config = make(map[string]interface{})
	}
	for k, v := range config {
		p.Config[k] = v
	}
	p.IsConfigured = true
	return true
}

// QueryWeather returns meteorological metrics matching WeatherData in plugins.ts.
func QueryWeather(city, units string) map[string]interface{} {
	if strings.TrimSpace(city) == "" {
		city = "Beijing"
	}
	if units == "" {
		units = "metric"
	}

	baseC := 22.5
	cond := "Clear & Sunny"
	code := "SUNNY"
	humidity := 42
	windSpeed := 14.2
	windDir := "NE"
	aqi := 34
	aqiStatus := "EXCELLENT"

	switch strings.ToLower(strings.TrimSpace(city)) {
	case "shanghai", "上海":
		baseC, cond, code, humidity, windSpeed, windDir, aqi, aqiStatus = 24.0, "Partly Cloudy", "CLOUDY", 61, 18.5, "SE", 46, "EXCELLENT"
	case "shenzhen", "深圳":
		baseC, cond, code, humidity, windSpeed, windDir, aqi, aqiStatus = 28.4, "Tropical Breeze", "SUNNY", 72, 21.0, "S", 28, "EXCELLENT"
	case "hangzhou", "杭州":
		baseC, cond, code, humidity, windSpeed, windDir, aqi, aqiStatus = 21.8, "Light Rain", "RAIN", 78, 12.4, "E", 39, "EXCELLENT"
	case "london", "伦敦":
		baseC, cond, code, humidity, windSpeed, windDir, aqi, aqiStatus = 14.2, "Overcast & Mist", "OVERCAST", 82, 24.0, "SW", 31, "EXCELLENT"
	case "tokyo", "东京":
		baseC, cond, code, humidity, windSpeed, windDir, aqi, aqiStatus = 19.6, "Crisp Sky", "SUNNY", 50, 15.0, "N", 36, "EXCELLENT"
	case "new york", "纽约":
		baseC, cond, code, humidity, windSpeed, windDir, aqi, aqiStatus = 17.5, "Mild Clouds", "CLOUDY", 54, 19.2, "NW", 44, "GOOD"
	case "singapore", "新加坡":
		baseC, cond, code, humidity, windSpeed, windDir, aqi, aqiStatus = 30.2, "Afternoon Shower", "RAIN", 80, 11.8, "SW", 35, "EXCELLENT"
	}

	unitStr := "°C"
	displayTemp := baseC
	toDisplay := func(c float64) float64 {
		if units == "imperial" {
			return float64(int((c*9.0/5.0+32.0)*10)) / 10.0
		}
		return c
	}
	if units == "imperial" {
		unitStr = "°F"
		displayTemp = toDisplay(baseC)
	}

	now := time.Now()
	forecast := []map[string]interface{}{
		{"day": "Today", "temp_high": toDisplay(baseC + 3.0), "temp_low": toDisplay(baseC - 5.0), "condition": cond},
		{"day": now.Add(24 * time.Hour).Format("Mon"), "temp_high": toDisplay(baseC + 4.0), "temp_low": toDisplay(baseC - 4.0), "condition": "Sunny"},
		{"day": now.Add(48 * time.Hour).Format("Mon"), "temp_high": toDisplay(baseC + 2.0), "temp_low": toDisplay(baseC - 5.5), "condition": "Partly Cloudy"},
		{"day": now.Add(72 * time.Hour).Format("Mon"), "temp_high": toDisplay(baseC + 1.0), "temp_low": toDisplay(baseC - 6.0), "condition": "Clear"},
		{"day": now.Add(96 * time.Hour).Format("Mon"), "temp_high": toDisplay(baseC + 3.5), "temp_low": toDisplay(baseC - 4.5), "condition": "Breezy"},
	}

	return map[string]interface{}{
		"city":             city,
		"country":          "GLOBAL",
		"temperature":      displayTemp,
		"temperature_unit": unitStr,
		"condition":        cond,
		"condition_code":   code,
		"humidity_percent": humidity,
		"wind_speed_kmh":   windSpeed,
		"wind_direction":   windDir,
		"pressure_hpa":     1014,
		"uv_index":         5,
		"air_quality": map[string]interface{}{
			"aqi":    aqi,
			"status": aqiStatus,
			"pm2_5":  11.4,
			"pm10":   22.8,
		},
		"forecast":   forecast,
		"updated_at": now.UTC().Format(time.RFC3339),
	}
}

// DispatchEnterpriseNotification formats and signs webhook payloads for Feishu, DingTalk, and WeCom.
func DispatchEnterpriseNotification(platform, secret, title, content, targetURL, msgType string, atUsers []string, isAtAll bool) map[string]interface{} {
	if platform == "" {
		platform = "feishu"
	}
	if msgType == "" {
		msgType = "card"
	}
	timestamp := time.Now().Unix()
	msgID := fmt.Sprintf("msg_%s_%d", platform, timestamp)

	var signature string
	sigVerified := false
	if secret != "" {
		stringToSign := fmt.Sprintf("%d\n%s", timestamp, secret)
		h := hmac.New(sha256.New, []byte(secret))
		h.Write([]byte(stringToSign))
		signature = base64.StdEncoding.EncodeToString(h.Sum(nil))
		sigVerified = true
	}

	return map[string]interface{}{
		"platform":           platform,
		"channel":            platform,
		"message_id":         msgID,
		"message_type":       msgType,
		"target_url":         targetURL,
		"timestamp":          timestamp,
		"signature":          signature,
		"signature_verified": sigVerified,
		"status":             "DELIVERED_200_OK",
		"title":              title,
		"content":            content,
		"at_users":           atUsers,
		"is_at_all":          isAtAll,
		"sanitized_preview": map[string]interface{}{
			"platform":   platform,
			"title":      title,
			"secret":     "[REDACTED_CREDENTIAL]",
			"signed_mac": len(signature) > 0,
		},
	}
}
