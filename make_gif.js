#!/usr/bin/env node
/**
 * make_gif.js — 录制 GIF 动图
 *
 * 用法:
 *   node make_gif.js output.gif                    录制整个IDE窗口，默认60帧
 *   node make_gif.js output.gif --frames 100       录制100帧
 *   node make_gif.js output.gif --fps 15           15fps（默认15fps）
 *   node make_gif.js output.gif --width 600        缩放到最大宽度600px
 *   node make_gif.js output.gif --crop 0,400,1334,350  只录制窗口内指定区域
 *   node make_gif.js output.gif --game             录制游戏窗口(game.html target)
 *
 * 示例:
 *   node make_gif.js demo.gif --frames 30 --fps 10 --width 500
 *   node make_gif.js click-demo.gif --game --frames 20
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const TOOLS = __dirname;
const TEMP_DIR = path.join(TOOLS, '..', '_gif_temp');

// ─── 参数解析 ────────────────────────────────────────────────

function parseArgs(argv) {
    const args = {
        output: 'output.gif',
        frames: 60,
        fps: 15,
        maxWidth: 600,
        crop: null,      // {x, y, w, h}
        game: false,     // 录制游戏窗口
        keepFrames: false
    };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--frames' && argv[i + 1]) args.frames = parseInt(argv[++i]);
        else if (arg === '--fps' && argv[i + 1]) args.fps = parseInt(argv[++i]);
        else if (arg === '--width' && argv[i + 1]) args.maxWidth = parseInt(argv[++i]);
        else if (arg === '--crop' && argv[i + 1]) {
            const [x, y, w, h] = argv[++i].split(',').map(Number);
            args.crop = { x, y, width: w, height: h };
        }
        else if (arg === '--game') args.game = true;
        else if (arg === '--keep') args.keepFrames = true;
        else if (!arg.startsWith('--')) args.output = arg;
    }
    return args;
}

// ─── 窗口操作 ─────────────────────────────────────────────────

function getWindowRect() {
    const ps = path.join(TOOLS, 'get_win_rect.ps1');
    const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps}"`, { encoding: 'utf8' }).trim();
    const [l, t, r, b] = out.split(',').map(Number);
    return { x: l, y: t, w: r - l, h: b - t };
}

function captureFrame(savePath) {
    const ps = path.join(TOOLS, 'fullscreen.ps1');
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps}" -savePath "${savePath}"`, { stdio: 'ignore' });
}

// ─── CDP 游戏截图 ─────────────────────────────────────────────

async function captureGameFrame(savePath) {
    const http = require('http');
    const WebSocket = require('ws');

    return new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9222/json/list', res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', async () => {
                const targets = JSON.parse(d);
                const t = targets.find(t => t.title.includes('game.html') || t.url.includes('game.html'));
                if (!t) { reject(new Error('Game target not found')); return; }

                const ws = new WebSocket(t.webSocketDebuggerUrl);
                let id = 0;
                const pending = new Map();

                ws.on('open', async () => {
                    const send = (method, params) => new Promise(r => {
                        pending.set(++id, r);
                        ws.send(JSON.stringify({ id, method, params }));
                    });
                    ws.on('message', raw => {
                        const msg = JSON.parse(raw);
                        if (msg.id && pending.has(msg.id)) {
                            pending.get(msg.id)(msg.result);
                            pending.delete(msg.id);
                        }
                    });

                    const r = await send('Page.captureScreenshot', { format: 'png' });
                    const buf = Buffer.from(r.data, 'base64');
                    fs.writeFileSync(savePath, buf);
                    ws.close();
                    resolve();
                });
                ws.on('error', reject);
            });
        }).on('error', reject);
    });
}

// ─── GIF 编码 ──────────────────────────────────────────────────

async function encodeGif(framesPath, outputPath, fps, maxWidth) {
    const GIFEncoder = require('gif-encoder-2');
    const files = fs.readdirSync(framesPath).filter(f => f.endsWith('.png')).sort();
    if (files.length === 0) throw new Error('No frames captured');

    const firstPath = path.join(framesPath, files[0]);
    const meta = await sharp(firstPath).metadata();

    // 计算缩放
    const scale = Math.min(1, maxWidth / meta.width);
    const w = Math.round(meta.width * scale);
    const h = Math.round(meta.height * scale);

    console.log(`Encoding ${files.length} frames (${w}x${h}, ${fps}fps)...`);

    const encoder = new GIFEncoder(w, h);
    encoder.setDelay(Math.round(1000 / fps));
    encoder.setRepeat(0);
    encoder.setQuality(10);
    encoder.start();

    for (const file of files) {
        const filePath = path.join(framesPath, file);
        const { data } = await sharp(filePath)
            .resize(w, h, { kernel: sharp.kernel.nearest })  // 像素风用 nearest
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
        encoder.addFrame(data);
        process.stdout.write('.');
    }

    encoder.finish();
    const buf = encoder.out.getData();
    fs.writeFileSync(outputPath, buf);

    const sizeKB = Math.round(buf.length / 1024);
    console.log(`\nOK: ${outputPath} (${sizeKB} KB, ${w}x${h}, ${files.length} frames, ${fps}fps)`);
}

// ─── 主流程 ────────────────────────────────────────────────────

async function main() {
    const args = parseArgs(process.argv.slice(2));

    // 清理旧临时目录
    if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true });
    fs.mkdirSync(TEMP_DIR, { recursive: true });

    const intervalMs = Math.round(1000 / args.fps);
    console.log(`Recording ${args.frames} frames at ${args.fps}fps...`);

    // 获取窗口位置（用于裁剪）
    let winRect = null;
    if (args.crop) {
        winRect = getWindowRect();
        console.log(`Window: ${winRect.w}x${winRect.h} at (${winRect.x}, ${winRect.y})`);
    }

    const startTime = Date.now();

    for (let i = 0; i < args.frames; i++) {
        const framePath = path.join(TEMP_DIR, `f${String(i).padStart(4, '0')}.png`);

        // 截取原始帧
        if (args.game) {
            await captureGameFrame(framePath);
        } else {
            captureFrame(framePath);
        }

        // 需要裁剪吗？
        if (args.crop && winRect) {
            const tmpPath = framePath + '.tmp.png';
            fs.renameSync(framePath, tmpPath);

            // 窗口内坐标 → 屏幕坐标
            const sx = winRect.x + args.crop.x;
            const sy = winRect.y + args.crop.y;

            await sharp(tmpPath)
                .extract({ left: sx, top: sy, width: args.crop.width, height: args.crop.height })
                .toFile(framePath);
            fs.unlinkSync(tmpPath);
        }

        // 控制帧率
        const elapsed = Date.now() - startTime;
        const targetElapsed = (i + 1) * intervalMs;
        const waitMs = targetElapsed - elapsed;
        if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));

        process.stdout.write('.');
    }
    console.log(`\nCaptured in ${Date.now() - startTime}ms`);

    // 编码 GIF
    await encodeGif(TEMP_DIR, args.output, args.fps, args.maxWidth);

    // 清理
    if (!args.keepFrames) {
        fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    } else {
        console.log(`Frames saved to: ${TEMP_DIR}`);
    }
}

main().catch(e => {
    console.error('\nError:', e.message);
    process.exit(1);
});
