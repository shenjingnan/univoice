# 过度工程化检查示例

本文档包含务实开发原则的代码示例，帮助识别和避免过度设计。

## 1. 过度抽象示例

### 不必要的泛型抽象

```typescript
// ❌ 过度抽象
abstract class BaseService<T, U, V> {
  abstract execute(request: T): Promise<U>;
  abstract validate(request: T): V;
  abstract handleError(error: Error): void;
}

// 使用时难以理解
class UserService extends BaseService<UserRequest, UserResponse, ValidationResult> {
  async execute(request: UserRequest): Promise<UserResponse> {
    // 实现
  }
  validate(request: UserRequest): ValidationResult {
    // 实现
  }
  handleError(error: Error): void {
    // 实现
  }
}
```

### 推荐方式

```typescript
// ✅ 简单直接
class UserService {
  async createUser(userData: UserData): Promise<User> {
    // 直接实现功能
  }
}
```

---

## 2. 复杂度指标示例

### 合理的 vs 过度的复杂度

```typescript
// 复杂度检查清单
interface ComplexityChecklist {
  // ✅ 合理的复杂度
  hasClearPurpose: boolean;           // 有明确的目的
  solvesRealProblem: boolean;         // 解决实际问题
  necessaryAbstraction: boolean;      // 必要的抽象
  maintainableCode: boolean;          // 可维护的代码

  // ❌ 过度的复杂度
  futureProofing: boolean;            // 为未来过度设计
  unnecessaryPatterns: boolean;        // 不必要的设计模式
  overConfiguration: boolean;          // 过度配置
  prematureOptimization: boolean;     // 过早优化
}
```

### 评估标准

| 指标 | 合理 | 过度 |
|------|------|------|
| 抽象层次 | 解决问题所需 | 为了扩展性 |
| 配置复杂度 | 必要的配置 | 大量可选配置 |
| 错误处理 | 实用有效 | 过度分类 |
| 性能优化 | 实测瓶颈 | 预测性优化 |

---

## 3. 实用性示例

### 过度的错误处理

```typescript
// ❌ 过度的错误处理
try {
  const result = await apiCall();
  if (result !== null && result !== undefined) {
    if (typeof result === 'object' && result.data) {
      if (Array.isArray(result.data) && result.data.length > 0) {
        // 过度嵌套的检查
      }
    }
  }
} catch (error) {
  if (error instanceof NetworkError) {
    // 详细的错误分类
    if (error.statusCode === 404) {
      // 更详细的分类
    } else if (error.statusCode === 500) {
      // ...
    }
  } else if (error instanceof ValidationError) {
    // 详细的错误分类
    if (error.field) {
      // ...
    }
  } else if (error instanceof TimeoutError) {
    // ...
  }
  // 无穷无尽
}
```

### 实用的错误处理

```typescript
// ✅ 实用的错误处理
try {
  const result = await apiCall();
  return result;
} catch (error) {
  console.error('API调用失败:', error);
  throw new Error('服务不可用');
}
```

---

## 4. 简单直接的设计示例

### 推荐：简洁的配置管理

```typescript
// ✅ 推荐的简单设计
class ConfigManager {
  private config: Config;

  constructor(configPath: string) {
    this.config = this.loadConfig(configPath);
  }

  get(key: string): any {
    return this.config[key];
  }

  set(key: string, value: any): void {
    this.config[key] = value;
  }

  private loadConfig(path: string): Config {
    return JSON.parse(fs.readFileSync(path, 'utf-8'));
  }
}
```

---

## 5. 避免的过度设计示例

### 不必要的抽象层

```typescript
// ❌ 避免的过度设计
abstract class ConfigurationProvider<T extends ConfigurationOptions> {
  abstract getConfiguration(): Promise<Configuration<T>>;
  abstract validateConfiguration(config: Configuration<T>): ValidationResult;
  abstract transformConfiguration(config: Configuration<T>): TransformedConfiguration<T>;
  abstract watchConfiguration(callback: (config: Configuration<T>) => void): void;
  abstract resetConfiguration(): void;
}

class JSONConfigurationProvider<T extends JSONConfigurationOptions>
  extends ConfigurationProvider<T> {
  // 过度复杂的实现
  async getConfiguration(): Promise<Configuration<T>> {
    // 实现
  }
  validateConfiguration(config: Configuration<T>): ValidationResult {
    // 实现
  }
  transformConfiguration(config: Configuration<T>): TransformedConfiguration<T> {
    // 实现
  }
  watchConfiguration(callback: (config: Configuration<T>) => void): void {
    // 实现
  }
  resetConfiguration(): void {
    // 实现
  }
}

class YAMLConfigurationProvider<T extends YAMLConfigurationOptions>
  extends ConfigurationProvider<T> {
  // 又一个过度实现
}
```

---

## 快速检查清单

在代码审查时，快速检查是否存在过度设计：

- [ ] 代码是否为了抽象而抽象？
- [ ] 是否在解决"未来可能需要"的问题？
- [ ] 设计模式是否真正必要？
- [ ] 配置是否过于复杂？
- [ ] 错误处理是否过度分类？
- [ ] 性能优化是否有实际测量依据？
