@echo off
REM 快捷命令：s.bat
REM 用法：s shot output.png 或 s find "Player"

setlocal
chcp 65001 >nul

set SCRIPT_DIR=%~dp0
set NODE_CMD=node "%SCRIPT_DIR%s.js"

REM 处理中文字符参数
set ARGS=
:parse_args
if "%~1"=="" goto done_parsing
set "ARGS=%ARGS% %~1"
shift
goto parse_args
:done_parsing

%NODE_CMD% %ARGS%
