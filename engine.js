/* engine.js - Labirinto 2D com Geração Procedural e Sistema de Tiro */

let canvas, ctx;
let tileSize = 32;
let cols = 20,
  rows = 15;
let mapGrid = [];
let entities = [];
let bullets = []; // Array para armazenar balas
let keys = {};
let gameRunning = false;
let lastTime = 0;
let accumTime = 0;
let elapsedSeconds = 0;
let gameState = {};
let shootCooldown = 0;
let canShoot = true;
let mouseX = 0,
  mouseY = 0; // Armazenar posição do mouse

// Parâmetros de tiro do jogador
let playerShootParams = {
  cooldown: 0.3, // Cooldown reduzido para tiro mais rápido
  bulletSpeed: 500,
  bulletDamage: 1,
};

// Parâmetros de geração
let generationParams = {
  width: 20,
  height: 15,
  difficulty: "medium",
  enemies: 3,
  coins: 10,
  minSpeed: 1.2,
  maxSpeed: 2.0,
};

// Função para log (definida globalmente para ser usada em toda parte)
function log(msg) {
  let now = new Date();
  let timeStr = now.toLocaleTimeString("pt-BR", { hour12: false });
  $("#logArea").prepend(`<div>[${timeStr}] ${msg}</div>`);
  // Limitar a 20 mensagens no log
  let logs = $("#logArea").children();
  if (logs.length > 20) {
    logs.last().remove();
  }
}

$(document).ready(function () {
  console.log("Documento pronto, inicializando jogo...");

  /* MENU PRINCIPAL - Event Listeners */
  $("#btnPlay").on("click", function () {
    console.log("Botão Jogar clicado!");
    resetGameState();
    $("#levelTitle").text("Labirinto — Nível Aleatório");
    $("#levelDesc").text(
      "Encontre o caminho até a saída (X), evite inimigos e atire!"
    );

    $("#mainMenu").hide();
    $("#gameContainer").show();
    generateRandomMaze();
    startLevel();
    log("Jogo iniciado! Clique no canvas para atirar.");
  });

  $("#btnInstructions").on("click", function () {
    console.log("Botão Instruções clicado!");
    $("#menuInfo").html(`
      <b>Instruções:</b><br>
      1. Use WASD ou Setas para mover o personagem azul<br>
      2. <strong>CLIQUE COM O MOUSE</strong> para atirar na direção do cursor<br>
      3. Colete moedas amarelas (+1 ponto)<br>
      4. Elimine inimigos vermelhos (+2 moedas)<br>
      5. Encontre a saída verde (X) para vencer<br>
      6. Evite colidir com inimigos (perde vida)<br>
      <i>O labirinto é gerado aleatoriamente a cada partida!</i>
    `);
  });

  $("#btnCredits").on("click", function () {
    console.log("Botão Créditos clicado!");
    $("#menuInfo").html(`
      <b>Créditos:</b><br>
      • Desenvolvido para a disciplina Programação Web I<br>
      • Sistema de labirinto procedural com algoritmo DFS<br>
      • Mecânica de tiro com mouse<br>
      • Interface com Bootstrap 5<br>
      • Controles responsivos (teclado e mouse)<br>
      • Sistema de log de eventos em tempo real
    `);
  });

  $("#btnBackMenu").on("click", function () {
    pauseGame();
    $("#gameContainer").hide();
    $("#mainMenu").show();
    log("Voltou ao menu principal");
  });

  $("#btnPause").on("click", function () {
    pauseGame();
  });

  $("#btnRestart").on("click", function () {
    resetGameState();
    generateRandomMaze();
    startLevel();
    log("Jogo reiniciado!");
  });

  $("#btnNewMap").on("click", function () {
    generateRandomMaze();
    renderOnce();
    log("Novo labirinto gerado!");
  });

  $("#clearLog").on("click", function () {
    $("#logArea").empty();
    $("#logArea").html('<div class="text-muted">Log limpo...</div>');
  });

  // Inicializar canvas
  canvas = document.getElementById("gameCanvas");
  ctx = canvas.getContext("2d");

  // Configurar controle de teclado (apenas movimento)
  window.addEventListener("keydown", function (e) {
    keys[e.key] = true;
  });

  window.addEventListener("keyup", function (e) {
    keys[e.key] = false;
  });

  // Rastrear posição do mouse
  canvas.addEventListener("mousemove", function (e) {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });

  // Atirar com clique do mouse
  canvas.addEventListener("mousedown", function (e) {
    if (e.button === 0 && canShoot) {
      // Botão esquerdo do mouse
      e.preventDefault();
      shootBullet(mouseX, mouseY);
    }
  });

  // Prevenir menu de contexto do botão direito
  canvas.addEventListener("contextmenu", function (e) {
    e.preventDefault();
    return false;
  });

  // Focar no canvas para capturar teclas
  canvas.addEventListener("click", function () {
    canvas.focus();
  });

  console.log("Jogo inicializado com sucesso!");
  log("Sistema pronto. Clique em 'Jogar' para começar!");
});

