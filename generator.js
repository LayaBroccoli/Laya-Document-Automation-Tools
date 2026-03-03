/**
 * generator.js — 文档生成器
 *
 * 根据执行结果生成符合规范的markdown文档
 */

const fs = require('fs');
const path = require('path');

class DocumentGenerator {
    constructor(options = {}) {
        this.style = options.style || 'tutorial'; // tutorial | api
        this.version = options.version || '3.4';
    }

    /**
     * 生成完整文档
     */
    generate(plan, executionResults) {
        if (plan.intent === 'api') {
            return this._generateAPIDoc(plan, executionResults);
        } else {
            return this._generateTutorialDoc(plan, executionResults);
        }
    }

    /**
     * 生成教程类文档
     */
    _generateTutorialDoc(plan, executionResults) {
        let content = '';

        // 标题
        content += `# ${plan.topic}\n\n`;
        content += `> Version >= LayaAir ${this.version}\n\n`;

        // 开篇
        content += this._generateIntro(plan);

        // 章节内容
        const steps = plan.steps;
        executionResults.forEach((result, index) => {
            const step = steps[index];
            content += this._generateStepSection(step, result, index + 1);
        });

        // 成果总结
        content += this._generateSummary(plan);

        return content;
    }

    /**
     * 生成API类文档
     */
    _generateAPIDoc(plan, executionResults) {
        let content = '';

        // 标题
        content += `# ${plan.topic}组件\n\n`;

        // 概述
        content += `## 概述\n\n`;
        content += `${plan.mcpData?.schema?.description || ''}\n\n`;

        // 属性列表
        if (plan.mcpData?.schema?.properties) {
            content += `## 属性列表\n\n`;
            content += this._generatePropertyTable(plan.mcpData.schema.properties);
        }

        // 使用示例
        content += `## 使用示例\n\n`;
        executionResults.forEach((result, index) => {
            if (result.content.length) {
                content += result.content.join('\n\n');
            }
        });

        return content;
    }

    /**
     * 生成开篇
     */
    _generateIntro(plan) {
        const intros = {
            tutorial: `这一章我们来学习${plan.topic}的基本用法。\n\n`,
            feature: `这一章我们来实现${plan.topic}功能。\n\n`,
            default: `这一章我们来了解${plan.topic}。\n\n`
        };
        return intros[plan.intent] || intros.default;
    }

    /**
     * 生成步骤章节
     */
    _generateStepSection(step, result, chapterNum) {
        let content = `## ${chapterNum}、${step.title}\n\n`;
        content += `${step.desc}\n\n`;

        // 插入图片
        if (result.images && result.images.length) {
            result.images.forEach((img, imgIndex) => {
                const [stepNum, phase] = img.replace('.png', '').split('-');
                content += `![](img/${img})\n\n`;
                content += `（图${chapterNum}-${imgIndex + 1}）${step.title}\n\n`;
            });
        }

        // 插入动图
        if (result.gifs && result.gifs.length) {
            result.gifs.forEach(gif => {
                content += `![](img/${gif})\n\n`;
                content += `（动图${chapterNum}）${step.title}演示\n\n`;
            });
        }

        // 插入代码
        if (step.code) {
            content += '```typescript\n';
            content += step.code;
            content += '\n```\n\n';
        }

        // 注意事项
        if (step.note) {
            content += `> ${step.note}\n\n`;
        }

        return content;
    }

    /**
     * 生成属性表格
     */
    _generatePropertyTable(properties) {
        if (!properties || !Object.keys(properties).length) {
            return '暂无属性\n\n';
        }

        let table = '| 属性 | 类型 | 默认值 | 说明 |\n';
        table += '|------|------|--------|------|\n';

        for (const [name, prop] of Object.entries(properties)) {
            const type = prop.type || '';
            const defaultValue = prop.default !== undefined ? prop.default : '-';
            const tips = prop.tips || '';
            table += `| ${name} | ${type} | ${defaultValue} | ${tips} |\n`;
        }

        return table + '\n';
    }

    /**
     * 生成总结
     */
    _generateSummary(plan) {
        const summaries = {
            tutorial: `## 这一步的成果\n\n你已经学会了${plan.topic}的基本用法。\n\n下一章，我们来学习更多内容。\n`,
            feature: `## 这一步的成果\n\n${plan.topic}功能已经实现。\n\n下一章，我们来继续完善。\n`,
            api: `## 总结\n\n以上就是${plan.topic}组件的完整说明。\n`
        };
        return summaries[plan.intent] || summaries.tutorial;
    }

    /**
     * 保存文档
     */
    save(content, outputDir) {
        const filepath = path.join(outputDir, 'readme.md');
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`\n📄 文档已生成: ${filepath}`);
        return filepath;
    }
}

module.exports = DocumentGenerator;
