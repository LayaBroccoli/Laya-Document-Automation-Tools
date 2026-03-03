#!/usr/bin/env node
/**
 * workflow.js — 文档自动生成工作流（集成MCP）
 *
 * 用法:
 *   node workflow.js "PhysicsCollider组件文档"
 *   node workflow.js "如何使用RigidBody" --dry-run
 *   node workflow.js "Scene3D入门教程" --output docs/
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TOOLS = __dirname;

// ─────────────────────────────────────────────────────────────
// MCP调用（通过Claude Code的MCP工具）
// ─────────────────────────────────────────────────────────────

class MCPClient {
    constructor() {
        // MCP结果存储
        this.cache = new Map();
    }

    /**
     * 查询API
     */
    queryAPI(query, version = 'v3.4') {
        const cacheKey = `query_${query}_${version}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

        // 这里需要AI通过MCP工具实际调用
        // 返回模拟数据供测试
        return { results: [], total: 0 };
    }

    /**
     * 获取组件schema
     */
    async getSchema(name) {
        const cacheKey = `schema_${name}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

        // AI需要调用: mcp__laya_mcp_server__get_schema_by_name
        // 暂时返回null，实际由AI在对话中调用MCP后传入
        return null;
    }

    /**
     * 获取API详情
     */
    async getAPIDetail(name, version = 'v3.4') {
        const cacheKey = `detail_${name}_${version}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

        // AI需要调用: mcp__laya_mcp_server__get_api_detail
        return null;
    }

    /**
     * 获取示例
     */
    async getExamples(name, version = 'v3.4') {
        const cacheKey = `examples_${name}_${version}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

        // AI需要调用: mcp__laya_mcp_server__get_examples
        return [];
    }

    /**
     * 设置MCP数据（由AI在对话中调用MCP后注入）
     */
    setSchema(name, schema) {
        this.cache.set(`schema_${name}`, schema);
    }

    setAPIDetail(name, detail) {
        this.cache.set(`detail_${name}`, detail);
    }

    setExamples(name, examples) {
        this.cache.set(`examples_${name}`, examples);
    }
}

// ─────────────────────────────────────────────────────────────
// 智能规划器
// ─────────────────────────────────────────────────────────────

class AutoPlanner {
    constructor() {
        this.mcp = new MCPClient();
    }

    /**
     * 主规划入口
     */
    async plan(input, mcpDataProvider = null) {
        // 1. 解析输入
        const parsed = this._parseInput(input);

        console.log(`📋 规划: ${parsed.topic} (${parsed.intent})`);

        // 2. 获取MCP数据
        const mcpData = await this._getMCPData(parsed, mcpDataProvider);

        // 3. 生成步骤
        const steps = await this._generateSteps(parsed, mcpData);

        return {
            topic: parsed.topic,
            intent: parsed.intent,
            steps,
            mcpData
        };
    }

    /**
     * 解析用户输入
     */
    _parseInput(input) {
        // 移除前缀词
        const cleaned = input
            .replace(/^(写一个|写|生成|创建|关于|如何|怎么|做一个|做个)/, '')
            .replace(/(的文档|的教程|入门|实现|制作|创建|添加|使用)/g, '')
            .trim();

        // 意图识别
        let intent = 'tutorial';
        if (/组件|Component|Collider|RigidBody|Joint/.test(cleaned)) intent = 'component';
        else if (/属性|Property/.test(cleaned)) intent = 'property';
        else if (/场景|Scene/.test(cleaned)) intent = 'scene';
        else if (/项目|Project/.test(cleaned)) intent = 'project';
        else if (/API|功能/.test(cleaned)) intent = 'feature';

        return {
            topic: cleaned,
            intent,
            original: input
        };
    }

