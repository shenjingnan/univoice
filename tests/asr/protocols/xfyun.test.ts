import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import {
  buildAuthUrl,
  createFirstFrame,
  createLastFrame,
  createMiddleFrame,
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
    domain: 'iat',
    language: 'zh_cn',
    accent: 'mandarin',
    eos: 2000,
    ...overrides,
  };
}

describe('科大讯飞 ASR 协议', () => {
  describe('buildAuthUrl', () => {
    it('应该生成包含鉴权参数的 URL', () => {
      const url = buildAuthUrl('iat-api.xfyun.cn', '/v2/iat', 'my-key', 'my-secret');
      expect(url).toMatch(/^wss:\/\/iat-api\.xfyun\.cn\/v2\/iat\?/);
      expect(url).toContain('authorization=');
      expect(url).toContain('date=');
      expect(url).toContain('host=iat-api.xfyun.cn');
    });

    it('authorization 参数应该是 base64 编码的', () => {
      const url = buildAuthUrl('iat-api.xfyun.cn', '/v2/iat', 'my-key', 'my-secret');
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
    it('应该创建包含 common 和 business 的首帧', () => {
      const options = makeProtocolOptions();
      const audioBase64 = Buffer.from('audio-data').toString('base64');
      const frame = JSON.parse(createFirstFrame(options, audioBase64));

      expect(frame.common.app_id).toBe('test-app-id');
      expect(frame.business).toBeDefined();
      expect(frame.business.domain).toBe('iat');
      expect(frame.business.language).toBe('zh_cn');
      expect(frame.business.accent).toBe('mandarin');
      expect(frame.business.eos).toBe(2000);
      expect(frame.data.status).toBe(0);
      expect(frame.data.format).toBe('audio/L16;rate=16000');
      expect(frame.data.encoding).toBe('raw');
      expect(frame.data.audio).toBe(audioBase64);
    });

    it('应该包含可选参数 dwa 和 ltc', () => {
      const options = makeProtocolOptions({ dwa: 'wpgs', ltc: 2 });
      const frame = JSON.parse(createFirstFrame(options, ''));

      expect(frame.business.dwa).toBe('wpgs');
      expect(frame.business.ltc).toBe(2);
    });

    it('应该包含 dhw', () => {
      const options = makeProtocolOptions({ dhw: 'dhw=utf-8;你好|大家' });
      const frame = JSON.parse(createFirstFrame(options, ''));

      expect(frame.business.dhw).toBe('dhw=utf-8;你好|大家');
    });

    it('应该包含 v2 新增参数', () => {
      const options = makeProtocolOptions({ ptt: 1, vinfo: 1, nunum: 1, nbest: 3 });
      const frame = JSON.parse(createFirstFrame(options, ''));

      expect(frame.business.ptt).toBe(1);
      expect(frame.business.vinfo).toBe(1);
      expect(frame.business.nunum).toBe(1);
      expect(frame.business.nbest).toBe(3);
    });
  });

  describe('createMiddleFrame', () => {
    it('应该创建只包含 data 的中间帧', () => {
      const options = makeProtocolOptions();
      const audioBase64 = Buffer.from('chunk').toString('base64');
      const frame = JSON.parse(createMiddleFrame(options, audioBase64));

      expect(frame.common).toBeUndefined();
      expect(frame.business).toBeUndefined();
      expect(frame.data.status).toBe(1);
      expect(frame.data.format).toBe('audio/L16;rate=16000');
      expect(frame.data.encoding).toBe('raw');
      expect(frame.data.audio).toBe(audioBase64);
    });
  });

  describe('createLastFrame', () => {
    it('应该创建 data.status=2 的末帧', () => {
      const frame = JSON.parse(createLastFrame());

      expect(frame.data.status).toBe(2);
      expect(frame.common).toBeUndefined();
      expect(frame.business).toBeUndefined();
    });
  });

  describe('parseResponse', () => {
    it('应该解析 Buffer 类型的响应', () => {
      const data = Buffer.from(
        JSON.stringify({
          code: 0,
          message: 'success',
          sid: 'iat-test-sid',
          data: { status: 1 },
        })
      );
      const response = parseResponse(data);
      expect(response.code).toBe(0);
      expect(response.message).toBe('success');
    });

    it('应该解析字符串类型的响应', () => {
      const response = parseResponse(
        JSON.stringify({
          code: 0,
          message: 'success',
          sid: 'iat-test-sid-2',
          data: { status: 0 },
        })
      );
      expect(response.code).toBe(0);
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
      expect(isSuccessResponse({ code: 0, message: 'ok', sid: '' })).toBe(true);
      expect(isSuccessResponse({ code: 10105, message: 'err', sid: '' })).toBe(false);
    });

    it('isFinishedResponse 应该判断 data.status=2', () => {
      expect(isFinishedResponse({ code: 0, message: '', sid: '', data: { status: 2 } })).toBe(true);
      expect(isFinishedResponse({ code: 0, message: '', sid: '', data: { status: 1 } })).toBe(
        false
      );
      expect(isFinishedResponse({ code: 0, message: '', sid: '' })).toBe(false);
    });

    it('hasResultPayload 应该判断 data.result 是否存在', () => {
      expect(
        hasResultPayload({
          code: 0,
          message: '',
          sid: '',
          data: {
            status: 1,
            result: {
              sn: 1,
              ls: false,
              bg: 0,
              ed: 0,
              ws: [{ bg: 0, cw: [{ w: '测试' }] }],
            },
          },
        })
      ).toBe(true);
      expect(hasResultPayload({ code: 0, message: '', sid: '' })).toBe(false);
      expect(hasResultPayload({ code: 0, message: '', sid: '', data: { status: 0 } })).toBe(false);
    });
  });
});
