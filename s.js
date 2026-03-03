#!/usr/bin/env node
/**
 * s.js — 统一截图/操作工具
 *
 * 截图:
 *   node s.js shot out.png                          CDP全页截图
 *   node s.js shot out.png --clip 0,400,200,120     裁剪区域
 *   node s.js shot out.png --clip 0,400,200,120 --mark 50,10,80,20   裁剪+标注
 *   node s.js win out.png                           全屏截窗口(含原生菜单)
 *   node s.js win out.png --mark 100,200,80,20      截窗口+标注
 *
 * 查找元素:
 *   node s.js find "增加组件"                       查找文本元素位置
 *   node s.js find "Player" --hierarchy             限层级面板
 *
 * 点击:
 *   node s.js click "Player"                        点击(nut-js真实鼠标)
 *   node s.js rclick "Scene2D"                      右键
 *
 * 菜单栏:
 *   node s.js menubar                               列出菜单栏按钮
 *   node s.js menubar "工具"                        查找特定按钮
 *   node s.js menubar-click "工具"                  点击菜单栏按钮
 *
 * 原生菜单:
 *   node s.js menu                                  列出当前可见的原生菜单项
 *   node s.js menu "2D精灵"                         查找特定菜单项坐标
 *   node s.js menu-click "2D精灵"                   点击原生菜单项
 *   node s.js rclick-menu "Scene2D" "2D精灵" out.png  右键→等菜单→标注截图
 *
 * 游戏target:
 *   node s.js game eval "Laya.stage.width"          在游戏target执行JS
 *   node s.js game shot out.png                     游戏画面截图
 *   node s.js game tree                             打印游戏节点树
 *   node s.js game click 667,340                    点击游戏画布(DOM事件)
 */

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('sharp');

const TOOLS = __dirname;
const CDP_PORT = 9222;

// ─── CDP helpers ───────────────────────────────────────────

function httpGet(url) {
    return new Promise((res, rej) => {
        http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej);
    });
}

class CDP {
    constructor(ws) { this.ws = ws; this._id = 0; this._pending = new Map(); }

    static async connect(filter = 'sceneEditor') {
        const targets = await httpGet(`http://127.0.0.1:${CDP_PORT}/json/list`);
        const t = targets.find(t => t.title.includes(filter) || t.url.includes(filter));
        if (!t) throw new Error(`Target "${filter}" not found. Available: ${targets.map(t => t.title).join(', ')}`);
        return new Promise((res, rej) => {
            const ws = new WebSocket(t.webSocketDebuggerUrl);
            const c = new CDP(ws);
            ws.on('open', () => res(c));
            ws.on('message', raw => {
                const m = JSON.parse(raw);
                if (m.id && c._pending.has(m.id)) {
                    const p = c._pending.get(m.id);
                    c._pending.delete(m.id);
                    m.error ? p.rej(m.error) : p.res(m.result);
                }
            });
            ws.on('error', rej);
        });
    }

