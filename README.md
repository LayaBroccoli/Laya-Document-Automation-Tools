# LayaAir 文档编写工具链

一套专为 LayaAir IDE 文档编写设计的自动化工具，支持 CDP 截图、元素查找、鼠标操作、原生菜单交互、GIF 录制。

## 前置要求

- **Node.js** >= 16.0.0
- **Windows 10/11**（依赖 PowerShell 和 Windows UI Automation）
- **LayaAir IDE** 启动时添加 `--remote-debugging-port=9222` 参数

## 快速开始

### 1. 安装依赖

```bash
cd tools
npm install
```

### 2. 启动 IDE

确保 LayaAir IDE 以远程调试模式启动：

```bash
# 方法1：修改快捷方式
# 在 IDE 快捷方式目标末尾添加：--remote-debugging-port=9222

# 方法2：命令行启动
"C:\path\to\LayaAir.exe" --remote-debugging-port=9222
```

### 3. 验证连接

```bash
node s.js find "Scene2D"
```

如果能看到 `Scene2D` 的位置信息，说明连接成功。

---

## 核心命令

### 截图

```bash
# CDP 全页截图（不含原生菜单）
node s.js shot output.png

# 裁剪区域
node s.js shot output.png --clip 0,400,200,120

# 裁剪 + 红框标注
node s.js shot output.png --clip 0,400,200,120 --mark 50,10,80,20

# 窗口截图（含原生菜单）
node s.js win output.png

# 窗口截图 + 标注
node s.js win output.png --mark 100,200,80,20
```

### 查找元素

```bash
# 查找任意文本元素
node s.js find "增加组件"

# 只在层级面板中查找
node s.js find "Player" --hierarchy

# 模糊匹配
node s.js find "Dodge" --partial
```

### 鼠标操作

```bash
# 左键点击
node s.js click "Player"

# 右键点击
node s.js rclick "Scene2D"
```

### 菜单栏按钮

```bash
# 列出所有菜单栏按钮
node s.js menubar

# 查找特定按钮
node s.js menubar "工具"

# 点击菜单栏按钮
node s.js menubar-click "工具"
```

### 原生菜单

```bash
# 列出当前可见的菜单项
node s.js menu

# 查找特定菜单项
node s.js menu "2D精灵"

# 点击菜单项
node s.js menu-click "2D精灵"

# 右键 → 菜单出现 → 标注截图 → 关闭菜单
node s.js rclick-menu "Scene2D" "创建2D精灵节点" output.png
```

### 游戏操作

```bash
# 执行 JS 表达式
node s.js game eval "Laya.stage.width"

# 游戏画面截图
node s.js game shot output.png

# 打印节点树
node s.js game tree

# 点击游戏画布
node s.js game click 667,340
```

### GIF 录制

```bash
# 录制游戏动图（自动捕获+编码）
node s.js gif output.gif --frames 60 --fps 15

# 从游戏 target 录制
node s.js gif output.gif --game --frames 45

# 裁剪区域录制
node s.js gif output.gif --crop 0,0,800,600 --fps 20
```

---

## 目录结构

```
tools/
├── s.js                  # 主入口（统一命令）
├── make_gif.js           # GIF 录制引擎
├── config.json           # 配置文件
├── package.json          # 依赖管理
├── README.md             # 本文档
├── install.bat           # 一键安装脚本
│
└── *.ps1                 # PowerShell 底层脚本
    ├── get_menubar.ps1       # 获取菜单栏按钮
    ├── find_menu.ps1         # 查找原生菜单项
    ├── fullscreen.ps1        # 全屏截图
    └── get_win_rect.ps1      # 获取窗口位置
```

---

## 常见问题

### IDE 连接不上

1. 确认 IDE 启动参数包含 `--remote-debugging-port=9222`
2. 在浏览器访问 `http://127.0.0.1:9222/json` 看是否有 targets
3. 检查端口是否被占用

### 找不到元素

1. 使用 `--partial` 进行模糊匹配
2. 使用 `--hierarchy` 限定层级面板
3. 先用 `node s.js find "xxx"` 查看所有匹配结果

### 菜单栏/原生菜单操作不生效

1. 确认 IDE 窗口标题包含默认名称 "aidoc" 或修改脚本中的 `$windowName`
2. 确认菜单已展开（菜单栏需先点击，原生菜单需先右键）
3. 检查 Windows 显示缩放是否为 100%

---

## 工作流示例

### 截取并标注一个按钮

```bash
# 1. 查找位置
node s.js find "增加组件"

# 2. 截图 + 标注
node s.js shot output.png --mark 1250,30,120,35
```

### 点击菜单打开面板并截图

```bash
# 1. 点击菜单栏按钮
node s.js menubar-click "工具"

# 2. 点击子菜单项
node s.js menu-click "制作图集"

# 3. 等待面板打开后截图
node s.js win output.png
```

### 录制游戏动图

```bash
# 自动：连续捕获帧 → ffmpeg 编码 → 输出 GIF
node s.js gif gameplay.gif --frames 45 --fps 15
```

---

## 高级用法

### 自定义配置

编辑 `config.json` 修改默认参数：

```json
{
  "cdpPort": 9222,
  "defaultTarget": "sceneEditor",
  "annotateColor": "#FF2020",
  "annotatePad": 8
}
```

### 在代码中使用

```javascript
const { CDP, annotate, getWindowRect } = require('./s.js');

// 连接 CDP
const cdp = await CDP.connect('sceneEditor');

// 执行表达式
const width = await cdp.eval('Laya.stage.width');

// 截图
const buf = await cdp.screenshot();
```

### 添加新命令

在 `s.js` 中添加：

```javascript
// 1. 定义命令函数
async function cmdMyCommand(args) {
    const param = args._[1];
    // ...你的逻辑
}

// 2. 在 main() switch 中注册
case 'my-command': return cmdMyCommand(args);

// 3. 更新使用说明
```

---

## 依赖说明

| 依赖 | 用途 |
|------|------|
| ws | CDP WebSocket 连接 |
| sharp | 图片处理（裁剪、标注、格式转换） |
| @nut-tree/nut-js | 真实鼠标控制（点击、拖拽） |

---

## 扩展指南

### 添加新的 PowerShell 操作

1. 在 `tools/` 目录创建 `.ps1` 文件
2. 使用 `runPS()` 调用：

```javascript
function runPS(script, args = '') {
    const ps = path.join(__dirname, script);
    return execSync(`cmd /c "chcp 65001 >nul && powershell -NoProfile -ExecutionPolicy Bypass -File "${ps}" ${args}"`,
        { encoding: 'utf8', timeout: 8000 }).trim();
}

// 调用
const result = runPS('my_script.ps1', '-param "value"');
```

### 添加新的 CDP Target

```javascript
// 连接自定义 target
const cdp = await CDP.connect('myTarget');
```

---

## 注意事项

1. **IDE 版本**：工具在 LayaAir 3.4+ 上测试通过
2. **屏幕缩放**：Windows 显示缩放建议设为 100%
3. **多显示器**：IDE 需在主显示器上运行
4. **游戏 target**：游戏预览窗口标题需包含 "game.html"

---

## 更新日志

### v1.1.0 (2025-03-03)
- 新增菜单栏按钮操作（menubar、menubar-click）
- 新增 GIF 录制命令（gif）
- 优化工具结构，删除冗余文件
- 统一 PowerShell 脚本调用方式

### v1.0.0 (2024-03)
- 初始版本
- 统一 s.js 命令入口
- 支持 CDP 截图、窗口截图、元素查找、鼠标操作
- 原生菜单交互支持
- 游戏操作支持
