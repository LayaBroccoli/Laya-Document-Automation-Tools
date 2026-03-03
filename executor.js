/**
 * executor.js — 步骤执行器
 *
 * 根据规划执行IDE操作、截图、录GIF
 */

const { execSync } = require('child_process');
const path = require('path');

const TOOLS = __dirname;

class StepExecutor {
    constructor(options = {}) {
        this.scriptsPath = options.scriptsPath || TOOLS;
        this.imgDir = options.imgDir || path.join(TOOLS, '../temp/img');
        this.dryRun = options.dryRun || false;
    }

    /**
     * 执行单个步骤
     */
    async execute(step, context) {
        console.log(`   ⚡ 步骤${step.step}: ${step.title}`);

        const result = {
            step: step.step,
            title: step.title,
            images: [],
            gifs: [],
            content: []
        };

        // 1. 执行IDE操作
        if (step.action && !this.dryRun) {
            await this._executeIDEAction(step, context);
        }

        // 2. 截图（操作前）
        if (step.needScreenshot && step.screenshotPhase === 'before') {
            const img = await this._capture(step.step, 'before');
            result.images.push(img);
        }

        // 3. 执行具体操作
        if (step.action && !this.dryRun) {
            await this._performAction(step, context);
        }

        // 4. 截图（操作后）
        if (step.needScreenshot && (step.screenshotPhase !== 'before')) {
            const img = await this._capture(step.step, 'after');
            result.images.push(img);
        }

        // 5. 录制动图
        if (step.needGif) {
            const gif = await this._recordGif(step);
            result.gifs.push(gif);
        }

        // 6. 生成文档内容
        if (step.contentData) {
            result.content.push(this._generateContent(step, context));
        }

        return result;
    }

    /**
     * 执行IDE操作
     */
    async _executeIDEAction(step, context) {
        const instructions = this._getInstructions(step, context);
        for (const inst of instructions.ide) {
            this._runCommand(inst);
        }
    }

    /**
     * 执行具体操作
     */
    async _performAction(step, context) {
        switch (step.action) {
            case 'createNode':
                await this._createNode(step, context);
                break;
            case 'addComponent':
                await this._addComponent(step, context);
                break;
            case 'setProperties':
                await this._setProperties(step, context);
                break;
            case 'run':
                await this._runGame(step, context);
                break;
        }
    }

    /**
     * 创建节点
     */
    async _createNode(step, context) {
        // 通过MCP创建节点
        // context.mcp.createNode(...)
        console.log(`      → 创建节点`);
    }

    /**
     * 添加组件
     */
    async _addComponent(step, context) {
        // 通过MCP添加组件
        console.log(`      → 添加组件`);
    }

    /**
     * 设置属性
     */
    async _setProperties(step, context) {
        // 通过MCP设置属性
        console.log(`      → 设置属性`);
    }

    /**
     * 运行游戏
     */
    async _runGame(step, context) {
        // 通过MCP运行
        console.log(`      → 运行游戏`);
        // 等待游戏启动
        await this._sleep(2000);
    }

    /**
     * 截图
     */
    async _capture(step, phase) {
        const filename = `${step}-${phase}.png`;
        const filepath = path.join(this.imgDir, filename);

        if (this.dryRun) {
            console.log(`      [DRY] 截图: ${filename}`);
            return filename;
        }

        // 调用s.js截图
        try {
            this._runSJS(['win', filepath, '--crop', '0,0,1334,750']);
            console.log(`      ✓ 截图: ${filename}`);
            return filename;
        } catch (e) {
            console.error(`      ✗ 截图失败: ${e.message}`);
            return null;
        }
    }

    /**
     * 录制GIF
     */
    async _recordGif(step) {
        const filename = `${step.step}.gif`;
        const filepath = path.join(this.imgDir, filename);

        if (this.dryRun) {
            console.log(`      [DRY] 录GIF: ${filename}`);
            return filename;
        }

        try {
            // 录制60帧，15fps
            this._runSJS(['gif', filepath, '--frames', '60', '--fps', '15']);
            console.log(`      ✓ 录GIF: ${filename}`);
            return filename;
        } catch (e) {
            console.error(`      ✗ 录GIF失败: ${e.message}`);
            return null;
        }
    }

    /**
     * 生成文档内容
     */
    _generateContent(step, context) {
        let content = `### ${step.title}\n\n`;
        content += `${step.desc}\n\n`;

        // 插入截图引用
        if (step.needScreenshot) {
            content += `![](img/${step}-${step.screenshotPhase || 'after'}.png)\n\n`;
            content += `（图${step.step}）${step.title}\n\n`;
        }

        // 插入动图引用
        if (step.needGif) {
            content += `![](img/${step}.gif)\n\n`;
            content += `（动图${step.step}）${step.title}演示\n\n`;
        }

        return content;
    }

    /**
     * 获取操作指令
     */
    _getInstructions(step, context) {
        return {
            ide: [],
            screenshot: []
        };
    }

    /**
     * 调用s.js
     */
    _runSJS(args) {
        const cmd = `node "${path.join(this.scriptsPath, 's.js')}" ${args.join(' ')}`;
        return execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    }

    /**
     * 运行命令
     */
    _runCommand(cmd) {
        if (this.dryRun) {
            console.log(`      [DRY] ${cmd}`);
            return;
        }
        execSync(cmd, { encoding: 'utf8', timeout: 10000 });
    }

    /**
     * 延时
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = StepExecutor;