    send(method, params = {}) {
        return new Promise((res, rej) => {
            const id = ++this._id;
            this._pending.set(id, { res, rej });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    async eval(expr) {
        const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true });
        return r.result?.value;
    }

    async screenshot(opts = {}) {
        const params = { format: 'png' };
        if (opts.clip) params.clip = { ...opts.clip, scale: 1 };
        const r = await this.send('Page.captureScreenshot', params);
        return Buffer.from(r.data, 'base64');
    }

    // 查找文本元素，返回 {x,y,w,h} (页面坐标)
    async findText(text, opts = {}) {
        const hierarchyOnly = opts.hierarchy ? '&& r.x<220 && r.y>80 && r.y<500' : '';
        return this.eval(`(function(){
            const results=[];
            const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_ELEMENT);
            while(walker.nextNode()){
                const el=walker.currentNode;
                const t=el.textContent?.trim();
                if(!t) continue;
                const match = ${opts.partial ? `t.includes("${text}")` : `t==="${text}"`};
                if(match){
                    const r=el.getBoundingClientRect();
                    if(r.width>0&&r.width<400&&r.height>0&&r.height<60 ${hierarchyOnly}){
                        results.push({x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),
                            cx:Math.round(r.x+r.width/2),cy:Math.round(r.y+r.height/2),text:t.substring(0,40)});
                    }
                }
            }
            results.sort((a,b)=>a.w*a.h-b.w*b.h);
            return results.slice(0,5);
        })()`);
    }

    // 列出所有可点击的 DOM 元素（不指定文本）
    async listAll(opts = {}) {
        const hierarchyOnly = opts.hierarchy ? '&& r.x<250 && r.y>80' : '';
        const buttonsOnly = opts.buttons ? '&& (el.tagName==="BUTTON"||el.classList.contains("btn")||el.onclick!==null)' : '';
        return this.eval(`(function(){
            const results=[];
            const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_ELEMENT);
            while(walker.nextNode()){
                const el=walker.currentNode;
                const t=el.textContent?.trim();
                if(!t||t.length>40) continue;
                const r=el.getBoundingClientRect();
                // 更严格的过滤：排除太小的元素，排除嵌套在父元素内的相同内容
                if(r.width>20&&r.width<300&&r.height>10&&r.height<50 ${hierarchyOnly}${buttonsOnly}){
                    // 检查是否是"叶子"元素（没有包含同样内容的子元素）
                    let hasChildWithSameText=false;
                    for(let child=el.firstElementChild;child;child=child.nextElementSibling){
                        if(child.textContent?.trim()===t&&child.getBoundingClientRect().width>10){
                            hasChildWithSameText=true;
                            break;
                        }
                    }
                    if(!hasChildWithSameText){
                        results.push({x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),
                            cx:Math.round(r.x+r.width/2),cy:Math.round(r.y+r.height/2),text:t.substring(0,30),
                            tag:el.tagName,type:el.type||''});
                    }
                }
            }
            results.sort((a,b)=>a.y*1000+a.x-b.y*1000-b.x);
            return results;
        })()`);
    }

    close() { this.ws.close(); }
}

// ─── 窗口/屏幕 ─────────────────────────────────────────────

function getWindowRect() {
    const out = runPS('get_win_rect.ps1');
    const [l, t, r, b] = out.split(',').map(Number);
    return { x: l, y: t, w: r - l, h: b - t };
}

async function fullscreenCapture() {
    const tmp = path.join(TOOLS, '..', '_fs_tmp.png');
    runPS('fullscreen.ps1', `-savePath "${tmp}"`);
    const buf = fs.readFileSync(tmp);
    fs.unlinkSync(tmp);
    return buf;
}

// ─── 标注 ───────────────────────────────────────────────────

async function annotate(imgBuf, rects) {
    if (!rects || rects.length === 0) return imgBuf;
    const meta = await sharp(imgBuf).metadata();
    const pad = 8;
    let svg = '';
    for (const r of rects) {
        const x = Math.max(0, r.x - pad), y = Math.max(0, r.y - pad);
        const w = Math.min(r.w + pad * 2, meta.width - x);
        const h = Math.min(r.h + pad * 2, meta.height - y);
        svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#FF2020" stroke-width="3" rx="6" ry="6"/>`;
    }
    const svgBuf = Buffer.from(`<svg width="${meta.width}" height="${meta.height}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`);
    return await sharp(imgBuf).composite([{ input: svgBuf, top: 0, left: 0 }]).toBuffer();
}

// ─── nut-js 鼠标 ────────────────────────────────────────────

let _mouse = null;
async function getMouse() {
    if (!_mouse) {
        const nut = require('@nut-tree/nut-js');
        nut.mouse.config.mouseSpeed = 500;
        nut.mouse.config.autoDelayMs = 5;
        _mouse = nut;
    }
    return _mouse;
}

async function realClick(screenX, screenY, right = false) {
    const { mouse, Point, Button } = await getMouse();
    await mouse.move(new Point(screenX, screenY));
    await new Promise(r => setTimeout(r, 80));
    await mouse.click(right ? Button.RIGHT : Button.LEFT);
}

// CDP页面坐标 → 屏幕坐标
function cdpToScreen(cdpX, cdpY, win, cdp_chrome) {
    const borderW = cdp_chrome?.chromeW || 2;
    const titleH = cdp_chrome?.chromeH || 38;
    return {
        x: Math.round(win.x + Math.floor(borderW / 2) + cdpX),
        y: Math.round(win.y + titleH + cdpY)
    };
}

// ─── 参数解析 ────────────────────────────────────────────────

function parseArgs(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith('--')) {
            const key = argv[i].slice(2);
            const val = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true;
            args[key] = val;
        } else {
            args._.push(argv[i]);
        }
    }
    return args;
}

