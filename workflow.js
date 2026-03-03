#!/usr/bin/env node
/**
 * workflow.js — 文档自动生成工作流（集成MCP）
 *
 * 一句话生成带图片和动态图的完整文档
 *
 * 用法:
 *   node workflow.js "写一个PhysicsCollider组件的教程"
 *   node workflow.js "RigidBody组件文档" --output docs/
 *   node workflow.js "实现滚动背景" --dry-run
 */

const fs = require('fs');
const path = require('path');
const DocumentGenerator = require('./generator');

// MCP工具代理（通过文件传递参数调用）
class MCPProxy {
    constructor() {
        // 结果文件路径
        this.resultFile = path.join(__dirname, '.mcp_result.json');
    }

    /**
     * 调用MCP工具获取API信息
     */
    async queryAPI(query, version = 'v3.4') {
        return this._callMCP('query_api', { query, version });
    }

    /**
     * 获取组件schema
     */
    async getSchema(name) {
        return this._callMCP('get_schema_by_name', { name });
    }

    /**
     * 获取API详情
     */
    async getAPIDetail(name, version = 'v3.4') {
        return this._callMCP('get_api_detail', { name, version });
    }

    /**
     * 获取示例
     */
    async getExamples(name, version = 'v3.4') {
        return this._callMCP('get_examples', { name, version });
    }

