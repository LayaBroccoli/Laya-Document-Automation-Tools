/**
 * planner.js — 智能文档步骤规划器
 *
 * 根据MCP查询结果生成可执行的文档步骤
 */

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────
// 预定义模板
// ─────────────────────────────────────────────────────────────

const TEMPLATES = {
    // 组件入门教程模板
    componentTutorial: [
        {
            step: 1,
            title: '创建节点',
            desc: '在层级面板中右键Scene2D，选择对应的节点类型',
            action: 'createNode',
            needScreenshot: true,
            screenshotPhase: 'before' // 操作前截图
        },
        {
            step: 2,
            title: '添加组件',
            desc: '选中节点，在属性面板点击"增加组件"，选择目标组件',
            action: 'addComponent',
            needScreenshot: true,
            screenshotPhase: 'after',
            needGif: true // 拖拽操作需要动图
        },
        {
            step: 3,
            title: '设置属性',
            desc: '在属性面板中设置组件的关键属性',
            action: 'setProperties',
            needScreenshot: true,
            screenshotPhase: 'after'
        },
        {
            step: 4,
            title: '运行验证',
            desc: '点击运行按钮，查看效果',
            action: 'run',
            needScreenshot: true,
            needGif: true
        }
    ],

    // 功能实现教程模板
    featureTutorial: [
        {
            step: 1,
            title: '准备场景',
            desc: '创建项目并打开默认场景',
            action: 'prepareScene',
            needScreenshot: false
        },
        {
            step: 2,
            title: '创建脚本',
            desc: '新建脚本文件，编写代码',
            action: 'createScript',
            needScreenshot: true,
            screenshotPhase: 'after'
        },
        {
            step: 3,
            title: '挂载脚本',
            desc: '将脚本挂载到节点上',
            action: 'attachScript',
            needScreenshot: true,
            needGif: true
        },
        {
            step: 4,
            title: '运行测试',
            desc: '运行并验证功能',
            action: 'run',
            needScreenshot: true,
            needGif: true
        }
    ],

    // API文档模板
    apiDoc: [
        {
            step: 1,
            title: '组件概述',
            desc: '说明组件的用途和适用场景',
            action: 'describe',
            content: 'overview'
        },
        {
            step: 2,
            title: '属性列表',
            desc: '列出所有属性及其说明',
            action: 'listProperties',
            content: 'properties'
        },
        {
            step: 3,
            title: '使用示例',
            desc: '展示常见的使用方式',
            action: 'showExample',
            content: 'example',
            needScreenshot: true
        },
        {
            step: 4,
            title: '常见问题',
            desc: '解答使用中的常见疑问',
            action: 'qa',
            content: 'faq'
        }
    ]
};

// ─────────────────────────────────────────────────────────────
// 步骤规划器
// ─────────────────────────────────────────────────────────────

class StepPlanner {
    constructor() {
        this.mcpClient = null; // MCP客户端
    }

    /**
     * 根据用户输入和MCP数据生成执行计划
     */
    async plan(input, mcpData) {
        const intent = this.detectIntent(input);
        const topic = this.extractTopic(input);

        console.log(`📋 规划: ${topic} (${intent})`);

        // 根据意图选择模板
        let template = this.selectTemplate(intent, topic, mcpData);

        // 填充模板细节
        const plan = this.fillTemplate(template, topic, mcpData);

        // 优化步骤顺序
        const optimized = this.optimizeSteps(plan);

        return {
            topic,
            intent,
            steps: optimized,
            mcpData
        };
    }

    detectIntent(input) {
        if (/组件|属性|API|文档/.test(input)) return 'api';
        if (/实现|功能|效果/.test(input)) return 'feature';
        return 'tutorial';
    }

    extractTopic(input) {
        return input
            .replace(/^(写一个|写|生成|创建|关于|如何|怎么)/, '')
            .replace(/(的文档|的教程|入门|实现|制作|创建|添加)/g, '')
            .trim();
    }