function parseRect(s) {
    const [x, y, w, h] = s.split(',').map(Number);
    return { x, y, width: w, height: h };
}

function parseMarkRect(s) {
    const [x, y, w, h] = s.split(',').map(Number);
    return { x, y, w, h };
}

// ─── 子命令 ──────────────────────────────────────────────────

async function cmdShot(args) {
    const outPath = args._[1];
    if (!outPath) { console.error('Usage: s.js shot <output.png> [--clip x,y,w,h] [--mark x,y,w,h]'); process.exit(1); }

    const cdp = await CDP.connect();
    try {
        const clipOpt = args.clip ? { clip: parseRect(args.clip) } : {};
        let buf = await cdp.screenshot(clipOpt);
        if (args.mark) buf = await annotate(buf, [parseMarkRect(args.mark)]);
        fs.writeFileSync(outPath, buf);
        console.log(`OK ${outPath}`);
    } finally { cdp.close(); }
}

async function cmdWin(args) {
    const outPath = args._[1];
    if (!outPath) { console.error('Usage: s.js win <output.png> [--crop x,y,w,h] [--mark x,y,w,h]'); process.exit(1); }

    const win = getWindowRect();
    const fullBuf = await fullscreenCapture();
    let buf = await sharp(fullBuf).extract({ left: win.x, top: win.y, width: win.w, height: win.h }).toBuffer();

    if (args.crop) {
        const r = parseRect(args.crop);
        buf = await sharp(buf).extract({ left: r.x, top: r.y, width: r.width, height: r.height }).toBuffer();
    }
    if (args.mark) buf = await annotate(buf, [parseMarkRect(args.mark)]);
    fs.writeFileSync(outPath, buf);
    console.log(`OK ${outPath} (${win.w}x${win.h})`);
}

async function cmdFind(args) {
    const text = args._[1];
    if (!text) { console.error('Usage: s.js find <text> [--hierarchy] [--partial]'); process.exit(1); }

    const cdp = await CDP.connect();
    try {
        const results = await cdp.findText(text, { hierarchy: !!args.hierarchy, partial: !!args.partial });
        if (!results?.length) { console.log('Not found'); return; }
        for (const r of results) {
            console.log(`"${r.text}" pos(${r.x},${r.y}) size(${r.w}x${r.h}) center(${r.cx},${r.cy})`);
        }
    } finally { cdp.close(); }
}

async function cmdList(args) {
    const cdp = await CDP.connect();
    try {
        const results = await cdp.listAll({ hierarchy: !!args.hierarchy, buttons: !!args.buttons });
        if (!results?.length) { console.log('No elements found'); return; }

        // 按区域分组显示
        let lastY = -1;
        for (const r of results) {
            const isNewLine = r.y > lastY + 30;
            if (isNewLine) console.log('');
            const prefix = isNewLine ? '  ' : '    ';
            const tagInfo = r.tag === 'BUTTON' ? '[BTN] ' : `${r.tag} `;
            console.log(`${prefix}${tagInfo}"${r.text}" pos(${r.x},${r.y}) size(${r.w}x${r.h})`);
            lastY = r.y;
        }
        console.log(`\nTotal: ${results.length} elements`);
    } finally { cdp.close(); }
}