/* ------------ RESET ----------- */
function resetGameState() {
  gameRunning = false;
  elapsedSeconds = 0;
  accumTime = 0;
  gameState = { coins: 0, time: 0 };
  entities = [];
  bullets = []; // Limpar balas
  mapGrid = [];
  canShoot = true;
  shootCooldown = 0;
  mouseX = 0;
  mouseY = 0;
}

/* ------------ FUNÇÃO DE TIRO ------------- */
function shootBullet(targetX = null, targetY = null) {
  let player = entities.find((e) => e.type === "player");
  if (!player || !canShoot) return;

  // Calcular direção do tiro baseada na posição do mouse
  let dx, dy;

  if (targetX !== null && targetY !== null) {
    // Tiro com mouse - calcular direção para o cursor
    dx = targetX - player.x;
    dy = targetY - player.y;
  } else {
    // Fallback: atirar para a direita se não houver posição do mouse
    dx = 1;
    dy = 0;
  }

  // Normalizar vetor de direção
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length > 0) {
    dx /= length;
    dy /= length;
  } else {
    dx = 1;
    dy = 0; // Direção padrão se vetor for zero
  }

  // Criar bala
  bullets.push({
    x: player.x,
    y: player.y,
    dx: dx,
    dy: dy,
    speed: playerShootParams.bulletSpeed,
    damage: playerShootParams.bulletDamage,
    radius: tileSize * 0.15,
    lifeTime: 1.5, // segundos (reduzido)
    alive: true,
  });

  // Ativar cooldown
  canShoot = false;
  shootCooldown = playerShootParams.cooldown;

  log("Tiro disparado!");
}

/* ------------ ATUALIZAR BALAS ------------- */
function updateBullets(dt) {
  // Atualizar cooldown
  if (!canShoot) {
    shootCooldown -= dt;
    if (shootCooldown <= 0) {
      canShoot = true;
    }
  }

  // Atualizar posição das balas
  for (let i = bullets.length - 1; i >= 0; i--) {
    let b = bullets[i];

    if (!b.alive) {
      bullets.splice(i, 1);
      continue;
    }

    // Atualizar posição
    b.x += b.dx * b.speed * dt;
    b.y += b.dy * b.speed * dt;
    b.lifeTime -= dt;

    // Verificar colisão com paredes
    if (collidesWall(b.x, b.y, b.radius)) {
      b.alive = false;
      continue;
    }

    // Verificar se saiu da tela
    if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
      b.alive = false;
      continue;
    }

    // Verificar tempo de vida
    if (b.lifeTime <= 0) {
      b.alive = false;
      continue;
    }

    // Verificar colisão com inimigos
    for (let enemy of entities.filter((e) => e.type === "enemy" && e.alive)) {
      if (circleCollide(b, enemy)) {
        enemy.alive = false;
        b.alive = false;

        // Remover inimigo
        entities = entities.filter((e) => e !== enemy);
        log("Inimigo eliminado! +2 moedas");

        // Dar recompensa por matar inimigo
        gameState.coins += 2;
        break;
      }
    }
  }
}

