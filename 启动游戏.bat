@echo off
chcp 65001 >nul
title 3D塔防 - 本地服务器
cd /d "%~dp0"

echo ========================================
echo   3D 塔防小游戏 - 正在启动...
echo ========================================
echo.

:: 优先用 Python 启动本地服务器
where python >nul 2>&1
if %errorlevel%==0 (
    echo [OK] 使用 Python 启动服务器
    echo [OK] 游戏地址: http://localhost:8080
    echo.
    echo 浏览器会自动打开，关闭此窗口即可停止游戏
    echo ========================================
    start "" "http://localhost:8080"
    python -m http.server 8080
    goto :end
)

:: 备用：Node.js
where node >nul 2>&1
if %errorlevel%==0 (
    echo [OK] 使用 Node.js 启动服务器
    echo [OK] 游戏地址: http://localhost:8080
    echo.
    start "" "http://localhost:8080"
    npx --yes serve -p 8080 .
    goto :end
)

:: 都没有则直接打开 HTML
echo [提示] 未找到 Python/Node，尝试直接打开游戏文件...
start "" "%~dp0index.html"
echo 如果页面空白，请安装 Python 后重新运行此脚本
pause

:end