async function cmdClick(args) {
    const text = args._[1];
    const right = args._[0] === 'rclick';
    if (!text) { console.error(`Usage: s.js ${right ? 'rclick' : 'click'} <text>`); process.exit(1); }

    const cdp = await CDP.connect();
    try {
        const results = await cdp.findText(text, { hierarchy: false });
        const el = results?.[0];
        if (!el) { console.log(`"${text}" not found`); return; }

        const win = getWindowRect();
        const chrome = await cdp.eval(`({chromeH:window.outerHeight-window.innerHeight,chromeW:window.outerWidth-window.innerWidth})`);
        const screen = cdpToScreen(el.cx, el.cy, win, chrome);
        await realClick(screen.x, screen.y, right);
        console.log(`OK ${right ? 'rclick' : 'click'} "${text}" screen(${screen.x},${screen.y})`);
    } finally { cdp.close(); }
}

async function cmdGame(args) {
    const sub = args._[1];

    if (sub === 'eval') {
        const expr = args._[2];
        if (!expr) { console.error('Usage: s.js game eval <expression>'); process.exit(1); }
        const cdp = await CDP.connect('game.html');
        try { console.log(JSON.stringify(await cdp.eval(expr), null, 2)); }
        finally { cdp.close(); }
    }
    else if (sub === 'shot') {
        const outPath = args._[2];
        if (!outPath) { console.error('Usage: s.js game shot <output.png> [--clip x,y,w,h]'); process.exit(1); }
        const cdp = await CDP.connect('game.html');
        try {
            const clipOpt = args.clip ? { clip: parseRect(args.clip) } : {};
            let buf = await cdp.screenshot(clipOpt);
            if (args.mark) buf = await annotate(buf, [parseMarkRect(args.mark)]);
            fs.writeFileSync(outPath, buf);
            console.log(`OK ${outPath}`);
        } finally { cdp.close(); }
    }
    else if (sub === 'tree') {
        const depth = parseInt(args._[2]) || 4;
        const cdp = await CDP.connect('game.html');
        try {
            const tree = await cdp.eval(`(function(){
                function d(n,dep){if(dep>${depth})return'';var s='  '.repeat(dep)+n.name+' ('+n.constructor.name+') vis:'+n.visible+'\\n';
                for(var i=0;i<(n.numChildren||0);i++)s+=d(n.getChildAt(i),dep+1);return s;}
                return d(Laya.stage,0);
            })()`);
            console.log(tree);
        } finally { cdp.close(); }
    }
    else if (sub === 'click') {
        const coords = args._[2];
        if (!coords) { console.error('Usage: s.js game click <x,y>'); process.exit(1); }
        const [gx, gy] = coords.split(',').map(Number);
        const cdp = await CDP.connect('game.html');
        try {
            const r = await cdp.eval(`(function(){
                var c=document.querySelector('canvas');if(!c)return 'no canvas';
                var r=c.getBoundingClientRect();
                ['mousedown','mouseup','click'].forEach(function(type){
                    c.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,clientX:r.left+${gx},clientY:r.top+${gy},button:0}));
                });
                return 'ok click at '+(r.left+${gx})+','+(r.top+${gy});
            })()`);
            console.log(r);
        } finally { cdp.close(); }
    }
    else {
        console.error('Usage: s.js game <eval|shot|tree|click> ...');
    }
}

// ─── 原生菜单 (UI Automation) ─────────────────────────────────

// 统一 PS 调用：永远走 cmd /c chcp + powershell -File，杜绝内联转义
function runPS(script, args = '') {
    const ps = path.join(TOOLS, script);
    return execSync(`cmd /c "chcp 65001 >nul && powershell -NoProfile -ExecutionPolicy Bypass -File "${ps}" ${args}"`,
        { encoding: 'utf8', timeout: 8000 }).trim();
}

