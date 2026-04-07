import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import {
  buildAuthUrl,
  createFirstFrame,
  createLastFrame,
  createMiddleFrame,
  decodeResultText,
  extractTextFromResult,
  hasResultPayload,
  isFinishedResponse,
  isSuccessResponse,
  parseResponse,
  type XfyunProtocolOptions,
} from '@/asr/protocols/xfyun.js';

function makeProtocolOptions(overrides: Partial<XfyunProtocolOptions> = {}): XfyunProtocolOptions {
  return {
    appId: 'test-app-id',
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    encoding: 'raw',
    sampleRate: 16000,
    bitDepth: 16,
    channels: 1,
    domain: 'slm',
    language: 'zh_cn',
    accent: 'mandarin',
    eos: 6000,
    ...overrides,
  };
}

describe('科大讯飞 ASR 协议', () => {
  describe('buildAuthUrl', () => {
    it('应该生成包含鉴权参数的 URL', () => {
      const url = buildAuthUrl('iat.xf-yun.com', '/v1', 'my-key', 'my-secret');
      expect(url).toMatch(/^wss:\/\/iat\.xf-yun\.com\/v1\?/);
      expect(url).toContain('authorization=');
      expect(url).toContain('date=');
      expect(url).toContain('host=iat.xf-yun.com');
    });

    it('authorization 参数应该是 base64 编码的', () => {
      const url = buildAuthUrl('iat.xf-yun.com', '/v1', 'my-key', 'my-secret');
      const params = new URL(url).searchParams;
      const authorization = params.get('authorization') ?? '';
      expect(authorization).toBeTruthy();
      // base64 解码应该包含 api_key 和 algorithm
      const decoded = Buffer.from(authorization, 'base64').toString('utf8');
      expect(decoded).toContain('api_key="my-key"');
      expect(decoded).toContain('algorithm="hmac-sha256"');
      expect(decoded).toContain('signature=');
    });
  });

  describe('createFirstFrame', () => {
    it('应该创建包含 parameter 的首帧', () => {
      const options = makeProtocolOptions();
      const audioBase64 = Buffer.from('audio-data').toString('base64');
      const frame = JSON.parse(createFirstFrame(options, audioBase64, 1));

      expect(frame.header.app_id).toBe('test-app-id');
      expect(frame.header.status).toBe(0);
      expect(frame.parameter).toBeDefined();
      expect(frame.parameter.iat.domain).toBe('slm');
      expect(frame.parameter.iat.language).toBe('zh_cn');
      expect(frame.parameter.iat.accent).toBe('mandarin');
      expect(frame.parameter.iat.eos).toBe(6000);
      expect(frame.parameter.iat.result.encoding).toBe('utf8');
      expect(frame.parameter.iat.result.format).toBe('json');
      expect(frame.payload.audio.status).toBe(0);
      expect(frame.payload.audio.seq).toBe(1);
      expect(frame.payload.audio.audio).toBe(audioBase64);
    });

    it('应该包含可选参数 dwa 和 ltc', () => {
      const options = makeProtocolOptions({ dwa: 'wpgs', ltc: 2 });
      const frame = JSON.parse(createFirstFrame(options, '', 1));

      expect(frame.parameter.iat.dwa).toBe('wpgs');
      expect(frame.parameter.iat.ltc).toBe(2);
    });

    it('应该包含 resId 和 dhw', () => {
      const options = makeProtocolOptions({ resId: 'hot_words', dhw: 'dhw=utf-8;你好|大家' });
      const frame = JSON.parse(createFirstFrame(options, '', 1));

      expect(frame.header.res_id).toBe('hot_words');
      expect(frame.parameter.iat.dhw).toBe('dhw=utf-8;你好|大家');
    });
  });

  describe('createMiddleFrame', () => {
    it('应该创建不包含 parameter 的中间帧', () => {
      const options = makeProtocolOptions();
      const audioBase64 = Buffer.from('chunk').toString('base64');
      const frame = JSON.parse(createMiddleFrame(options, audioBase64, 5));

      expect(frame.header.app_id).toBe('test-app-id');
      expect(frame.header.status).toBe(1);
      expect(frame.parameter).toBeUndefined();
      expect(frame.payload.audio.status).toBe(1);
      expect(frame.payload.audio.seq).toBe(5);
      expect(frame.payload.audio.audio).toBe(audioBase64);
    });
  });

  describe('createLastFrame', () => {
    it('应该创建 audio 为空的末帧', () => {
      const options = makeProtocolOptions();
      const frame = JSON.parse(createLastFrame(options, 10));

      expect(frame.header.app_id).toBe('test-app-id');
      expect(frame.header.status).toBe(2);
      expect(frame.payload.audio.status).toBe(2);
      expect(frame.payload.audio.seq).toBe(10);
      expect(frame.payload.audio.audio).toBe('');
    });
  });

  describe('parseResponse', () => {
    it('应该解析 Buffer 类型的响应', () => {
      const data = Buffer.from(
        JSON.stringify({
          header: { code: 0, message: 'success', sid: 'sid-1', status: 1 },
        })
      );
      const response = parseResponse(data);
      expect(response.header.code).toBe(0);
      expect(response.header.message).toBe('success');
    });

    it('应该解析字符串类型的响应', () => {
      const response = parseResponse(
        JSON.stringify({
          header: { code: 0, message: 'success', sid: 'sid-2', status: 0 },
        })
      );
      expect(response.header.code).toBe(0);
    });
  });

  describe('decodeResultText', () => {
    it('应该 base64 解码并解析 JSON', () => {
      const result = {
        sn: 1,
        ls: false,
        ws: [
          {
            bg: 0,
            cw: [{ w: '你' }, { w: '好' }],
          },
        ],
      };
      const base64Text = Buffer.from(JSON.stringify(result)).toString('base64');
      const decoded = decodeResultText(base64Text);
      expect(decoded.sn).toBe(1);
      expect(decoded.ls).toBe(false);
      expect(decoded.ws).toHaveLength(1);
      expect(decoded.ws[0].cw).toHaveLength(2);
    });
  });

  describe('extractTextFromResult', () => {
    it('应该从 ws[].cw[].w 中提取文本', () => {
      const result = {
        ws: [
          { bg: 0, cw: [{ w: '你' }, { w: '好' }] },
          { bg: 2, cw: [{ w: '世' }, { w: '界' }] },
        ],
      };
      expect(extractTextFromResult(result)).toBe('你好世界');
    });

    it('应该处理空结果', () => {
      const result = { ws: [] };
      expect(extractTextFromResult(result)).toBe('');
    });
  });

  describe('事件判断函数', () => {
    it('isSuccessResponse 应该判断 code=0', () => {
      expect(isSuccessResponse({ header: { code: 0, message: 'ok', sid: '', status: 0 } })).toBe(
        true
      );
      expect(
        isSuccessResponse({ header: { code: 10105, message: 'err', sid: '', status: 0 } })
      ).toBe(false);
    });

    it('isFinishedResponse 应该判断 status=2', () => {
      expect(isFinishedResponse({ header: { code: 0, message: '', sid: '', status: 2 } })).toBe(
        true
      );
      expect(isFinishedResponse({ header: { code: 0, message: '', sid: '', status: 1 } })).toBe(
        false
      );
    });

    it('hasResultPayload 应该判断 payload.result 是否存在', () => {
      expect(
        hasResultPayload({
          header: { code: 0, message: '', sid: '', status: 1 },
          payload: {
            result: {
              compress: 'raw',
              encoding: 'utf8',
              format: 'json',
              seq: 1,
              status: 1,
              text: 'abc',
            },
          },
        })
      ).toBe(true);
      expect(hasResultPayload({ header: { code: 0, message: '', sid: '', status: 0 } })).toBe(
        false
      );
    });
  });
});
