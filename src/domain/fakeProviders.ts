import { ToolDefinition, ToolResult, ToolCall, ModelConfig } from '../contracts/types';
import { DataSanitizer } from './sanitizer';
import { WeatherEngine } from './plugins';

export interface FakeModelGenerateOptions {
  modelConfig: ModelConfig;
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  structuredOutputSchema?: Record<string, any>;
  temperature?: number;
  maxTokens?: number;
}

export interface FakeModelResponse {
  content: string;
  structured_data?: any;
  finish_reason: 'stop' | 'length' | 'budget_exceeded';
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimated_cost_usd: number;
  };
}

export class FakeModel {
  public static async generate(options: FakeModelGenerateOptions): Promise<FakeModelResponse> {
    const { modelConfig, systemPrompt, messages, structuredOutputSchema } = options;
    const lastMessage = messages[messages.length - 1]?.content || '';

    // Estimate tokens: ~4 chars per token
    const promptChars = systemPrompt.length + messages.reduce((acc, m) => acc + m.content.length, 0);
    const promptTokens = Math.max(1, Math.ceil(promptChars / 4));

    let responseText = '';
    let structuredData: any = null;

    if (structuredOutputSchema) {
      structuredData = {
        action: 'PROCEED',
        summary: `Deterministic FakeModel analysis for: "${lastMessage.slice(0, 40)}"`,
        confidence: 0.98,
        plan_steps: [
          'Verify tenant authentication',
          'Evaluate tool policy constraints',
          'Execute sandboxed operation',
          'Record immutable audit log',
        ],
        timestamp: new Date().toISOString(),
      };
      responseText = JSON.stringify(structuredData, null, 2);
    } else {
      responseText = `[FakeModel:${modelConfig.name}] Processed query: "${lastMessage}". Policy verified. Response generated deterministically without calling external LLM providers.`;
    }

    const completionTokens = Math.max(1, Math.ceil(responseText.length / 4));
    const totalTokens = promptTokens + completionTokens;
    const cost = Number(
      ((promptTokens / 1000) * modelConfig.cost_per_1k_input +
        (completionTokens / 1000) * modelConfig.cost_per_1k_output).toFixed(6)
    );

    return {
      content: responseText,
      structured_data: structuredData,
      finish_reason: 'stop',
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        estimated_cost_usd: cost,
      },
    };
  }
}

export class FakeToolExecutor {
  private static idempotencyCache: Map<string, ToolResult> = new Map();