// 获取菜单栏按钮列表
function getMenubarButtons(filter = '') {
    try {
        const out = runPS('get_menubar.ps1', filter ? `-buttonText "${filter}"` : '');
        if (!out) return [];
        return out.split('\n').map(line => {
            const [name, x, y, w, h, cx, cy] = line.trim().split('|');
            return { name, x: +x, y: +y, w: +w, h: +h, cx: +cx, cy: +cy };
        }).filter(b => b.w > 0);
    } catch { return []; }
}

function findMenuItems(filter) {
    try {
        const out = runPS('find_menu.ps1', filter ? `-itemText "${filter}"` : '');
        if (!out) return [];
        return out.split('\n').map(line => {
            const [type, name, x, y, w, h] = line.trim().split('|');
            return { type, name, x: +x, y: +y, w: +w, h: +h, isMenu: type !== 'MenuItem' };
        }).filter(m => m.w > 0);
    } catch { return []; }
}

async function cmdMenu(args) {
    const filter = args._[1] || '';
    const items = findMenuItems(filter);
    if (items.length === 0) { console.log('No menu items found (is a menu open?)'); return; }
    for (const m of items) {
        const cx = m.x + Math.round(m.w / 2), cy = m.y + Math.round(m.h / 2);
        console.log(`${m.isMenu ? 'MENU' : 'ITEM'} "${m.name}" screen(${m.x},${m.y}) ${m.w}x${m.h} center(${cx},${cy})`);
    }
}

async function cmdMenuClick(args) {
    const target = args._[1];
    if (!target) { console.error('Usage: s.js menu-click "menuItemText"'); process.exit(1); }
    const items = findMenuItems(target);
    const item = items.find(m => !m.isMenu && m.name.includes(target));
    if (!item) { console.log(`Menu item "${target}" not found`); return; }
    const cx = item.x + Math.round(item.w / 2), cy = item.y + Math.round(item.h / 2);
    await realClick(cx, cy);
    console.log(`OK click "${item.name}" screen(${cx},${cy})`);
}

// 右键→等菜单→标注菜单项→窗口截图  一条龙
// 菜单栏命令：列出按钮
async function cmdMenubar(args) {
    const filter = args._[1] || '';
    const buttons = getMenubarButtons(filter);
    if (buttons.length === 0) { console.log('No menubar buttons found'); return; }
    for (const b of buttons) {
        console.log(`BUTTON "${b.name}" screen(${b.x},${b.y}) ${b.w}x${b.h} center(${b.cx},${b.cy})`);
    }
}

// 菜单栏命令：点击按钮
async function cmdMenubarClick(args) {
    const target = args._[1];
    if (!target) { console.error('Usage: s.js menubar-click "buttonText"'); process.exit(1); }
    const buttons = getMenubarButtons(target);
    const btn = buttons.find(b => b.name.includes(target));
    if (!btn) { console.log(`Menubar button "${target}" not found`); return; }
    await realClick(btn.cx, btn.cy);
    console.log(`OK click "${btn.name}" screen(${btn.cx},${btn.cy})`);
}

