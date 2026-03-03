# 文档自动生成工作流

一句话生成带图片和动态图的完整文档。

## 快速开始

```bash
# 生成组件教程
node workflow.js "写一个PhysicsCollider组件的教程"

# 生成功能实现文档
node workflow.js "实现角色跳跃功能"

# 只生成计划不执行
node workflow.js "RigidBody入门" --dry-run

# 指定输出目录
node workflow.js "动画基础" --output docs/animation/
```

## 文件结构

```
laya-doc-tools/
├── workflow.js      # 主入口，工作流编排
├── planner.js       # 步骤规划器
├── executor.js      # 步骤执行器
├── generator.js     # 文档生成器
├── s.js            # 截图/操作工具
├── make_gif.js     # GIF录制
└── WORKFLOW.md     # 工作流设计文档
```

## 工作流流程

```
用户输入 "写一个PhysicsCollider教程"
    ↓
意图识别 → tutorial (教程类)
    ↓
主题提取 → PhysicsCollider
    ↓
MCP查询 → 获取组件schema、属性、示例
    ↓
生成计划 → 4个步骤：创建节点→添加组件→设置属性→运行
    ↓
执行步骤 → 在IDE中操作，每步截图/录GIF
    ↓
生成文档 → 按模板输出markdown + 图片
```

## 支持的任务类型

| 类型 | 触发词 | 输出 |
|------|--------|------|
| 组件教程 | "XXX组件入门"、"如何使用XXX" | 操作步骤 + 截图 + 动图 |
| 功能实现 | "实现XXX"、"XXX怎么做" | 代码编写 + 运行验证 |
| API文档 | "XXX组件文档" | 属性表格 + 使用示例 |

## 输出示例

输入：`"写一个Text组件的教程"`

输出：
```
doc-output/
├── readme.md          # 生成的文档
└── img/
    ├── 1-before.png   # 创建节点前
    ├── 1-after.png    # 创建节点后
    ├── 2.gif          # 添加组件动图
    ├── 3.png          # 属性面板
    └── 4.gif          # 运行效果
```

## 使用规则

### 1. 语言风格

- 有人情味，像和初学者对话
- 不用emoji
- 每步都有"这一步的成果"总结
- 有"下一步"引出

### 2. 截图规范

- **静态图**：关键步骤的状态
- **动图**：拖拽、连续操作、运行效果
- **标注**：用红框标注重要区域
- **命名**：{章节}-{阶段}.png

### 3. 文档结构

教程类：
```markdown
# 标题
> Version >= LayaAir X.X

开篇引入

## 1、步骤名
操作描述
截图
注意事项

## 这一步的成果
总结
```

API类：
```markdown
# 组件名

## 概述

## 属性列表
| 属性 | 类型 | 说明 |

## 使用示例
代码 + 效果图
```

## 下一步优化

- [ ] 集成MCP客户端
- [ ] 支持多章节长文档
- [ ] 自动更新已有文档
- [ ] 交互式编辑模式
- [ ] 版本控制集成