  /**
   * Executes a tool with sandboxing, schema checking, and idempotency cache
   */
  public static async execute(call: ToolCall, definition: ToolDefinition): Promise<ToolResult> {
    const startTime = Date.now();

    // Check idempotency cache if key provided
    if (call.idempotency_key && this.idempotencyCache.has(call.idempotency_key)) {
      const cached = this.idempotencyCache.get(call.idempotency_key)!;
      return {
        ...cached,
        idempotency_cached: true,
        trace_id: call.trace_id,
      };
    }

    // Validate required inputs based on schema
    const requiredFields = definition.input_schema.required || [];
    for (const field of requiredFields) {
      if (call.args[field] === undefined || call.args[field] === null || call.args[field] === '') {
        return {
          status: 'ERROR',
          sanitized_error: `Tool argument validation failed: Missing required argument '${field}'.`,
          elapsed_ms: Date.now() - startTime,
          trace_id: call.trace_id,
        };
      }
    }

    // Sandboxed execution of specific built-in Fake tools
    let output: any = null;
    try {
      switch (call.tool_id) {
        case 'fake_calculator': {
          const { a, b, operation } = call.args;
          const numA = Number(a);
          const numB = Number(b);
          let res = 0;
          if (operation === 'add') res = numA + numB;
          else if (operation === 'multiply') res = numA * numB;
          else if (operation === 'divide') {
            if (numB === 0) throw new Error('Division by zero');
            res = numA / numB;
          } else res = numA - numB;
          output = { result: res, operation, a: numA, b: numB };
          break;
        }

        case 'fake_db_query': {
          output = {
            rows: [
              { id: 'usr_101', name: 'Alice Enterprise', role: 'APP_DEVELOPER', active: true },
              { id: 'usr_102', name: 'Bob Auditor', role: 'AUDITOR', active: true },
            ],
            row_count: 2,
            query_plan: 'INDEX_SCAN on idx_tenant_id',
          };
          break;
        }

        case 'fake_cloud_deploy': {
          output = {
            cluster: call.args.cluster || 'k8s-prod-us-east',
            manifest: call.args.manifest_name || 'agent-worker-deployment',
            status: 'APPLIED_OBSERVING',
            message: 'Deployment declared in mock cluster. Waiting on PodReady condition.',
            conditions: [{ type: 'PodScheduled', status: 'True' }, { type: 'Ready', status: 'True' }],
          };
          break;
        }

        case 'fake_send_notification': {
          output = {
            channel: call.args.channel || '#ops-alerts',
            delivered: true,
            message_preview: DataSanitizer.sanitizeString(call.args.message || 'Notification test'),
            timestamp: new Date().toISOString(),
          };
          break;
        }

        case 'maps_geocode': {
          const address = String(call.args.address || '');
          const lower = address.toLowerCase();
          let lat = 39.9042;
          let lng = 116.4074;
          let formatted = 'Beijing, China';
          if (lower.includes('shanghai')) {
            lat = 31.2304;
            lng = 121.4737;
            formatted = 'Shanghai, China';
          } else if (lower.includes('tokyo')) {
            lat = 35.6762;
            lng = 139.6503;
            formatted = 'Tokyo, Japan';
          } else if (lower.includes('new york') || lower.includes('nyc')) {
            lat = 40.7128;
            lng = -74.006;
            formatted = 'New York, NY, USA';
          } else if (lower.includes('london')) {
            lat = 51.5074;
            lng = -0.1278;
            formatted = 'London, UK';
          } else if (lower.includes('san francisco') || lower.includes('sf')) {
            lat = 37.7749;
            lng = -122.4194;
            formatted = 'San Francisco, CA, USA';
          }
          output = {
            lat,
            lng,
            formatted_address: formatted,
            place_id: `gmp_place_${Math.abs(Math.round(lat * 1000))}`,
            status: 'OK',
          };
          break;
        }

        case 'maps_places_search': {
          const q = String(call.args.query || 'point of interest');
          output = {
            query: q,
            results: [
              { name: `${q} - Central Hub`, rating: 4.8, user_ratings_total: 1420, open_now: true, address: 'Civic District 1' },
              { name: `${q} - High-Tech Park`, rating: 4.6, user_ratings_total: 890, open_now: true, address: 'Innovation Avenue 108' },
            ],
            total_count: 2,
          };
          break;
        }

        case 'weather_current': {
          const city = String(call.args.city || 'Beijing');
          const units = call.args.units === 'imperial' ? 'imperial' : 'metric';
          const weather = WeatherEngine.queryWeather(city, units);
          output = {
            city: weather.city,
            temperature: weather.temperature,
            unit: weather.temperature_unit,
            condition: weather.condition,
            humidity: `${weather.humidity_percent}%`,
            wind: `${weather.wind_speed_kmh} km/h (${weather.wind_direction})`,
            aqi: weather.air_quality,
            retrieved_at: weather.updated_at,
          };
          break;
        }

        case 'weather_forecast': {
          const city = String(call.args.city || 'Beijing');
          const weather = WeatherEngine.queryWeather(city, 'metric');
          output = {
            city: weather.city,
            forecast: weather.forecast,
            retrieved_at: weather.updated_at,
          };
          break;
        }

        case 'feishu_bot_notify': {
          output = {
            delivered: true,
            platform: 'feishu',
            message_id: `lark_om_${Date.now()}_91`,
            content_preview: DataSanitizer.sanitizeString(call.args.content || ''),
            signed: true,
            status: 'SUCCESS',
          };
          break;
        }

        case 'dingtalk_bot_notify': {
          output = {
            errcode: 0,
            errmsg: 'ok',
            delivered: true,
            platform: 'dingtalk',
            title: call.args.title || 'Agent Escalation',
            timestamp: Date.now(),
          };
          break;
        }

        case 'wecom_bot_notify': {
          output = {
            errcode: 0,
            errmsg: 'ok',
            delivered: true,
            platform: 'wecom',
            preview: DataSanitizer.sanitizeString(call.args.content || ''),
          };
          break;
        }

        case 'amap_geocode': {
          output = {
            location: '116.407526,39.904030',
            formatted_address: `北京市朝阳区科技园区 (${call.args.address || '标准测试点'})`,
            gcj02_verified: true,
          };
          break;
        }

        default:
          output = {
            tool_id: call.tool_id,
            args: DataSanitizer.sanitizeObject(call.args),
            executed_at: new Date().toISOString(),
            mock_success: true,
          };
      }
    } catch (err: any) {
      return {
        status: 'ERROR',
        sanitized_error: DataSanitizer.sanitizeString(err.message || 'Tool execution error'),
        elapsed_ms: Date.now() - startTime,
        trace_id: call.trace_id,
      };
    }

    const result: ToolResult = {
      status: 'SUCCESS',
      validated_output: output,
      elapsed_ms: Date.now() - startTime,
      trace_id: call.trace_id,
    };

    if (call.idempotency_key) {
      this.idempotencyCache.set(call.idempotency_key, result);
    }

    return result;
  }
}

