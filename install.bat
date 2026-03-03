@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo ========================================
echo   LayaAir 文档工具链 - 安装向导
echo ========================================
echo.

REM 检查 Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js 16+
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/4] 检测到 Node.js:
node --version
echo.

REM 检查 npm
where npm >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 npm
    pause
    exit /b 1
)

echo [2/4] 安装依赖包...
call npm install
if errorlevel 1 (
    echo [错误] npm install 失败
    pause
    exit /b 1
)
echo.

echo [3/4] 验证工具链...
node s.js find --help >nul 2>nul
if errorlevel 1 (
    echo [警告] 工具验证失败，请检查 Node.js 版本
) else (
    echo [OK] 工具链验证通过
)
echo.

echo [4/4] 创建快捷命令...
REM 创建全局命令（可选）
echo 要创建全局命令 'laya-doc' 吗？(Y/N)
set /p create_global=
if /i "!create_global!"=="Y" (
    call npm link
    if not errorlevel 1 (
        echo [OK] 全局命令创建成功，现在可以直接使用 'laya-doc' 或 's'
    )
)
echo.

echo ========================================
echo   安装完成！
echo ========================================
echo.
echo 使用方法:
echo   node s.js shot output.png        # 截图
echo   node s.js find "Player"          # 查找元素
echo   node s.js click "Player"         # 点击
echo   node s.js menu                   # 菜单
echo.
echo 详细文档请查看 README.md
echo.
pause