async function cmdRclickMenu(args) {
    const nodeText = args._[1];      // 右键哪个节点
    const menuText = args._[2];      // 标注哪个菜单项
    const outPath = args._[3];       // 输出文件
    if (!nodeText || !outPath) {
        console.error('Usage: s.js rclick-menu "Scene2D" "menuItem" out.png [--click]');
        process.exit(1);
    }

    // 1. 右键节点
    const cdp = await CDP.connect();
    const results = await cdp.findText(nodeText, { hierarchy: true });
    const el = results?.[0];
    if (!el) { console.log(`"${nodeText}" not found`); cdp.close(); return; }
    const win = getWindowRect();
    const chrome = await cdp.eval(`({chromeH:window.outerHeight-window.innerHeight,chromeW:window.outerWidth-window.innerWidth})`);
    cdp.close();

    const screen = cdpToScreen(el.cx, el.cy, win, chrome);
    await realClick(screen.x, screen.y, true);
    await new Promise(r => setTimeout(r, 600));

    // 2. 找菜单项
    const items = findMenuItems(menuText || '');
    const target = menuText ? items.find(m => !m.isMenu && m.name.includes(menuText)) : null;

    // 3. 窗口截图 + 标注
    const fullBuf = await fullscreenCapture();
    let buf = await sharp(fullBuf).extract({ left: win.x, top: win.y, width: win.w, height: win.h }).toBuffer();
    if (target) {
        // 屏幕坐标 → 窗口内坐标
        const mx = target.x - win.x, my = target.y - win.y;
        buf = await annotate(buf, [{ x: mx, y: my, w: target.w, h: target.h }]);
    }
    fs.writeFileSync(outPath, buf);
    console.log(`OK ${outPath}` + (target ? ` (marked "${target.name}")` : ''));

    // 4. 可选：点击该菜单项
    if (args.click && target) {
        const cx = target.x + Math.round(target.w / 2), cy = target.y + Math.round(target.h / 2);
        await realClick(cx, cy);
        console.log(`Clicked "${target.name}"`);
    } else {
        // 按 Escape 关闭菜单
        const { keyboard, Key } = await getMouse();
        await keyboard.pressKey(Key.Escape);
        await keyboard.releaseKey(Key.Escape);
    }
}

// ─── GIF 录制 ───────────────────────────────────────────────────

async function cmdGif(args) {
    const { spawn } = require('child_process');
    const gifPath = path.join(TOOLS, 'make_gif.js');
    const output = args._[1] || 'output.gif';

    // 构建 make_gif.js 的参数
    const gifArgs = [output];
    if (args.frames) gifArgs.push('--frames', args.frames);
    if (args.fps) gifArgs.push('--fps', args.fps);
    if (args.width) gifArgs.push('--width', args.width);
    if (args.crop) gifArgs.push('--crop', args.crop);
    if (args.game) gifArgs.push('--game');
    if (args.keep) gifArgs.push('--keep');

    return new Promise((resolve, reject) => {
        const proc = spawn('node', [gifPath, ...gifArgs], { stdio: 'inherit' });
        proc.on('close', code => code === 0 ? resolve() : reject(new Error(`GIF failed: ${code}`)));
        proc.on('error', reject);
    });
}

// ─── main ────────────────────────────────────────────────────

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const cmd = args._[0];

    switch (cmd) {
        case 'shot': return cmdShot(args);
        case 'win':  return cmdWin(args);
        case 'find': return cmdFind(args);
        case 'list': return cmdList(args);
        case 'click':
        case 'rclick': return cmdClick(args);
        case 'menubar': return cmdMenubar(args);
        case 'menubar-click': return cmdMenubarClick(args);
        case 'menu': return cmdMenu(args);
        case 'menu-click': return cmdMenuClick(args);
        case 'rclick-menu': return cmdRclickMenu(args);
        case 'game': return cmdGame(args);
        case 'gif': return cmdGif(args);
        default:
            console.log(`Usage: s.js <command> ...
  shot  out.png [--clip x,y,w,h] [--mark x,y,w,h]    CDP截图
  win   out.png [--crop x,y,w,h] [--mark x,y,w,h]    窗口截图(含菜单)
  find  "text" [--hierarchy] [--partial]               查找元素
  list  [--hierarchy] [--buttons]                      列出所有可见元素
  click "text" / rclick "text"                         鼠标点击
  menubar ["filter"]                                   列出菜单栏按钮
  menubar-click "text"                                 点击菜单栏按钮
  menu  ["filter"]                                     列出原生菜单项
  menu-click "text"                                    点击原生菜单项
  rclick-menu "node" "menuItem" out.png [--click]      右键→标注→截图
  game  eval|shot|tree|click                           游戏target
  gif   out.gif [--frames N] [--fps N] [--width N]     录制GIF动图
        [--crop x,y,w,h] [--game] [--keep]`);
    }
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
