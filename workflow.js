#!/usr/bin/env node
/**
 * workflow.js — 文档自动生成工作流
 *
 * 一句话生成带图片和动态图的完整文档
 *
 * 用法:
 *   node workflow.js "写一个如何使用PhysicsCollider的教程"
 *   node workflow.js "RigidBody组件文档" --output docs/
 *   node workflow.js "实现滚动背景" --dry-run
 */

const fs = require('fs');
const path = require('path');

const StepPlanner = require('./planner');
const StepExecutor = require('./executor');
const DocumentGenerator = require('./generator');

const TOOLS = __dirname;

// ─────────────────────────────────────────────────────────────
// MCP集成（待实现）
// ─────────────────────────────────────────────────────────────

class MCPClient {
    async queryAPI(name) {
        // 调用 MCP query_api
        return { schema: null, examples: [] };
    }

    async getSchema(name) {
        // 调用 MCP get_schema_by_name
        return null;
    }

    async getExamples(name) {
        // 调用 MCP get_examples
        return [];
    }
}

// ─────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────

async function main() {
    const args = parseArgs();
    const input = args._[0];

    if (!input) {
        console.log('用法: node workflow.js "写一个XXX的教程" [选项]');
        console.log('选项:');
        console.log('  --output <dir>   输出目录');
        console.log('  --dry-run       只生成计划不执行');
        console.log('  --style <type>  文档风格 (tutorial/api)');
        console.log('  --version <ver> LayaAir版本 (默认3.4)');
        process.exit(1);
    }

    console.log(`📝 任务: ${input}\n`);

    // 1. 意图识别与主题提取
    const intent = detectIntent(input);
    const topic = extractTopic(input);
    console.log(`📋 类型: ${intent}`);
    console.log(`🎯 主题: ${topic}\n`);

    // 2. MCP查询
    console.log(`🔍 查询MCP...`);
    const mcpClient = new MCPClient();
    const mcpData = {
        schema: await mcpClient.getSchema(topic),
        examples: await mcpClient.getExamples(topic)
    };

    // 3. 生成执行计划
    console.log(`\n📋 生成执行计划...`);
    const planner = new StepPlanner();
    const plan = await planner.plan(input, mcpData);

    plan.steps.forEach(step => {
        console.log(`   ${step.step}. ${step.title}`);
        if (step.needScreenshot) console.log(`      └─ 需要截图`);
        if (step.needGif) console.log(`      └─ 需要动图`);
    });

    if (args.dryRun) {
        console.log(`\n[DRY RUN] 计划已生成，不执行操作`);
        return;
    }

    // 4. 创建输出目录
    const outputDir = args.output || path.join(TOOLS, '../doc-output');
    const docName = topic.toLowerCase().replace(/\s+/g, '-');
    const workDir = path.join(outputDir, docName);
    const imgDir = path.join(workDir, 'img');

    fs.mkdirSync(workDir, { recursive: true });
    fs.mkdirSync(imgDir, { recursive: true });
    console.log(`\n📁 输出目录: ${workDir}`);

    // 5. 执行步骤
    console.log(`\n⚡ 执行步骤...`);
    const executor = new StepExecutor({
        scriptsPath: TOOLS,
        imgDir: imgDir,
        dryRun: args.dryRun
    });

    const executionResults = [];
    for (const step of plan.steps) {
        const result = await executor.execute(step, { mcpData, plan });
        executionResults.push(result);
        console.log(`   ✓ 步骤${step.step}完成`);
    }

    // 6. 生成文档
    console.log(`\n📄 生成文档...`);
    const generator = new DocumentGenerator({
        style: args.style || plan.intent,
        version: args.version || '3.4'
    });

    const document = generator.generate(plan, executionResults);
    const docPath = generator.save(document, workDir);

    // 7. 生成总结
    console.log(`\n✅ 完成！`);
    console.log(`   📄 文档: ${docPath}`);
    console.log(`   🖼️  图片: ${imgDir}`);
    console.log(`   📊 步骤数: ${plan.steps.length}`);
    console.log(`   📸 截图数: ${executionResults.reduce((sum, r) => sum + (r.images?.length || 0), 0)}`);
    console.log(`   🎬 动图数: ${executionResults.reduce((sum, r) => sum + (r.gifs?.length || 0), 0)}`);
}

// ─────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────

function parseArgs() {
    const args = { _: [] };
    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const next = process.argv[i + 1];
            if (next && !next.startsWith('--')) {
                args[key] = next;
                i++;
            } else {
                args[key] = true;
            }
        } else {
            args._.push(arg);
        }
    }
    return args;
}

function detectIntent(input) {
    if (/组件|属性|API|文档/.test(input)) return 'api';
    if (/实现|功能|效果/.test(input)) return 'feature';
    return 'tutorial';
}

function extractTopic(input) {
    return input
        .replace(/^(写一个|写|生成|创建|关于|如何|怎么)/, '')
        .replace(/(的文档|的教程|入门|实现|制作|创建|添加)/g, '')
        .trim();
}

// ─────────────────────────────────────────────────────────────
// 入口
// ─────────────────────────────────────────────────────────────

main().catch(err => {
    console.error('❌ 错误:', err.message);
    process.exit(1);
});
