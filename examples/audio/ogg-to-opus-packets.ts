/**
 * OGG 转 Opus 数据包示例
 * 演示如何使用 oggToOpusPackets 工具函数从 OGG 文件提取 Opus 数据包
 */
import path from 'node:path';
import { getScriptMeta } from '../utils/common';
import { oggToOpusPackets } from '../utils/ogg-to-opus-packets';

const { __dirname } = getScriptMeta(import.meta.url);

async function main() {
  const oggFile = path.join(__dirname, '..', 'output', 'doubao-tts-demo.ogg');
  const outputDir = path.join(__dirname, '..', 'output', 'doubao-tts-demo-opus-packets');

  console.log('开始提取 Opus 数据包...');
  console.log(`输入文件: ${oggFile}`);
  console.log(`输出目录: ${outputDir}`);

  try {
    const count = await oggToOpusPackets(oggFile, { outputDir });
    console.log(`\n成功提取 ${count} 个 Opus 数据包`);
    console.log(`输出目录: ${outputDir}`);
  } catch (error) {
    console.error('提取失败:', error);
    process.exit(1);
  }
}

main();