/* ------------ GERAÇÃO DE LABIRINTO ------------- */
function generateRandomMaze() {
  cols = generationParams.width;
  rows = generationParams.height;

  // Inicializar mapa com paredes
  mapGrid = Array(rows)
    .fill()
    .map(() => Array(cols).fill("1"));

  // Usar algoritmo de backtracking para gerar labirinto
  generateMazeDFS();

  // Garantir bordas
  for (let r = 0; r < rows; r++) {
    mapGrid[r][0] = "1";
    mapGrid[r][cols - 1] = "1";
  }
  for (let c = 0; c < cols; c++) {
    mapGrid[0][c] = "1";
    mapGrid[rows - 1][c] = "1";
  }

  // Calcular tileSize
  tileSize = Math.floor(Math.min(640 / cols, 480 / rows));
  canvas.width = cols * tileSize;
  canvas.height = rows * tileSize;

  // Limpar entidades antigas e balas
  entities = [];
  bullets = [];
  gameState = { coins: 0, time: 0 };
  canShoot = true;
  shootCooldown = 0;

  // Posicionar jogador no canto superior esquerdo
  let playerX = 1;
  let playerY = 1;
  mapGrid[playerY][playerX] = "0";
  let px = playerX * tileSize + tileSize / 2;
  let py = playerY * tileSize + tileSize / 2;

  entities.push({
    type: "player",
    x: px,
    y: py,
    startX: px,
    startY: py,
    radius: tileSize * 0.35,
    life: 5,
    maxLife: 5,
    speed: 3,
  });

  // Posicionar saída no canto inferior direito
  let exitX = cols - 2;
  let exitY = rows - 2;
  mapGrid[exitY][exitX] = "0";
  entities.push({
    type: "exit",
    x: exitX * tileSize + tileSize / 2,
    y: exitY * tileSize + tileSize / 2,
    radius: tileSize * 0.4,
  });

  // Posicionar inimigos em posições aleatórias
  let enemyCount = generationParams.enemies;
  for (let i = 0; i < enemyCount; i++) {
    let pos = findEmptyCell();
    if (pos) {
      let patrolType = Math.random() > 0.5 ? "horizontal" : "vertical";
      let direction =
        patrolType === "horizontal"
          ? Math.random() > 0.5
            ? "right"
            : "left"
          : Math.random() > 0.5
          ? "down"
          : "up";

      entities.push({
        type: "enemy",
        x: pos.x * tileSize + tileSize / 2,
        y: pos.y * tileSize + tileSize / 2,
        radius: tileSize * 0.33,
        patrol: patrolType,
        dir: direction,
        speed:
          generationParams.minSpeed +
          Math.random() *
            (generationParams.maxSpeed - generationParams.minSpeed),
        damage: 1,
        alive: true,
      });
    }
  }

  // Posicionar moedas
  let coinCount = generationParams.coins;
  for (let i = 0; i < coinCount; i++) {
    let pos = findEmptyCell();
    if (pos) {
      entities.push({
        type: "coin",
        x: pos.x * tileSize + tileSize / 2,
        y: pos.y * tileSize + tileSize / 2,
        radius: tileSize * 0.25,
        value: 1,
      });
    }
  }

  log(
    `Labirinto ${cols}x${rows} gerado com ${enemyCount} inimigos e ${coinCount} moedas.`
  );
  log("Use o mouse para mirar e clicar para atirar!");
}

function generateMazeDFS() {
  // Inicializar com células visitadas
  let visited = Array(rows)
    .fill()
    .map(() => Array(cols).fill(false));

  // Escolher ponto de partida ímpar (para garantir caminhos)
  let startX = 1;
  let startY = 1;

  let stack = [{ x: startX, y: startY }];
  visited[startY][startX] = true;
  mapGrid[startY][startX] = "0";

  // Direções: cima, direita, baixo, esquerda
  let directions = [
    { dx: 0, dy: -2 },
    { dx: 2, dy: 0 },
    { dx: 0, dy: 2 },
    { dx: -2, dy: 0 },
  ];

  while (stack.length > 0) {
    let current = stack[stack.length - 1];
    let { x, y } = current;

    // Embaralhar direções
    let shuffledDirs = [...directions].sort(() => Math.random() - 0.5);
    let found = false;

    for (let dir of shuffledDirs) {
      let nx = x + dir.dx;
      let ny = y + dir.dy;

      if (
        nx > 0 &&
        nx < cols - 1 &&
        ny > 0 &&
        ny < rows - 1 &&
        !visited[ny][nx]
      ) {
        // Remover parede entre as células
        mapGrid[y + dir.dy / 2][x + dir.dx / 2] = "0";
        mapGrid[ny][nx] = "0";

        visited[ny][nx] = true;
        stack.push({ x: nx, y: ny });
        found = true;
        break;
      }
    }

    if (!found) {
      stack.pop();
    }
  }

  // Garantir que algumas paredes extras sejam removidas para mais conectividade
  let extraRemovals = Math.floor(cols * rows * 0.05);
  for (let i = 0; i < extraRemovals; i++) {
    let x = Math.floor(Math.random() * (cols - 2)) + 1;
    let y = Math.floor(Math.random() * (rows - 2)) + 1;
    if (mapGrid[y][x] === "1") {
      mapGrid[y][x] = "0";
    }
  }
}

