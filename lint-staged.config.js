export default {
  '*.{ts,tsx,js,jsx,json}': [
    () => 'pnpm typecheck', // 使用函数签名阻止传递文件参数
    () => 'pnpm lint',
    () => 'pnpm spellcheck',
    () => 'pnpm test',
  ],
};
