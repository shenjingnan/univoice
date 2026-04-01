/**
 * Opus 数据包合并为 OGG 文件示例
 * 演示如何使用 opusPacketsToOgg 工具函数将多个 Opus 数据包合并成 OGG 文件
 */
import 'dotenv/config';
import path from 'node:path';
import { getScriptMeta } from '../utils/common';
import { opusPacketsToOgg } from '../utils/opus-packets-to-ogg';

const { __dirname } = getScriptMeta(import.meta.url);

async function main() {
  // 输入目录：包含排序好的 Opus 数据包
  const inputDir = path.join(__dirname, '..', 'output', 'doubao-tts-demo-opus-packets');
  // 输出文件：合并后的 OGG 文件
  const outputFile = path.join(__dirname, '..', 'output', 'merged-from-opus-packets.ogg');

  console.log('=== Opus 数据包合并为 OGG 文件 ===');
  console.log(`输入目录: ${inputDir}`);
  console.log(`输出文件: ${outputFile}`);
  console.log('参数: 16kHz, mono, 60ms frames\n');

  try {
    const count = await opusPacketsToOgg(inputDir, outputFile, {
      sampleRate: 16000,
      channels: 1,
      frameSizeMs: 60,
      encoder: 'univoice',
    });

    console.log(`\n=== 完成 ===`);
    console.log(`合并了 ${count} 个 Opus 数据包`);
    console.log(`\n验证命令:`);
    console.log(`  ffprobe ${outputFile}`);
    console.log(`  ffplay -autoexit ${outputFile}`);
  } catch (error) {
    console.error('合并失败:', error);
    process.exit(1);
  }
}

main();