    /**
     * 获取MCP数据
     */
    async _getMCPData(parsed, provider) {
        const data = {
            schema: null,
            apiInfo: null,
            examples: []
        };

        if (provider) {
            // 使用外部提供的MCP数据（AI调用后传入）
            return provider(parsed.topic);
        }

        // 尝试从缓存获取
        if (parsed.intent === 'component') {
            data.schema = await this.mcp.getSchema(parsed.topic);
            data.apiInfo = await this.mcp.getAPIDetail(parsed.topic);
            data.examples = await this.mcp.getExamples(parsed.topic);
        }

        return data;
    }

    /**
     * 生成步骤
     */
    async _generateSteps(parsed, mcpData) {
        const { topic, intent } = parsed;

        // 根据意图和MCP数据选择生成器
        if (intent === 'component' && mcpData?.schema) {
            return this._componentSteps(topic, mcpData.schema);
        } else if (intent === 'component') {
            return this._componentGenericSteps(topic);
        } else if (intent === 'scene') {
            return this._sceneSteps(topic);
        } else if (intent === 'project') {
            return this._projectSteps(topic);
        } else {
            return this._genericSteps(topic);
        }
    }

    /**
     * 组件教程步骤（有schema数据）
     */
    _componentSteps(name, schema) {
        const props = schema.properties || {};
        const propCount = Object.keys(props).length;

        return [
            {
                step: 1,
                title: `创建节点`,
                desc: `在层级面板中右键，创建适合${name}的节点类型`,
                action: 'createNode',
                needScreenshot: true,
                screenshotPhase: 'after'
            },
            {
                step: 2,
                title: `添加${name}组件`,
                desc: `选中节点，在属性面板点击"增加组件"，选择${name}`,
                action: 'addComponent',
                needScreenshot: true,
                needGif: true
            },
            {
                step: 3,
                title: '配置组件属性',
                desc: `组件包含${propCount}个属性，根据需求设置关键属性`,
                action: 'configure',
                needScreenshot: true,
                contentData: this._formatPropTable(props)
            },
            {
                step: 4,
                title: '运行验证',
                desc: '点击运行按钮，查看组件效果',
                action: 'run',
                needScreenshot: true,
                needGif: true
            }
        ];
    }

    /**
     * 组件教程步骤（通用）
     */
    _componentGenericSteps(name) {
        return [
            {
                step: 1,
                title: '创建节点',
                desc: `在层级面板中创建目标节点`,
                action: 'createNode',
                needScreenshot: true
            },
            {
                step: 2,
                title: `添加${name}组件`,
                desc: `选中节点，在属性面板添加${name}组件`,
                action: 'addComponent',
                needScreenshot: true,
                needGif: true
            },
            {
                step: 3,
                title: '设置属性',
                desc: '在属性面板中设置组件的各项属性',
                action: 'configure',
                needScreenshot: true
            },
            {
                step: 4,
                title: '运行测试',
                desc: '运行查看效果',
                action: 'run',
                needScreenshot: true
            }
        ];
    }

    /**
     * 场景教程步骤
     */
    _sceneSteps(name) {
        return [
            {
                step: 1,
                title: '创建场景',
                desc: `在资源面板右键assets目录，选择"新建"→"3D场景"`,
                action: 'createScene',
                needScreenshot: true,
                screenshotPhase: 'after'
            },
            {
                step: 2,
                title: '认识场景结构',
                desc: '3D场景包含Scene3D根节点、Camera摄像机、Light光源',
                action: 'explain',
                needScreenshot: true
            },
            {
                step: 3,
                title: '调整基础设置',
                desc: '设置场景尺寸、背景色等基础属性',
                action: 'configure',
                needScreenshot: true
            },
            {
                step: 4,
                title: '添加基础物体',
                desc: '创建一个3D精灵或立方体作为测试物体',
                action: 'addObject',
                needScreenshot: true,
                needGif: true
            },
            {
                step: 5,
                title: '运行预览',
                desc: '点击运行按钮查看场景效果',
                action: 'run',
                needScreenshot: true
            }
        ];
    }

