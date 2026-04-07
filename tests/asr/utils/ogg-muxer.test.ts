import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { createEosPage, createOggMuxer, createOggMuxerWithEos } from '@/asr/utils/ogg-muxer.js';

describe('createOggMuxer', () => {
  it('应该按正确顺序产出页面（OpusHead -> OpusTags -> 数据）', async () => {
    async function* packets() {
      yield Buffer.from([1, 2, 3, 4]);
      yield Buffer.from([5, 6, 7, 8]);
    }

    const pages: Buffer[] = [];
    for await (const page of createOggMuxer(packets())) {
      pages.push(page);
    }

    expect(pages.length).toBe(4); // OpusHead + OpusTags + 2 data pages

    // 第一页: OpusHead (BOS)
    expect(pages[0].slice(0, 4).toString()).toBe('OggS');
    // header type: BOS flag (0x02)
    expect((pages[0][5] & 0x02) !== 0).toBe(true);

    // 第二页: OpusTags
    expect(pages[1].slice(0, 4).toString()).toBe('OggS');
    // header type: no BOS, no EOS
    expect((pages[1][5] & 0x02) === 0).toBe(true);
    expect((pages[1][5] & 0x04) === 0).toBe(true);

    // OpusHead 数据应该以 "OpusHead" 开头
    const opusHeadData = getPageData(pages[0]);
    expect(opusHeadData.slice(0, 8).toString()).toBe('OpusHead');

    // OpusTags 数据应该以 "OpusTags" 开头
    const opusTagsData = getPageData(pages[1]);
    expect(opusTagsData.slice(0, 8).toString()).toBe('OpusTags');
  });

  it('应该使用自定义选项', async () => {
    async function* packets() {
      yield Buffer.from([1, 2, 3]);
    }

    const pages: Buffer[] = [];
    for await (const page of createOggMuxer(packets(), {
      sampleRate: 8000,
      channels: 2,
      encoder: 'test-encoder',
    })) {
      pages.push(page);
    }

    // OpusHead 页面中包含采样率信息
    const opusHeadData = getPageData(pages[0]);
    const sampleRate = opusHeadData.readUInt32LE(12);
    expect(sampleRate).toBe(8000);
    expect(opusHeadData[9]).toBe(2); // channels
  });

  it('空数据包流应该只产出 OpusHead 和 OpusTags', async () => {
    async function* packets() {
      // 不 yield 任何数据
    }

    const pages: Buffer[] = [];
    for await (const page of createOggMuxer(packets())) {
      pages.push(page);
    }

    expect(pages).toHaveLength(2); // 仅 OpusHead + OpusTags
  });
});

describe('createEosPage', () => {
  it('应该创建带 EOS 标志的空页面', () => {
    const eos = createEosPage(12345, 10, 1000n);
    expect(eos.slice(0, 4).toString()).toBe('OggS');
    expect((eos[5] & 0x04) !== 0).toBe(true); // EOS flag
    // 序列号
    expect(eos.readUInt32LE(14)).toBe(12345);
  });
});

describe('createOggMuxerWithEos', () => {
  it('应该提供 serialNumber 和 finish 方法', async () => {
    async function* packets() {
      yield Buffer.from([1, 2, 3]);
    }

    const muxer = createOggMuxerWithEos(packets());
    expect(muxer.serialNumber).toBeDefined();
    expect(typeof muxer.serialNumber).toBe('number');
    expect(typeof muxer.finish).toBe('function');
  });

  it('调用 finish 后应该产出 EOS 页面', async () => {
    // 使用延时让 finish 在 for-await 循环中被检测到
    let packetYielded = false;
    async function* packets() {
      yield Buffer.from([1, 2, 3]);
      // 持续产出直到 finish 被调用
      while (!packetYielded) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      yield Buffer.from([4, 5, 6]);
    }

    const muxer = createOggMuxerWithEos(packets());

    const pages: Buffer[] = [];
    const collectPromise = (async () => {
      for await (const page of muxer.stream) {
        pages.push(page);
        // 在收到第一个数据页（OpusHead + OpusTags + 1 data = index 2）后调用 finish
        if (pages.length === 3) {
          muxer.finish();
          packetYielded = true;
        }
      }
    })();

    await collectPromise;

    // 最后一页应该是 EOS
    const lastPage = pages[pages.length - 1];
    expect((lastPage[5] & 0x04) !== 0).toBe(true);
  });
});

// 辅助函数：从 OGG 页面中提取数据
function getPageData(page: Buffer): Buffer {
  const numSegments = page[26];
  const segmentTableOffset = 27;
  let dataSize = 0;
  for (let i = 0; i < numSegments; i++) {
    dataSize += page[segmentTableOffset + i];
  }
  const dataOffset = 27 + numSegments;
  return page.slice(dataOffset, dataOffset + dataSize);
}
