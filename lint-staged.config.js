export default {
  '*.{ts,tsx,js,jsx}': [
    () => 'pnpm typecheck', // 使用函数签名阻止传递文件参数
    () => 'pnpm spellcheck',
    () => 'pnpm test',
  ],
};
