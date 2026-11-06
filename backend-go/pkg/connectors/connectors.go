package connectors

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
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

func (r *Registry) seed() {
	presets := []models.Plugin{
		{
			ID:            "plugin_wechat_open",
			Name:          "WeChat Open Platform Connector",
			NameZh:        "微信开放平台连接器",
			Category:      "DOMESTIC_APPS",
			Provider:      "WECHAT",
			Version:       "1.2.0",
			Description:   "WeChat Official Account, Template Message, Mini Program dispatch and Pay notification.",
			DescriptionZh: "微信服务号模板消息、小程序统一服务通知与商户支付回调对接。",
			AuthType:      "API_KEY",
			Endpoint:      "https://api.weixin.qq.com/cgi-bin/message/template/send",
			IsActive:      true,
			TotalCalls:    1420,
			P95LatencyMs:  45,
			ToolID:        "wechat_send_template",
			Risk:          "MEDIUM",
			CreatedAt:     time.Now().Add(-120 * time.Hour),
		},
		{
			ID:            "plugin_qq_connect",
			Name:          "Tencent QQ Open Connect",
			NameZh:        "腾讯 QQ 互联与群机器人",
			Category:      "DOMESTIC_APPS",
			Provider:      "QQ",
			Version:       "1.0.4",
			Description:   "QQ Channel bot webhook notification, Group message broadcast, and OAuth2 login.",
			DescriptionZh: "QQ 频道机器人、群聊官方 Webhook 推送与统一身份授权对接。",
			AuthType:      "OAUTH2",
			Endpoint:      "https://api.sgroup.qq.com/channels/{channel_id}/messages",
			IsActive:      true,
			TotalCalls:    890,
			P95LatencyMs:  38,
			ToolID:        "qq_send_channel_msg",
			Risk:          "LOW",
			CreatedAt:     time.Now().Add(-96 * time.Hour),
		},
		{
			ID:            "plugin_meituan_merchant",
			Name:          "Meituan Open Platform Connector",
			NameZh:        "美团外卖与企业服务连接器",
			Category:      "DOMESTIC_APPS",
			Provider:      "MEITUAN",
			Version:       "2.0.1",
			Description:   "Meituan merchant order sync, corporate lunch booking, and Flash delivery webhook.",
			DescriptionZh: "美团外卖商户订单同步、企业用餐订餐与美团闪送物流配送对接。",
			AuthType:      "API_KEY",
			Endpoint:      "https://open-erp.meituan.com/open/order/query",
			IsActive:      true,
			TotalCalls:    430,
			P95LatencyMs:  52,
			ToolID:        "meituan_order_sync",
			Risk:          "MEDIUM",
			CreatedAt:     time.Now().Add(-80 * time.Hour),
		},
		{
			ID:            "plugin_rail_12306",
			Name:          "China Railway 12306 Ticket Connector",
			NameZh:        "中国铁路 12306 客票与行程连接器",
			Category:      "DOMESTIC_APPS",
			Provider:      "RAIL12306",
			Version:       "1.1.0",
			Description:   "High-speed rail train query, remaining tickets check, and corporate business trip itinerary.",
			DescriptionZh: "全国高铁动车余票查询、正晚点检索与企业出差行程动态卡片对接。",
			AuthType:      "API_KEY",
			Endpoint:      "https://kyfw.12306.cn/otn/leftTicket/queryZ",
			IsActive:      true,
			TotalCalls:    2150,
			P95LatencyMs:  68,
			ToolID:        "rail_12306_ticket_query",
			Risk:          "LOW",
			CreatedAt:     time.Now().Add(-140 * time.Hour),
		},
		{
			ID:            "plugin_airline_flight",
			Name:          "Civil Aviation Flights & Airport Connector",
			NameZh:        "民航机票与航班动态连接器",
			Category:      "DOMESTIC_APPS",
			Provider:      "AIRLINE_FLIGHTS",
			Version:       "1.0.8",
			Description:   "Domestic and international flight status query, delays, ticket booking and baggage tracker.",
			DescriptionZh: "国内与国际航班实时起降状态、延误预警、机票比价与值机信息推送。",
			AuthType:      "API_KEY",
			Endpoint:      "https://api.variflight.com/flight/query",
			IsActive:      true,
			TotalCalls:    1820,
			P95LatencyMs:  55,
			ToolID:        "flight_status_query",
			Risk:          "LOW",
			CreatedAt:     time.Now().Add(-100 * time.Hour),
		},
		{
			ID:            "plugin_alipay_merchant",
			Name:          "Alipay Open Platform & Mini-Program",
			NameZh:        "支付宝开放平台与支付连接器",
			Category:      "DOMESTIC_APPS",
			Provider:      "ALIPAY",
			Version:       "2.4.0",
			Description:   "Alipay Merchant payment, Fund transfer, Mini-Program notifications, and Bill inquiry.",
			DescriptionZh: "支付宝当面付、企业转账至支付宝账户、生活号推送与对账单查询。",
			AuthType:      "API_KEY",
			Endpoint:      "https://openapi.alipay.com/gateway.do",
			IsActive:      true,
			TotalCalls:    3400,
			P95LatencyMs:  42,
			ToolID:        "alipay_bill_query",
			Risk:          "HIGH",
			CreatedAt:     time.Now().Add(-160 * time.Hour),
		},
	}

	for _, p := range presets {
		pCopy := p
		r.plugins[p.ID] = &pCopy
	}
}

// ListPlugins returns all registered plugins.
func (r *Registry) ListPlugins() []*models.Plugin {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var list []*models.Plugin
	for _, p := range r.plugins {
		list = append(list, p)
	}
	return list
}

// CreatePlugin dynamically registers a custom connector.
func (r *Registry) CreatePlugin(p models.Plugin) *models.Plugin {
	r.mu.Lock()
	defer r.mu.Unlock()

	if p.ID == "" {
		p.ID = fmt.Sprintf("plugin_custom_%d", time.Now().UnixMilli())
	}
	p.CreatedAt = time.Now()
	p.IsActive = true
	r.plugins[p.ID] = &p
	return &p
}

// TogglePlugin toggles connector active state.
func (r *Registry) TogglePlugin(id string) (*models.Plugin, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, exists := r.plugins[id]
	if !exists {
		return nil, fmt.Errorf("Plugin '%s' not found", id)
	}
	p.IsActive = !p.IsActive
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

// DispatchEnterpriseNotification formats and signs webhook payloads for Feishu, DingTalk, and WeCom.
func DispatchEnterpriseNotification(channel string, secret string, title string, content string) map[string]interface{} {
	timestamp := time.Now().Unix()
	msgID := fmt.Sprintf("msg_%s_%d", channel, timestamp)

	var signature string
	if secret != "" {
		stringToSign := fmt.Sprintf("%d\n%s", timestamp, secret)
		h := hmac.New(sha256.New, []byte(secret))
		h.Write([]byte(stringToSign))
		signature = base64.StdEncoding.EncodeToString(h.Sum(nil))
	}

	return map[string]interface{}{
		"channel":    channel,
		"message_id": msgID,
		"timestamp":  timestamp,
		"signature":  signature,
		"status":     "DELIVERED_200_OK",
		"title":      title,
		"content":    content,
	}
}
