/**
 * ASR 准确性衡量模块
 * 实现字符错误率 (CER) 和准确率计算
 */

/**
 * 准确性结果
 */
export interface AccuracyResult {
  /** 准确率 (0-1) */
  accuracy: number;
  /** 字符错误率 (Character Error Rate) */
  cer: number;
  /** 详细信息 */
  details: {
    /** 原始文本 */
    expected: string;
    /** 识别结果 */
    actual: string;
    /** 正确字符数 */
    correct: number;
    /** 编辑距离（错误字符数） */
    editDistance: number;
    /** 替换操作数 */
    substitutions: number;
    /** 删除操作数 */
    deletions: number;
    /** 插入操作数 */
    insertions: number;
  };
}

/**
 * 使用动态规划计算 Levenshtein 编辑距离
 * @param expected 原始文本
 * @param actual 识别结果
 * @returns 编辑距离矩阵和操作统计
 */
function computeEditDistance(
  expected: string,
  actual: string
): { distance: number; substitutions: number; deletions: number; insertions: number } {
  const m = expected.length;
  const n = actual.length;

  // dp[i][j] 表示 expected[0..i-1] 转换到 actual[0..j-1] 的最小编辑距离
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  // 初始化：空字符串转换
  for (let i = 0; i <= m; i++) dp[i][0] = i; // 删除操作
  for (let j = 0; j <= n; j++) dp[0][j] = j; // 插入操作

  // 填充矩阵
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (expected[i - 1] === actual[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]; // 字符相同，无需操作
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // 删除
          dp[i][j - 1] + 1, // 插入
          dp[i - 1][j - 1] + 1 // 替换
        );
      }
    }
  }

  // 回溯计算操作类型
  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;

  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && expected[i - 1] === actual[j - 1]) {
      // 字符相同，无需操作
      i--;
      j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      // 替换操作
      substitutions++;
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      // 删除操作
      deletions++;
      i--;
    } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      // 插入操作
      insertions++;
      j--;
    } else {
      // 边界情况处理
      if (i > 0) {
        deletions++;
        i--;
      } else if (j > 0) {
        insertions++;
        j--;
      }
    }
  }

  return {
    distance: dp[m][n],
    substitutions,
    deletions,
    insertions,
  };
}

/**
 * 计算字符错误率 (CER)
 * CER = (S + D + I) / N
 * 其中 S=替换, D=删除, I=插入, N=原文本长度
 *
 * @param expected 原始文本
 * @param actual 识别结果
 * @returns 字符错误率 (0-1+)
 */
export function calculateCER(expected: string, actual: string): number {
  if (expected.length === 0) {
    return actual.length > 0 ? 1 : 0;
  }

  const { distance } = computeEditDistance(expected, actual);
  return distance / expected.length;
}

/**
 * 计算准确率
 * 准确率 = 1 - CER (限制在 0-1 范围内)
 *
 * @param expected 原始文本
 * @param actual 识别结果
 * @returns 准确率 (0-1)
 */
export function calculateAccuracy(expected: string, actual: string): number {
  const cer = calculateCER(expected, actual);
  return Math.max(0, 1 - cer);
}

/**
 * 计算完整的准确性结果
 *
 * @param expected 原始文本
 * @param actual 识别结果
 * @returns 完整的准确性结果
 */
export function calculateAccuracyResult(expected: string, actual: string): AccuracyResult {
  const editResult = computeEditDistance(expected, actual);
  const cer = expected.length > 0 ? editResult.distance / expected.length : 0;
  const accuracy = Math.max(0, 1 - cer);
  const correct = Math.max(0, expected.length - editResult.substitutions - editResult.deletions);

  return {
    accuracy,
    cer,
    details: {
      expected,
      actual,
      correct,
      editDistance: editResult.distance,
      substitutions: editResult.substitutions,
      deletions: editResult.deletions,
      insertions: editResult.insertions,
    },
  };
}

/**
 * 标准化文本用于比较
 * 移除标点、空格，转换为小写
 *
 * @param text 原始文本
 * @returns 标准化后的文本
 */
export function normalizeText(text: string): string {
  return text
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '') // 保留中文、英文、数字
    .toLowerCase();
}

/**
 * 计算标准化后的准确性
 * 先标准化文本再计算准确率
 *
 * @param expected 原始文本
 * @param actual 识别结果
 * @returns 准确性结果
 */
export function calculateNormalizedAccuracy(expected: string, actual: string): AccuracyResult {
  const normalizedExpected = normalizeText(expected);
  const normalizedActual = normalizeText(actual);

  return calculateAccuracyResult(normalizedExpected, normalizedActual);
}

/**
 * 批量计算准确性结果
 *
 * @param tests 测试对列表 [{ expected, actual }]
 * @returns 平均准确性和结果列表
 */
export function calculateBatchAccuracy(tests: Array<{ expected: string; actual: string }>): {
  avgAccuracy: number;
  avgCER: number;
  results: AccuracyResult[];
} {
  if (tests.length === 0) {
    return {
      avgAccuracy: 0,
      avgCER: 0,
      results: [],
    };
  }

  const results = tests.map(({ expected, actual }) =>
    calculateNormalizedAccuracy(expected, actual)
  );

  const avgAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0) / results.length;
  const avgCER = results.reduce((sum, r) => sum + r.cer, 0) / results.length;

  return {
    avgAccuracy,
    avgCER,
    results,
  };
}