    /**
     * 项目教程步骤
     */
    _projectSteps(name) {
        return [
            {
                step: 1,
                title: '打开创建面板',
                desc: '点击IDE右上角"创建项目"按钮',
                action: 'openDialog',
                needScreenshot: true
            },
            {
                step: 2,
                title: '选择项目类型',
                desc: `在模板列表中选择项目类型（2D/3D空项目等）`,
                action: 'selectType',
                needScreenshot: true
            },
            {
                step: 3,
                title: '设置项目信息',
                desc: '输入项目名称，选择保存位置，点击创建',
                action: 'create',
                needScreenshot: true
            },
            {
                step: 4,
                title: '认识项目结构',
                desc: '了解assets、src等目录的作用',
                action: 'explain',
                needScreenshot: true
            }
        ];
    }

    /**
     * 通用教程步骤
     */
    _genericSteps(name) {
        return [
            {
                step: 1,
                title: '准备工作',
                desc: `确保项目已打开，找到相关功能入口`,
                action: 'prepare',
                needScreenshot: true
            },
            {
                step: 2,
                title: '执行操作',
                desc: `按照需求进行${name}相关操作`,
                action: 'operate',
                needScreenshot: true,
                needGif: true
            },
            {
                step: 3,
                title: '验证结果',
                desc: '运行查看效果是否符合预期',
                action: 'run',
                needScreenshot: true
            }
        ];
    }

    /**
     * 格式化属性表格
     */
    _formatPropTable(props) {
        if (!props || !Object.keys(props).length) return null;

        let table = '| 属性 | 类型 | 默认值 | 说明 |\n';
        table += '|------|------|--------|------|\n';

        for (const [name, prop] of Object.entries(props)) {
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
        console.log('用法: node workflow.js "<主题> [选项]"');
        console.log('');
        console.log('示例:');
        console.log('  node workflow.js "PhysicsCollider组件文档"');
        console.log('  node workflow.js "如何创建Scene3D"');
        console.log('  node workflow.js "RigidBody使用教程" --dry-run');
        console.log('');
        console.log('选项:');
        console.log('  --output <dir>   输出目录');
        console.log('  --dry-run       只生成计划不执行');
        console.log('  --version <ver> LayaAir版本 (默认3.4)');
        process.exit(1);
    }

    console.log(`📝 任务: ${input}\n`);

    // 使用自动规划器
    const planner = new AutoPlanner();
    const plan = await planner.plan(input);

    console.log(`\n📋 执行计划:`);
    plan.steps.forEach((step, i) => {
        console.log(`   ${i + 1}. ${step.title}`);
        if (step.needScreenshot) console.log(`      └─ 需要截图`);
        if (step.needGif) console.log(`      └─ 需要动图`);
        if (step.contentData) console.log(`      └─ 包含属性表格`);
    });

    if (args.dryRun) {
        console.log(`\n[DRY RUN] 计划已生成\n`);
        const generator = require('./generator');
        const doc = generator.generate(plan, []);
        console.log(`\n📄 文档预览:\n`);
        console.log(doc);
        return;
    }

    // 执行模式
    const StepExecutor = require('./executor');
    const DocumentGenerator = require('./generator');

    // 创建输出目录
    const outputDir = args.output || path.join(__dirname, '../doc-output');
    const docName = plan.topic.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g, '');
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
        dryRun: false
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
        style: plan.intent,
        version: args.version || '3.4'
    });

    const document = generator.generate(plan, executionResults);
    const docPath = generator.save(document, workDir);

    // 总结
    const imgCount = executionResults.reduce((sum, r) => sum + (r.images?.filter(i => i).length || 0), 0);
    const gifCount = executionResults.reduce((sum, r) => sum + (r.gifs?.filter(g => g).length || 0), 0);

    console.log(`\n✅ 完成！`);
    console.log(`   📄 文档: ${docPath}`);
    console.log(`   📁 目录: ${workDir}`);
    console.log(`   📊 步骤: ${plan.steps.length}`);
    console.log(`   📸 截图: ${imgCount}`);
    console.log(`   🎬 动图: ${gifCount}`);
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