    /**
     * 调用MCP（通过文件传递）
     */
    async _callMCP(tool, params) {
        const requestFile = path.join(__dirname, '.mcp_request.json');
        fs.writeFileSync(requestFile, JSON.stringify({ tool, params }), 'utf8');

        // 等待AI处理请求并写入结果
        // 这里需要AI来调用MCP并写入结果文件
        // 暂时返回空对象，实际需要AI配合
        await this._sleep(100);

        if (fs.existsSync(this.resultFile)) {
            const result = JSON.parse(fs.readFileSync(this.resultFile, 'utf8'));
            fs.unlinkSync(this.resultFile);
            return result.data;
        }

        return null;
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ─────────────────────────────────────────────────────────────
// 智能步骤规划器（集成MCP）
// ─────────────────────────────────────────────────────────────

class SmartPlanner {
    constructor() {
        this.mcp = new MCPProxy();
    }

    async plan(input) {
        // 1. 意图识别和主题提取
        const intent = this.detectIntent(input);
        const topic = this.extractTopic(input);

        console.log(`📋 规划: ${topic} (${intent})`);

        // 2. MCP查询
        const mcpData = await this.queryMCP(topic, intent);

        // 3. 根据MCP数据生成具体步骤
        const steps = await this.generateSteps(topic, intent, mcpData);

        return { topic, intent, steps, mcpData };
    }

    detectIntent(input) {
        if (/组件|属性|Collision|RigidBody/.test(input)) return 'api';
        if (/实现|功能|效果/.test(input)) return 'feature';
        if (/场景|3D|2D/.test(input)) return 'tutorial';
        return 'tutorial';
    }

    extractTopic(input) {
        return input
            .replace(/^(写一个|写|生成|创建|关于|如何|怎么)/, '')
            .replace(/(的文档|的教程|入门|实现|制作|创建|添加)/g, '')
            .trim();
    }

    async queryMCP(topic, intent) {
        const data = { schema: null, examples: [], apiInfo: null };

        // 尝试获取schema
        try {
            const schema = await this.mcp.getSchema(topic);
            if (schema) data.schema = schema;
        } catch (e) {
            // 不是组件，尝试查询API
        }

        // 尝试获取API详情
        try {
            const apiInfo = await this.mcp.getAPIDetail(topic);
            if (apiInfo) data.apiInfo = apiInfo;
        } catch (e) {
            // API不存在
        }

        // 尝试获取示例
        try {
            const examples = await this.mcp.getExamples(topic);
            if (examples) data.examples = examples;
        } catch (e) {
            // 没有示例
        }

        return data;
    }

    async generateSteps(topic, intent, mcpData) {
        // 根据MCP数据生成定制化步骤
        if (mcpData.schema) {
            // 是一个组件
            return this.generateComponentSteps(topic, mcpData.schema);
        } else if (topic.includes('3D场景') || topic.includes('Scene3D')) {
            // 3D场景教程
            return this.get3DSceneSteps();
        } else if (topic.includes('创建项目') || topic.includes('项目')) {
            // 创建项目教程
            return this.getProjectSteps();
        } else {
            // 默认教程
            return this.getDefaultSteps();
        }
    }

    generateComponentSteps(componentName, schema) {
        return [
            {
                step: 1,
                title: `创建${componentName}节点`,
                desc: `在层级面板中右键，选择3D节点 -> 3D精灵（或2D节点，根据组件类型）`,
                action: 'createNode',
                needScreenshot: true,
                screenshotPhase: 'after'
            },
            {
                step: 2,
                title: `添加${componentName}组件`,
                desc: `选中节点，在属性面板点击"增加组件"，选择${componentName}`,
                action: 'addComponent',
                needScreenshot: true,
                needGif: true
            },
            {
                step: 3,
                title: '设置组件属性',
                desc: this._generatePropertyDesc(schema),
                action: 'setProperties',
                needScreenshot: true,
                contentData: this._formatProperties(schema)
            },
            {
                step: 4,
                title: '运行验证',
                desc: '点击运行按钮，查看效果',
                action: 'run',
                needScreenshot: true,
                needGif: true
            }
        ];
    }

    get3DSceneSteps() {
        return [
            {
                step: 1,
                title: '创建3D项目',
                desc: '打开IDE，点击"创建项目"，选择3D空项目',
                action: 'createProject',
                needScreenshot: true
            },
            {
                step: 2,
                title: '认识3D场景',
                desc: '3D场景包含Scene3D（根节点）、Camera（摄像机）、Light（光照）',
                action: 'explain',
                needScreenshot: true
            },
            {
                step: 3,
                title: '调整摄像机',
                desc: '选中Camera，设置位置为(0,5,-12)，让摄像机位于场景后上方',
                action: 'setCamera',
                needScreenshot: true
            },
            {
                step: 4,
                title: '运行测试',
                desc: '点击运行按钮，查看空场景效果',
                action: 'run',
                needScreenshot: true
            }
        ];
    }

    getProjectSteps() {
        return [
            {
                step: 1,
                title: '创建新项目',
                desc: '点击IDE右上角"创建项目"，选择项目类型',
                action: 'createProject',
                needScreenshot: true
            },
            {
                step: 2,
                title: '设置项目信息',
                desc: '输入项目名称，选择保存位置，点击创建',
                action: 'configure',
                needScreenshot: true
            },
            {
                step: 3,
                title: '认识IDE界面',
                desc: '熟悉层级面板、资源面板、属性面板、场景编辑器',
                action: 'explain',
                needScreenshot: true
            }
        ];
    }

    getDefaultSteps() {
        return [
            {
                step: 1,
                title: '准备场景',
                desc: '打开或创建目标场景',
                action: 'prepare',
                needScreenshot: true
            },
            {
                step: 2,
                title: '执行操作',
                desc: '按照需求进行操作',
                action: 'operate',
                needScreenshot: true,
                needGif: true
            },
            {
                step: 3,
                title: '验证结果',
                desc: '运行查看效果',
                action: 'run',
                needScreenshot: true,
                needGif: true
            }
        ];
    }

    _generatePropertyDesc(schema) {
        if (!schema.properties || !Object.keys(schema.properties).length) {
            return '在属性面板中设置组件的各项属性';
        }
        const propNames = Object.keys(schema.properties).slice(0, 3).join('、');
        return `设置关键属性：${propNames}等`;
    }

    _formatProperties(schema) {
        if (!schema.properties) return null;

        let table = '| 属性 | 类型 | 默认值 | 说明 |\n';
        table += '|------|------|--------|------|\n';

        for (const [name, prop] of Object.entries(schema)) {
            const type = prop.type || '';
            const defaultValue = prop.default !== undefined ? prop.default : '-';
            const tips = prop.tips || '';
            table += `| ${name} | ${type} | ${defaultValue} | ${tips} |\n`;
        }

        return table;
    }
}

// ─────────────────────────────────────────────────────────────
// 主函数
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

    // 使用智能规划器
    const planner = new SmartPlanner();
    const plan = await planner.plan(input);

    console.log(`\n📋 执行计划:`);
    plan.steps.forEach(step => {
        console.log(`   ${step.step}. ${step.title}`);
        if (step.needScreenshot) console.log(`      └─ 需要截图`);
        if (step.needGif) console.log(`      └─ 需要动图`);
    });

    if (args.dryRun) {
        console.log(`\n[DRY RUN] 计划已生成`);
        console.log(`\n📄 生成文档预览:`);
        const generator = new DocumentGenerator({ style: args.style || plan.intent });
        const doc = generator.generate(plan, []);
        console.log(doc);
        return;
    }

    // 创建输出目录
    const StepExecutor = require('./executor');
    const outputDir = args.output || path.join(__dirname, '../doc-output');
    const docName = plan.topic.toLowerCase().replace(/\s+/g, '-');
    const workDir = path.join(outputDir, docName);
    const imgDir = path.join(workDir, 'img');

    fs.mkdirSync(workDir, { recursive: true });
    fs.mkdirSync(imgDir, { recursive: true });
    console.log(`\n📁 输出目录: ${workDir}`);

    // 执行步骤
    console.log(`\n⚡ 执行步骤...`);
    const realToolsPath = 'D:/LayaProject/aidoc/tools';
    const executor = new StepExecutor({
        scriptsPath: realToolsPath,
        imgDir: imgDir,
        dryRun: args.dryRun
    });

    const executionResults = [];
    for (const step of plan.steps) {
        const result = await executor.execute(step, { mcpData: plan.mcpData, plan });
        executionResults.push(result);
        console.log(`   ✓ 步骤${step.step}完成`);
    }

    // 生成文档
    console.log(`\n📄 生成文档...`);
    const generator = new DocumentGenerator({
        style: args.style || plan.intent,
        version: args.version || '3.4'
    });

    const document = generator.generate(plan, executionResults);
    const docPath = generator.save(document, workDir);

    // 总结
    console.log(`\n✅ 完成！`);
    console.log(`   📄 文档: ${docPath}`);
    console.log(`   🖼️  图片: ${imgDir}`);
    console.log(`   📊 步骤数: ${plan.steps.length}`);
    console.log(`   📸 截图数: ${executionResults.reduce((sum, r) => sum + (r.images?.length || 0), 0)}`);
    console.log(`   🎬 动图数: ${executionResults.reduce((sum, r) => sum + (r.gifs?.length || 0), 0)}`);
}

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

main().catch(err => {
    console.error('❌ 错误:', err.message);
    process.exit(1);
});
