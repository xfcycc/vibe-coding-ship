import type { AIModelConfig } from '../types';

// ===== Prompt Building =====

interface PromptBuildParams {
  promptTemplate: string;
  projectName: string;
  projectVision: string;
  userInput: string;
  prevDocs: string;
  currentStates?: string;
  currentTables?: string;
}

export function buildPrompt(params: PromptBuildParams): string {
  const {
    promptTemplate,
    projectName,
    projectVision,
    userInput,
    prevDocs,
    currentStates = '',
    currentTables = '',
  } = params;

  let prompt = promptTemplate;
  prompt = prompt.replace(/{projectName}/g, projectName);
  prompt = prompt.replace(/{projectVision}/g, projectVision);
  prompt = prompt.replace(/{userInput}/g, userInput || '（用户未提供额外输入）');
  prompt = prompt.replace(/{prevDocs}/g, prevDocs || '（无前置文档）');
  prompt = prompt.replace(/{currentStates}/g, currentStates || '（暂无状态数据）');
  prompt = prompt.replace(/{currentTables}/g, currentTables || '（暂无表结构数据）');

  return prompt;
}

export function buildFollowUpPrompt(
  currentContent: string,
  userInstruction: string
): string {
  return `以下是当前文档内容：

---
${currentContent}
---

用户要求修改：${userInstruction}

请基于当前文档内容，根据用户的修改要求进行优化。保持Markdown格式，仅修改用户要求的部分，其余内容保持不变。输出完整的修改后文档。`;
}

// ===== Direct AI Streaming =====

function buildRequestParams(
  prompt: string,
  config: AIModelConfig
): { url: string; headers: Record<string, string>; body: string } {
  const { provider, apiKey, baseUrl, model, temperature, maxTokens } = config;

  if (provider === 'claude') {
    return {
      url: `${baseUrl}/messages`,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        stream: true,
        messages: [{ role: 'user', content: prompt }],
      }),
    };
  }

  // OpenAI-compatible (OpenAI, Doubao, custom)
  return {
    url: `${baseUrl}/chat/completions`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      stream: true,
      messages: [
        {
          role: 'system',
          content:
            '你是一位专业的项目文档撰写专家，擅长生成结构化、标准化的Markdown技术文档。请根据用户的指示生成高质量的项目文档。',
        },
        { role: 'user', content: prompt },
      ],
    }),
  };
}

interface ParsedChunk {
  content: string;
  reasoning: string;
  done: boolean;
}

function parseSSEChunk(
  data: string,
  provider: AIModelConfig['provider']
): ParsedChunk {
  if (data === '[DONE]') return { content: '', reasoning: '', done: true };

  try {
    const parsed = JSON.parse(data);

    if (provider === 'claude') {
      if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
        return { content: parsed.delta.text, reasoning: '', done: false };
      }
      if (parsed.type === 'message_stop') {
        return { content: '', reasoning: '', done: true };
      }
      return { content: '', reasoning: '', done: false };
    }

    // OpenAI-compatible (handles reasoning_content from Doubao/DeepSeek)
    const delta = parsed.choices?.[0]?.delta;
    const content = delta?.content || '';
    const reasoning = delta?.reasoning_content || '';
    const finished = parsed.choices?.[0]?.finish_reason === 'stop';
    return { content, reasoning, done: finished };
  } catch {
    return { content: '', reasoning: '', done: false };
  }
}

interface StreamCallbacks {
  onChunk: (text: string) => void;
  onReasoningChunk?: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}

async function readStream(
  response: Response,
  provider: AIModelConfig['provider'],
  callbacks: StreamCallbacks
): Promise<void> {
  const { onChunk, onReasoningChunk, onDone, onError } = callbacks;
  const reader = response.body?.getReader();
  if (!reader) {
    onError('无法读取响应流');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6).trim();
        const result = parseSSEChunk(data, provider);

        if (result.done) {
          onDone();
          return;
        }
        if (result.reasoning && onReasoningChunk) {
          onReasoningChunk(result.reasoning);
        }
        if (result.content) {
          onChunk(result.content);
        }
      }
    }
    onDone();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      onDone();
    } else {
      onError(err.message || '流式读取失败');
    }
  }
}

export interface AIStreamCallbacks {
  onChunk: (text: string) => void;
  onReasoningChunk?: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}

/**
 * Stream AI response directly from the browser to the AI API.
 */
export async function streamAIDirect(
  params: {
    promptTemplate: string;
    projectName: string;
    projectVision: string;
    userInput: string;
    prevDocs: string;
  },
  config: AIModelConfig,
  callbacks: AIStreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const prompt = buildPrompt(params);
  const { url, headers, body } = buildRequestParams(prompt, config);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      callbacks.onError(`AI API 错误 (${response.status}): ${errorText.slice(0, 300)}`);
      return;
    }

    await readStream(response, config.provider, callbacks);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      callbacks.onDone();
    } else {
      callbacks.onError(err.message || 'AI请求失败');
    }
  }
}

/**
 * Stream a follow-up modification directly from the browser.
 */
export async function streamFollowUpDirect(
  params: {
    currentContent: string;
    userInstruction: string;
  },
  config: AIModelConfig,
  callbacks: AIStreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const prompt = buildFollowUpPrompt(params.currentContent, params.userInstruction);
  const { url, headers, body } = buildRequestParams(prompt, config);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      callbacks.onError(`AI API 错误 (${response.status}): ${errorText.slice(0, 300)}`);
      return;
    }

    await readStream(response, config.provider, callbacks);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      callbacks.onDone();
    } else {
      callbacks.onError(err.message || 'AI请求失败');
    }
  }
}

/**
 * Test AI API connection directly from the browser.
 */
export async function testConnectionDirect(
  config: AIModelConfig
): Promise<{ success: boolean; message: string }> {
  const { provider, apiKey, baseUrl, model } = config;

  try {
    let url: string;
    let headers: Record<string, string>;
    let body: string;

    if (provider === 'claude') {
      url = `${baseUrl}/messages`;
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      };
      body = JSON.stringify({
        model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      });
    } else {
      url = `${baseUrl}/chat/completions`;
      headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };
      body = JSON.stringify({
        model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      return { success: true, message: '连接成功！API配置有效。' };
    } else {
      const errorText = await response.text();
      return {
        success: false,
        message: `连接失败 (${response.status}): ${errorText.slice(0, 200)}`,
      };
    }
  } catch (err: any) {
    if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      return {
        success: false,
        message: '连接失败: 可能存在CORS限制。请确认API地址支持浏览器直接访问，或使用支持CORS的代理地址。',
      };
    }
    return { success: false, message: `连接失败: ${err.message}` };
  }
}