export class FakeMCPServer {
  public static readonly SERVER_NAME = 'local-controlled-mcp-v1';
  public static readonly SERVER_VERSION = '2026.11-spec';

  public static getTools(): ToolDefinition[] {
    return [
      {
        id: 'mcp_filesystem_read',
        name: 'MCP Controlled File Reader',
        version: '1.0.0',
        description: 'Read sandboxed file content within authorized project directory only.',
        category: 'SYSTEM',
        input_schema: {
          type: 'object',
          properties: {
            filepath: { type: 'string', description: 'Relative path inside sandbox' },
          },
          required: ['filepath'],
        },
        output_schema: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            size_bytes: { type: 'number' },
          },
        },
        permissions: ['FILESYSTEM_READ'],
        risk: 'LOW',
        idempotency_mode: 'IDEMPOTENT',
        timeout_ms: 3000,
        retry_policy: { max_retries: 2, backoff_ms: 100 },
        network_targets: [],
        is_active: true,
        is_fake: true,
      },
      {
        id: 'mcp_git_inspect',
        name: 'MCP Git Repository Inspector',
        version: '1.0.0',
        description: 'Inspect commit history and branches in local repository without remote write access.',
        category: 'CODE',
        input_schema: {
          type: 'object',
          properties: {
            revision: { type: 'string', default: 'HEAD' },
          },
        },
        output_schema: {
          type: 'object',
          properties: {
            commit: { type: 'string' },
            author: { type: 'string' },
          },
        },
        permissions: ['GIT_READ'],
        risk: 'LOW',
        idempotency_mode: 'IDEMPOTENT',
        timeout_ms: 5000,
        retry_policy: { max_retries: 1, backoff_ms: 200 },
        network_targets: [],
        is_active: true,
        is_fake: true,
      },
    ];
  }

  public static async executeMCPTool(toolId: string, args: Record<string, any>): Promise<any> {
    if (toolId === 'mcp_filesystem_read') {
      const path = args.filepath || 'manifest.json';
      if (path.includes('..') || path.startsWith('/')) {
        throw new Error('Path traversal detected: Attempted to break out of MCP sandbox.');
      }
      return {
        content: `{"project": "ai-agent-studio", "status": "sandboxed_mcp_ok", "path": "${path}"}`,
        size_bytes: 84,
      };
    }
    if (toolId === 'mcp_git_inspect') {
      return {
        commit: '7f9c2d1',
        branch: 'main',
        author: 'Agent Studio Local Bot',
        message: 'chore: initial executable Vibe Coding skeleton P0-1',
      };
    }
    throw new Error(`MCP Tool '${toolId}' not recognized on ${this.SERVER_NAME}`);
  }
}
