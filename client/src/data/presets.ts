import type { AIModelPreset } from '../types';

export const AI_MODEL_PRESETS: AIModelPreset[] = [
  {
    provider: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultTemperature: 0.7,
    defaultMaxTokens: 4096,
  },
  {
    provider: 'claude',
    label: 'Claude (Anthropic)',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
    defaultTemperature: 0.7,
    defaultMaxTokens: 4096,
  },
  {
    provider: 'doubao',
    label: '豆包 (ByteDance)',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-pro-32k', 'doubao-lite-32k','doubao-seed-2-0-pro-260215'],
    defaultTemperature: 0.7,
    defaultMaxTokens: 4096,
  },
  {
    provider: 'custom',
    label: '自定义模型',
    baseUrl: '',
    models: [],
    defaultTemperature: 0.7,
    defaultMaxTokens: 4096,
  },
];