function findEmptyCell() {
  let attempts = 0;
  while (attempts < 100) {
    let x = Math.floor(Math.random() * (cols - 2)) + 1;
    let y = Math.floor(Math.random() * (rows - 2)) + 1;

    // Verificar se é caminho livre e não tem entidade
    if (mapGrid[y][x] === "0") {
      let hasEntity = entities.some((e) => {
        let ex = Math.floor(e.x / tileSize);
        let ey = Math.floor(e.y / tileSize);
        return ex === x && ey === y;
      });

      if (!hasEntity) {
        return { x, y };
      }
    }
    attempts++;
  }
  return null;
}

/* ------------ LOOP ------------- */
function startLevel() {
  renderOnce();
  startGame();
}

function startGame() {
  if (gameRunning) return;
  gameRunning = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
  log("Jogo iniciado!");
}

function pauseGame() {
  gameRunning = !gameRunning;
  if (gameRunning) {
    lastTime = performance.now();
    requestAnimationFrame(loop);
    log("Jogo retomado.");
  } else {
    log("Jogo pausado.");
  }
}

function loop(t) {
  if (!gameRunning) return;

  let dt = (t - lastTime) / 1000;
  lastTime = t;

  accumTime += dt;
  if (accumTime >= 1) {
    elapsedSeconds++;
    accumTime = 0;
  }

  update(dt);
  renderOnce();
  requestAnimationFrame(loop);
}

/* ------------ UPDATE ------------- */
function update(dt) {
  let p = entities.find((e) => e.type === "player");
  if (!p) return;

  let mx = 0,
    my = 0;
  if (keys["ArrowUp"] || keys["w"]) my = -1;
  if (keys["ArrowDown"] || keys["s"]) my = 1;
  if (keys["ArrowLeft"] || keys["a"]) mx = -1;
  if (keys["ArrowRight"] || keys["d"]) mx = 1;

  let speed = (p.speed * tileSize) / 16;
  let nx = p.x + mx * speed * dt * 60;
  let ny = p.y + my * speed * dt * 60;

  if (!collidesWall(nx, p.y, p.radius)) p.x = nx;
  if (!collidesWall(p.x, ny, p.radius)) p.y = ny;

  // Atualizar balas
  updateBullets(dt);

  for (let e of entities) {
    if (e.type === "enemy" && e.alive) {
      updateEnemy(e, dt);

      if (circleCollide(p, e)) {
        p.life -= e.damage;
        log("Você levou dano! -1 vida");

        if (p.life <= 0) {
          p.life = p.maxLife;
          p.x = p.startX;
          p.y = p.startY;
          gameState.coins = Math.floor(gameState.coins / 2);
          log("Você morreu e perdeu metade das moedas!");
        }
      }
    }
  }

  for (let c of entities.filter((e) => e.type === "coin")) {
    if (circleCollide(p, c)) {
      entities = entities.filter((x) => x !== c);
      gameState.coins++;
      log("Moeda coletada! +1 moeda");
    }
  }

  let exit = entities.find((e) => e.type === "exit");
  if (exit && circleCollide(p, exit)) {
    pauseGame();
    setTimeout(() => {
      alert(
        `🎉 Parabéns! Você concluiu o labirinto!\nMoedas: ${gameState.coins}\nTempo: ${gameState.time}s`
      );
      $("#gameContainer").hide();
      $("#mainMenu").show();
    }, 200);
  }

  gameState.time = elapsedSeconds;
}

/* ------------ COLISÕES ------------- */
function collidesWall(x, y, r) {
  const samples = [
    { x: x - r, y: y },
    { x: x + r, y: y },
    { x: x, y: y - r },
    { x: x, y: y + r },
  ];

  for (let s of samples) {
    const c = Math.floor(s.x / tileSize);
    const rr = Math.floor(s.y / tileSize);

    if (rr < 0 || c < 0 || rr >= rows || c >= cols) return true;
    if (!mapGrid[rr] || typeof mapGrid[rr][c] === "undefined") return true;
    if (mapGrid[rr][c] === "1") return true;
  }

  return false;
}

