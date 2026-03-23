/**
 * Benchmark CLI 主入口
 * 用于运行性能测试并生成报告
 */
import { analyze } from './analyze';
import { run } from './run';

/**
 * 显示主帮助信息
 */
function showHelp(): void {
  console.log(`
用法: pnpm benchmark <command> -- [选项]

命令:
  run       执行性能测试
  analyze   分析已存储的测试结果

选项:
  -h, --help    显示帮助信息

示例:
  pnpm benchmark run -- -p qwen -t asr     # 运行 qwen ASR 测试
  pnpm benchmark analyze -- -p qwen        # 分析 qwen 的测试结果
  pnpm benchmark                            # 运行测试并分析（兼容模式）

详细帮助:
  pnpm benchmark run -- --help
  pnpm benchmark analyze -- --help
`);
}

/**
 * 解析命令行参数
 */
function parseMainArgs(): {
  command: 'run' | 'analyze' | 'default';
  help: boolean;
} {
  const args = process.argv.slice(2);

  // 检查是否是子命令
  if (args[0] === 'run') {
    // 移除 'run' 参数，让 run.ts 解析剩余参数
    process.argv = [process.argv[0], process.argv[1], ...args.slice(1)];
    return { command: 'run', help: false };
  }

  if (args[0] === 'analyze') {
    // 移除 'analyze' 参数，让 analyze.ts 解析剩余参数
    process.argv = [process.argv[0], process.argv[1], ...args.slice(1)];
    return { command: 'analyze', help: false };
  }

  // 检查是否请求帮助
  if (args.includes('-h') || args.includes('--help')) {
    return { command: 'default', help: true };
  }

  // 兼容模式：无子命令时运行测试并分析
  return { command: 'default', help: false };
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const { command, help } = parseMainArgs();

  if (help) {
    showHelp();
    process.exit(0);
  }

  switch (command) {
    case 'run':
      await run();
      break;

    case 'analyze':
      await analyze();
      break;

    case 'default':
      // 兼容模式：运行测试并分析
      console.log('📋 兼容模式: 运行测试并分析结果\n');
      console.log('💡 提示: 使用 "pnpm benchmark run" 和 "pnpm benchmark analyze" 分开执行\n');
      await run();
      console.log('\n---\n');
      await analyze();
      break;
  }
}

// 运行
main().catch((error) => {
  console.error('执行失败:', error);
  process.exit(1);
});
