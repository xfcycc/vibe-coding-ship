import type { AIModelConfig, StateItem, TableItem } from '../types';

// ===== Prompt Building =====

export interface PromptBuildParams {
  promptTemplate: string;
  projectName: string;
  projectVision: string;
  userInput: string;
  prevDocs: string;
  memorySummary?: string;
  states?: StateItem[];
  tables?: TableItem[];
}

export function formatStatesForPrompt(states: StateItem[]): string {
  if (!states || states.length === 0) return '（暂无状态数据）';
  return states.map(s => {
    const vals = s.stateValues.length > 0 ? s.stateValues.join('、') : '未定义';
    const desc = s.description ? ` - ${s.description}` : '';
    return `- **${s.stateName}**: ${vals}${desc}`;
  }).join('\n');
}

export function formatTablesForPrompt(tables: TableItem[]): string {
  if (!tables || tables.length === 0) return '（暂无表结构数据）';
  return tables.map(t => {
    const header = `### ${t.tableName}${t.description ? ` (${t.description})` : ''}`;
    if (t.fields.length === 0) return header + '\n（暂无字段定义）';
    const fieldLines = t.fields.map(f => {
      const req = f.isRequired ? '必填' : '可选';
      return `| ${f.fieldName} | ${f.fieldType} | ${req} | ${f.description || '-'} |`;
    });
    return `${header}\n| 字段名 | 类型 | 约束 | 说明 |\n|--------|------|------|------|\n${fieldLines.join('\n')}`;
  }).join('\n\n');
}

export function buildPrompt(params: PromptBuildParams): string {
  const {
    promptTemplate,
    projectName,
    projectVision,
    userInput,
    prevDocs,
    memorySummary = '',
    states = [],
    tables = [],
  } = params;

  const statesStr = formatStatesForPrompt(states);
  const tablesStr = formatTablesForPrompt(tables);

  let prompt = promptTemplate;
  prompt = prompt.replace(/\{projectName\}/g, projectName);
  prompt = prompt.replace(/\{projectVision\}/g, projectVision);
  prompt = prompt.replace(/\{userInput\}/g, userInput || '（用户未提供额外输入）');
  prompt = prompt.replace(/\{prevDocs\}/g, prevDocs || '（无前置文档）');
  prompt = prompt.replace(/\{memorySummary\}/g, memorySummary || '（无记忆摘要）');
  prompt = prompt.replace(/\{currentStates\}/g, statesStr);
  prompt = prompt.replace(/\{currentTables\}/g, tablesStr);

  return prompt;
}

export function buildFollowUpPrompt(
  currentContent: string,
  userInstruction: string
): string {
  return `# 任务
你是一位资深技术文档专家。请根据用户的修改要求，对现有文档进行精确优化。

# 当前文档内容
---
${currentContent}
---

# 用户修改要求
${userInstruction}

# 输出要求
- 仅修改用户要求的部分，其余内容保持不变
- 保持 Markdown 格式和原有章节结构
- 输出完整的修改后文档（不要只输出修改片段）
- 不要添加多余的解释说明`;
}

export function buildCompressionPrompt(docName: string, content: string): string {
  return `# 任务
请对以下项目文档进行精炼摘要。保留核心信息、关键决策和重要数据，去除冗余描述。

# 文档：${docName}
${content}

# 输出要求
- 控制在原文 30% 以内的篇幅
- 保留所有关键数据（表名、字段、状态值、技术选型等具体信息）
- 保留核心决策和理由
- 使用简洁的列表和要点格式
- 不要添加额外评论，只输出摘要内容`;
}