function circleCollide(a, b) {
  let dx = a.x - b.x;
  let dy = a.y - b.y;
  return dx * dx + dy * dy < (a.radius + b.radius) ** 2;
}

/* ------------ INIMIGO ------------- */
function updateEnemy(e, dt) {
  let s = ((e.speed * tileSize) / 16) * dt * 60;
  let nx = e.x,
    ny = e.y;

  if (e.patrol === "horizontal") {
    nx += e.dir === "right" ? s : -s;
  } else if (e.patrol === "vertical") {
    ny += e.dir === "down" ? s : -s;
  }

  if (collidesWall(nx, ny, e.radius)) {
    if (e.patrol === "horizontal") {
      e.dir = e.dir === "right" ? "left" : "right";
    } else if (e.patrol === "vertical") {
      e.dir = e.dir === "down" ? "up" : "down";
    }
  } else {
    e.x = nx;
    e.y = ny;
  }
}

/* ------------ RENDER ------------- */
function renderOnce() {
  if (!ctx) return;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawMap();
  drawEntities();
  drawBullets(); // Renderizar balas

  let player = entities.find((e) => e.type === "player");
  if (player) {
    $("#lifeText").text(player.life);
  }
  $("#coinsText").text(gameState.coins);
  $("#timeText").text(gameState.time);

  // Mostrar mira do mouse (ponto de referência)
  if (gameRunning) {
    // Desenhar linha do jogador até a posição do mouse (mira)
    if (player) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(mouseX, mouseY);
      ctx.stroke();

      // Desenhar círculo na posição do mouse
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Mostrar cooldown do tiro
  if (!canShoot) {
    ctx.fillStyle = "rgba(255, 100, 100, 0.8)";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      `RECARREGANDO... ${shootCooldown.toFixed(1)}s`,
      canvas.width / 2,
      25
    );
  } else if (gameRunning) {
    ctx.fillStyle = "rgba(100, 255, 100, 0.8)";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("PRONTO PARA ATIRAR", canvas.width / 2, 25);
  }

  // Instrução de tiro
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText("CLIQUE PARA ATIRAR", canvas.width / 2, canvas.height - 15);
}

function drawMap() {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let x = c * tileSize,
        y = r * tileSize;

      if (mapGrid[r][c] === "1") {
        ctx.fillStyle = "#333";
        ctx.fillRect(x, y, tileSize, tileSize);

        // Adicionar textura às paredes
        ctx.fillStyle = "#444";
        ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
      } else {
        ctx.fillStyle = "#1c1c1c";
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }
  }
}

function drawEntities() {
  for (let e of entities) {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);

    if (e.type === "player") {
      ctx.fillStyle = "#2b8cff";
      ctx.fill();
      // Olho do jogador
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(
        e.x - e.radius / 3,
        e.y - e.radius / 3,
        e.radius / 4,
        0,
        Math.PI * 2
      );
      ctx.fill();
    } else if (e.type === "enemy") {
      ctx.fillStyle = "#e74c3c";
      ctx.fill();
      // Detalhe do inimigo
      ctx.fillStyle = "#8b0000";
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === "coin") {
      ctx.fillStyle = "#f1c40f";
      ctx.fill();
      // Brilho da moeda
      ctx.fillStyle = "#ffeb3b";
      ctx.beginPath();
      ctx.arc(
        e.x - e.radius / 3,
        e.y - e.radius / 3,
        e.radius / 3,
        0,
        Math.PI * 2
      );
      ctx.fill();
    } else if (e.type === "exit") {
      ctx.fillStyle = "#16a34a";
      ctx.fill();
      // "X" da saída
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(e.x - e.radius / 2, e.y - e.radius / 2);
      ctx.lineTo(e.x + e.radius / 2, e.y + e.radius / 2);
      ctx.moveTo(e.x + e.radius / 2, e.y - e.radius / 2);
      ctx.lineTo(e.x - e.radius / 2, e.y + e.radius / 2);
      ctx.stroke();
    }

    ctx.closePath();
  }
}

/* ------------ DESENHAR BALAS ------------- */
function drawBullets() {
  for (let b of bullets) {
    if (!b.alive) continue;

    // Balas com efeito de partícula
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffeb3b";
    ctx.fill();

    // Efeito de brilho na bala
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // Rastro da bala
    ctx.beginPath();
    ctx.moveTo(b.x - b.dx * 15, b.y - b.dy * 15);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = "rgba(255, 200, 50, 0.7)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}
