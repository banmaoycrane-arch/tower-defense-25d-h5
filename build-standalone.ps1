$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$css = Get-Content "$base\css\style.css" -Raw -Encoding UTF8
$js = Get-Content "$base\js\game.js" -Raw -Encoding UTF8
$outPath = "c:\Users\banmao\Desktop\3D-Tower-Defense-Game.html"

$html = @"
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>3D 塔防小游戏</title>
<style>
$css
</style>
</head>
<body>
<div id="game-container">
<canvas id="game-canvas"></canvas>
<div id="hud-top" class="hud-panel">
<div class="stat"><span class="icon">💰</span><span id="gold">200</span></div>
<div class="stat"><span class="icon">❤️</span><span id="lives">20</span></div>
<div class="stat"><span class="icon">🌊</span>第 <span id="wave">0</span> 波</div>
<div class="stat"><span class="icon">👾</span><span id="enemies-left">0</span></div>
</div>
<div id="hud-bottom" class="hud-panel">
<div class="tower-btn selected" data-tower="archer"><div class="tower-icon archer"></div><div class="tower-name">弓箭塔</div><div class="tower-cost">50💰</div></div>
<div class="tower-btn" data-tower="cannon"><div class="tower-icon cannon"></div><div class="tower-name">火炮塔</div><div class="tower-cost">120💰</div></div>
<div class="tower-btn" data-tower="frost"><div class="tower-icon frost"></div><div class="tower-name">冰冻塔</div><div class="tower-cost">80💰</div></div>
<button id="start-wave-btn" class="action-btn">开始下一波</button>
<button id="speed-btn" class="action-btn secondary">⏩ 加速</button>
</div>
<div id="start-screen" class="overlay">
<div class="overlay-content">
<h1>🏰 3D 塔防</h1>
<p>敌人会沿路径进攻基地，在绿色地块上建造防御塔！</p>
<ul class="tips">
<li>🎯 <b>弓箭塔</b> — 攻速快，适合对付普通敌人</li>
<li>💣 <b>火炮塔</b> — 范围伤害，对付成群敌人</li>
<li>❄️ <b>冰冻塔</b> — 减速敌人，配合其他塔使用</li>
</ul>
<button id="play-btn" class="action-btn large">开始游戏</button>
</div>
</div>
<div id="gameover-screen" class="overlay hidden">
<div class="overlay-content">
<h1 id="result-title">游戏结束</h1>
<p id="result-desc"></p>
<button id="restart-btn" class="action-btn large">再来一局</button>
</div>
</div>
</div>
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
<script>
$js
</script>
</body>
</html>
"@

[System.IO.File]::WriteAllText($outPath, $html, [System.Text.UTF8Encoding]::new($false))
Write-Host "Created: $outPath"