    selectTemplate(intent, topic, mcpData) {
        // 如果MCP查询到了组件信息，使用组件教程模板
        if (mcpData?.schema) {
            return TEMPLATES.componentTutorial;
        }

        // 根据意图选择
        switch (intent) {
            case 'api': return TEMPLATES.apiDoc;
            case 'feature': return TEMPLATES.featureTutorial;
            default: return TEMPLATES.componentTutorial;
        }
    }

    fillTemplate(template, topic, mcpData) {
        return template.map((step, index) => {
            const filled = { ...step };

            // 替换占位符
            filled.desc = filled.desc
                .replace(/目标组件/g, topic)
                .replace(/对应组件/g, topic);

            // 从MCP数据中填充内容
            if (filled.content && mcpData) {
                filled.contentData = this.extractContent(filled.content, mcpData);
            }

            return filled;
        });
    }

    extractContent(type, mcpData) {
        switch (type) {
            case 'overview':
                return mcpData.schema?.description || '';
            case 'properties':
                return mcpData.schema?.properties || [];
            case 'example':
                return mcpData.examples || [];
            default:
                return null;
        }
    }

    optimizeSteps(plan) {
        // 合并相似的连续步骤
        const optimized = [];
        let prev = null;

        for (const step of plan) {
            if (prev && this.canMerge(prev, step)) {
                // 合并到上一步
                prev.title += `、${step.title}`;
                if (step.needGif) prev.needGif = true;
            } else {
                optimized.push(step);
                prev = step;
            }
        }

        // 确保关键步骤都有截图
        optimized.forEach((step, index) => {
            if (!step.needScreenshot && index > 0 && index < optimized.length - 1) {
                step.needScreenshot = true; // 中间步骤默认截图
            }
        });

        return optimized;
    }

    canMerge(step1, step2) {
        // 可以合并的条件：同一类操作、不需要独立截图
        const mergeableActions = ['createNode', 'addComponent', 'setProperties'];
        return mergeableActions.includes(step1.action) &&
               mergeableActions.includes(step2.action) &&
               !step2.needGif;
    }

    /**
     * 生成每步的详细操作指令
     */
    generateInstructions(step, mcpData) {
        const instructions = {
            ide: [],      // IDE操作
            screenshot: [], // 截图指令
            content: []   // 文档内容
        };

        switch (step.action) {
            case 'createNode':
                instructions.ide.push(this._getCreateNodeInstruction(step, mcpData));
                break;
            case 'addComponent':
                instructions.ide.push(this._getAddComponentInstruction(step, mcpData));
                instructions.screenshot.push({ type: 'menu', target: '增加组件' });
                instructions.screenshot.push({ type: 'panel', target: '组件列表' });
                break;
            case 'setProperties':
                instructions.content.push(this._generatePropertyTable(mcpData));
                instructions.screenshot.push({ type: 'panel', target: '属性面板' });
                break;
            case 'run':
                instructions.ide.push('点击运行按钮');
                instructions.screenshot.push({ type: 'game' });
                if (step.needGif) {
                    instructions.screenshot.push({ type: 'gif_game', duration: 3000 });
                }
                break;
        }

        return instructions;
    }

    _getCreateNodeInstruction(step, mcpData) {
        // 根据组件类型推断要创建的节点
        if (mcpData.schema?.category === '3D') {
            return '右键Scene3D，选择3D节点 -> 3D精灵';
        } else {
            return '右键Scene2D，选择2D节点 -> 基础文本';
        }
    }

    _getAddComponentInstruction(step, mcpData) {
        const compName = step.desc.match(/选择(\S+)/)?.[1] || '目标组件';
        return `选中节点，在属性面板点击"增加组件"，选择${compName}`;
    }

    _generatePropertyTable(mcpData) {
        if (!mcpData.schema?.properties) return '';

        const props = mcpData.schema.properties;
        let table = '| 属性 | 类型 | 默认值 | 说明 |\n';
        table += '|------|------|--------|------|\n';

        for (const [name, prop] of Object.entries(props)) {
            table += `| ${name} | ${prop.type || ''} | ${prop.default || ''} | ${prop.tips || ''} |\n`;
        }

        return table;
    }
}

// ─────────────────────────────────────────────────────────────
// 导出
// ─────────────────────────────────────────────────────────────

module.exports = StepPlanner;