export function buildMemorySummaryPrompt(
  stepName: string,
  content: string,
  prevSummary: string
): string {
  return `# 任务
你是项目文档的"记忆管家"。每完成一步文档，你需要将该步骤中所有**重要的细节、关键决策、具体数据**追加到项目记忆中。
后续步骤只需要读取这份记忆就能获得完整的项目上下文，无需重新阅读所有历史文档。

${prevSummary ? `# 已有项目记忆\n${prevSummary}\n\n---\n` : ''}
# 新完成步骤：${stepName}
${content}

# 输出要求
1. **保留已有记忆的全部内容**（不要删减已有信息）
2. **追加本步骤的关键信息**，包括但不限于：
   - 具体的决策和理由（如技术选型、架构选择）
   - 所有具体数据（表名、字段、状态值、接口路径等）
   - 业务规则和约束条件
   - 用户角色和权限定义
   - 功能模块及其优先级
   - 重要的注意事项和边界条件
3. 使用结构化的 Markdown 格式，按主题分块（如：项目概要 / 用户体系 / 功能清单 / 数据模型 / 技术方案 / 业务规则）
4. 不要笼统概括，要保留具体细节——这份记忆是后续所有文档生成的唯一上下文来源
5. 总长度控制在 2000 字以内，如果超出则精简描述性文字，但保留所有具体数据
6. 只输出更新后的完整记忆内容，不要有额外说明`;
}

export function buildAIExtractPrompt(content: string): string {
  return `# 任务
从以下文档中提取所有"业务状态"和"数据库表结构"信息，以 JSON 格式输出。

# 文档内容
${content}

# 输出格式
严格按以下 JSON 格式输出，不要添加任何其他内容：
\`\`\`json
{
  "states": [
    { "stateName": "状态名称", "stateValues": ["值1", "值2"], "description": "说明" }
  ],
  "tables": [
    {
      "tableName": "表名",
      "description": "表说明",
      "fields": [
        { "fieldName": "字段名", "fieldType": "VARCHAR|INT|BIGINT|TEXT|BOOLEAN|DATETIME|JSON|DECIMAL", "description": "说明", "isRequired": true }
      ]
    }
  ]
}
\`\`\`

# 要求
- 如果文档中没有状态信息，states 返回空数组
- 如果文档中没有表结构信息，tables 返回空数组
- 字段类型只使用：VARCHAR, INT, BIGINT, TEXT, BOOLEAN, DATETIME, JSON, DECIMAL
- 只输出 JSON，不要有其他文字`;
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
          content: '你是一位资深项目架构师和技术文档专家，擅长生成结构化、高质量的 Markdown 技术文档。你的输出必须：1) 结构清晰、分章节组织；2) 内容具体可落地，避免空泛；3) 与前置文档保持逻辑连贯；4) 数据（状态、表结构等）要与等待区保持一致。直接输出文档内容，不要多余的开场白。',
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
  params: PromptBuildParams,
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
 * Stream a compression (summary) of a document.
 */
export async function streamCompressDirect(
  docName: string,
  content: string,
  config: AIModelConfig,
  callbacks: AIStreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const prompt = buildCompressionPrompt(docName, content);
  const { url, headers, body } = buildRequestParams(prompt, config);

  try {
    const response = await fetch(url, { method: 'POST', headers, body, signal });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      callbacks.onError(`压缩失败 (${response.status}): ${errorText.slice(0, 300)}`);
      return;
    }
    await readStream(response, config.provider, callbacks);
  } catch (err: any) {
    if (err.name === 'AbortError') callbacks.onDone();
    else callbacks.onError(err.message || '压缩请求失败');
  }
}

/**
 * Stream memory summary generation.
 */
export async function streamMemorySummaryDirect(
  stepName: string,
  content: string,
  prevSummary: string,
  config: AIModelConfig,
  callbacks: AIStreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const prompt = buildMemorySummaryPrompt(stepName, content, prevSummary);
  const { url, headers, body } = buildRequestParams(prompt, config);

  try {
    const response = await fetch(url, { method: 'POST', headers, body, signal });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      callbacks.onError(`记忆总结失败 (${response.status}): ${errorText.slice(0, 300)}`);
      return;
    }
    await readStream(response, config.provider, callbacks);
  } catch (err: any) {
    if (err.name === 'AbortError') callbacks.onDone();
    else callbacks.onError(err.message || '记忆总结请求失败');
  }
}

/**
 * Use AI to extract states and tables from a document (non-streaming, returns JSON).
 */
export async function aiExtractFromDoc(
  content: string,
  config: AIModelConfig,
  signal?: AbortSignal
): Promise<{ states: Array<{ stateName: string; stateValues: string[]; description: string }>; tables: Array<{ tableName: string; description: string; fields: Array<{ fieldName: string; fieldType: string; description: string; isRequired: boolean }> }> }> {
  const prompt = buildAIExtractPrompt(content);
  const { url, headers } = buildRequestParams(prompt, config);

  const bodyObj = JSON.parse(buildRequestParams(prompt, config).body);
  bodyObj.stream = false;
  if (bodyObj.max_tokens) bodyObj.max_tokens = Math.min(bodyObj.max_tokens, 4096);

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyObj),
    signal,
  });

  if (!response.ok) {
    throw new Error(`AI提取失败 (${response.status})`);
  }

  const data = await response.json();
  let text = '';
  if (config.provider === 'claude') {
    text = data.content?.[0]?.text || '';
  } else {
    text = data.choices?.[0]?.message?.content || '';
  }

  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;

  try {
    const result = JSON.parse(jsonStr.trim());
    return {
      states: Array.isArray(result.states) ? result.states : [],
      tables: Array.isArray(result.tables) ? result.tables : [],
    };
  } catch {
    return { states: [], tables: [] };
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
