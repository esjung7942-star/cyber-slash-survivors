/**
 * Cyber Slash: Survivors - Core Game Engine
 */

// === 게임 상태 정의 ===
const GameState = {
  TITLE: 'TITLE',
  PLAYING: 'PLAYING',
  LEVEL_UP: 'LEVEL_UP',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER'
};

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.state = GameState.TITLE;

    // 뷰포트 크기 관리
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // 입력 상태
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false, rightDown: false };

    // 카메라
    this.camera = { x: 0, y: 0 };

    // 게임 타이머 및 점수
    this.gameTime = 0; // 초 단위
    this.killCount = 0;
    this.lastTime = performance.now();

    // 화면 흔들림(Screen Shake) 효과
    this.screenShake = 0;

    // 플레이어
    this.player = null;

    // 엔티티 컬렉션
    this.enemies = [];
    this.projectiles = [];
    this.orbitals = [];
    this.slashes = [];
    this.gems = [];
    this.particles = [];
    this.floatingTexts = [];

    // 스폰 관리
    this.spawnTimer = 0;
    this.spawnInterval = 1.0; // 점점 빨라짐
    this.bossSpawnedMinutes = new Set();

    // 업그레이드 정의
    this.initUpgrades();

    // 입력 및 이벤트 리스너 세팅
    this.setupInputs();
    this.setupUIEvents();

    // 애니메이션 루프 시작
    requestAnimationFrame((t) => this.loop(t));
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  initUpgrades() {
    this.upgrades = {
      slash_damage: {
        id: 'slash_damage',
        name: '사이버 소드 연마',
        icon: '⚔️',
        desc: '기본 참격 공격력이 35% 증가합니다.',
        level: 1,
        maxLevel: 5,
        apply: (p) => {
          p.slashDamage = Math.round(p.slashDamage * 1.35);
        }
      },
      slash_rate: {
        id: 'slash_rate',
        name: '광속 베기',
        icon: '⚡',
        desc: '검기 발사 쿨다운이 20% 감소합니다.',
        level: 1,
        maxLevel: 5,
        apply: (p) => {
          p.slashCooldownMax *= 0.8;
        }
      },
      plasma_orb: {
        id: 'plasma_orb',
        name: '플라즈마 오비탈',
        icon: '🔮',
        desc: '주위를 회전하며 적을 소멸시키는 에너지 구체를 소환합니다.',
        level: 0,
        maxLevel: 5,
        apply: (p) => {
          p.orbitalCount++;
          this.rebuildOrbitals();
        }
      },
      lightning_strike: {
        id: 'lightning_strike',
        name: '네온 벼락',
        icon: '🌩️',
        desc: '주기적으로 주변 적에게 무작위 벼락을 내리칩니다.',
        level: 0,
        maxLevel: 5,
        apply: (p) => {
          p.lightningLevel++;
        }
      },
      speed_boost: {
        id: 'speed_boost',
        name: '오버클럭 드라이브',
        icon: '👟',
        desc: '이동 속도가 15% 증가하고 대시 쿨다운이 감소합니다.',
        level: 0,
        maxLevel: 5,
        apply: (p) => {
          p.speed *= 1.15;
          p.dashCooldownMax *= 0.85;
        }
      },
      nano_repair: {
        id: 'nano_repair',
        name: '나노 수리 키트',
        icon: '❤️',
        desc: '최대 체력이 25 증가하고 즉시 50의 HP를 회복합니다.',
        level: 0,
        maxLevel: 5,
        apply: (p) => {
          p.maxHp += 25;
          p.hp = Math.min(p.maxHp, p.hp + 50);
        }
      },
      magnet_field: {
        id: 'magnet_field',
        name: '자기장 흡인기',
        icon: '🧲',
        desc: '경험치 보석을 끌어당기는 자석 반경이 50% 증가합니다.',
        level: 0,
        maxLevel: 4,
        apply: (p) => {
          p.magnetRadius *= 1.5;
        }
      },
      laser_beam: {
        id: 'laser_beam',
        name: '프리즘 레이저 포',
        icon: '🔦',
        desc: '가장 가까운 적을 관통하는 고출력 에너지 광선을 주기적으로 발사합니다.',
        level: 0,
        maxLevel: 5,
        apply: (p) => {
          p.laserLevel++;
        }
      },
      homing_missile: {
        id: 'homing_missile',
        name: '유도 마이크로 미사일',
        icon: '🚀',
        desc: '적을 자동으로 추적하여 폭발하는 유도탄을 연사합니다.',
        level: 0,
        maxLevel: 5,
        apply: (p) => {
          p.missileLevel++;
        }
      },
      nova_shockwave: {
        id: 'nova_shockwave',
        name: '사이오닉 노바 충격파',
        icon: '💥',
        desc: '주기적으로 전방위 360도 충격파를 방출하여 주변 적을 밀어내고 피해를 줍니다.',
        level: 0,
        maxLevel: 5,
        apply: (p) => {
          p.novaLevel++;
        }
      },
      dash_blade: {
        id: 'dash_blade',
        name: '질주 환영참',
        icon: '💨',
        desc: '대시 시 지나간 자리에 적을 베어내는 환영 참격을 남깁니다.',
        level: 0,
        maxLevel: 3,
        apply: (p) => {
          p.dashBladeLevel++;
        }
      }
    };
  }

  resetUpgrades() {
    this.initUpgrades();
  }

  setupInputs() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === 'p' || e.key === 'Escape') {
        if (this.state === GameState.PLAYING) {
          this.pauseGame();
        } else if (this.state === GameState.PAUSED) {
          this.resumeGame();
        }
      }
      if (e.code === 'Space' && this.state === GameState.PLAYING) {
        if (this.player) this.player.triggerDash();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault(); // 우클릭 컨텍스트 메뉴 방지
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouse.down = true;
        if (this.state === GameState.PLAYING && this.player) {
          this.player.attackSlash(this.getMouseWorldPos());
        }
      } else if (e.button === 2) {
        this.mouse.rightDown = true;
        if (this.state === GameState.PLAYING && this.player) {
          this.player.startCharging();
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) {
        this.mouse.rightDown = false;
        if (this.state === GameState.PLAYING && this.player) {
          this.player.releaseCharge(this.getMouseWorldPos());
        }
      }
    });
  }

  setupUIEvents() {
    const startBtn = document.getElementById('startBtn');
    startBtn.addEventListener('click', () => {
      window.soundManager.init();
      window.soundManager.startBGM();
      this.startGame();
    });

    const resumeBtn = document.getElementById('resumeBtn');
    resumeBtn.addEventListener('click', () => this.resumeGame());

    const pauseBtn = document.getElementById('pauseBtn');
    pauseBtn.addEventListener('click', () => this.pauseGame());

    const restartFromPauseBtn = document.getElementById('restartFromPauseBtn');
    restartFromPauseBtn.addEventListener('click', () => this.startGame());

    const retryBtn = document.getElementById('retryBtn');
    retryBtn.addEventListener('click', () => this.startGame());

    const soundToggleBtn = document.getElementById('soundToggleBtn');
    soundToggleBtn.addEventListener('click', () => {
      const on = window.soundManager.toggle();
      soundToggleBtn.textContent = on ? '🔊' : '🔇';
    });
  }

  getMouseWorldPos() {
    return {
      x: this.mouse.x + this.camera.x,
      y: this.mouse.y + this.camera.y
    };
  }

  startGame() {
    this.resetUpgrades();
    this.state = GameState.PLAYING;
    this.gameTime = 0;
    this.killCount = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 0.9;
    this.bossSpawnedMinutes.clear();

    this.enemies = [];
    this.projectiles = [];
    this.orbitals = [];
    this.slashes = [];
    this.gems = [];
    this.particles = [];
    this.floatingTexts = [];

    this.player = new Player(0, 0, this);
    this.rebuildOrbitals();

    // UI 상태 갱신
    document.getElementById('titleScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('pauseScreen').classList.add('hidden');
    document.getElementById('levelUpModal').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');

    this.updateHUD();
    this.updateWeaponSlotsUI();
  }

  pauseGame() {
    if (this.state !== GameState.PLAYING) return;
    this.state = GameState.PAUSED;
    document.getElementById('pauseScreen').classList.remove('hidden');
  }

  resumeGame() {
    if (this.state !== GameState.PAUSED) return;
    this.state = GameState.PLAYING;
    document.getElementById('pauseScreen').classList.add('hidden');
    this.lastTime = performance.now();
  }

  gameOver() {
    this.state = GameState.GAME_OVER;
    window.soundManager.playExplosion();

    document.getElementById('hud').classList.add('hidden');
    const overScreen = document.getElementById('gameOverScreen');
    overScreen.classList.remove('hidden');

    const minutes = Math.floor(this.gameTime / 60);
    const seconds = Math.floor(this.gameTime % 60);
    document.getElementById('finalTime').textContent = 
      `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    document.getElementById('finalKills').textContent = this.killCount;
    document.getElementById('finalLevel').textContent = this.player.level;

    const score = Math.floor(this.gameTime * 25 + this.killCount * 120 + this.player.level * 500);
    document.getElementById('finalScore').textContent = score.toLocaleString();
  }

  triggerLevelUp() {
    this.state = GameState.LEVEL_UP;
    window.soundManager.playLevelUp();

    const modal = document.getElementById('levelUpModal');
    const container = document.getElementById('cardsContainer');
    container.innerHTML = '';

    // 가능한 업그레이드 목록 추출 (최대레벨 미만)
    const available = Object.values(this.upgrades).filter(u => u.level < u.maxLevel);

    // 무작위 3개 선별
    const shuffled = [...available].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);

    if (selected.length === 0) {
      // 전부 마스터한 경우 체력 즉시 회복 보너스 제공
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 60);
      this.state = GameState.PLAYING;
      this.lastTime = performance.now();
      return;
    }

    selected.forEach(upgrade => {
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      card.innerHTML = `
        <div class="upgrade-icon">${upgrade.icon}</div>
        <div class="upgrade-title">${upgrade.name}</div>
        <div class="upgrade-level">LV ${upgrade.level + 1} / ${upgrade.maxLevel}</div>
        <div class="upgrade-desc">${upgrade.desc}</div>
      `;
      card.addEventListener('click', () => {
        upgrade.level++;
        upgrade.apply(this.player);
        this.updateWeaponSlotsUI();
        modal.classList.add('hidden');
        this.state = GameState.PLAYING;
        this.lastTime = performance.now();
      });
      container.appendChild(card);
    });

    modal.classList.remove('hidden');
  }

  rebuildOrbitals() {
    this.orbitals = [];
    const count = this.player.orbitalCount;
    for (let i = 0; i < count; i++) {
      this.orbitals.push(new Orbital(this.player, i, count));
    }
  }

  updateWeaponSlotsUI() {
    const container = document.getElementById('weaponSlots');
    container.innerHTML = '';
    Object.values(this.upgrades).forEach(up => {
      if (up.level > 0) {
        const slot = document.createElement('div');
        slot.className = 'weapon-slot-icon';
        slot.title = `${up.name} (LV ${up.level})`;
        slot.innerHTML = `${up.icon}<span class="weapon-slot-level">L${up.level}</span>`;
        container.appendChild(slot);
      }
    });
  }

  updateHUD() {
    if (!this.player) return;
    const minutes = Math.floor(this.gameTime / 60);
    const seconds = Math.floor(this.gameTime % 60);
    document.getElementById('timerText').textContent = 
      `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    document.getElementById('killText').textContent = this.killCount;

    document.getElementById('playerLevel').textContent = this.player.level;
    document.getElementById('expText').textContent = `${Math.floor(this.player.exp)} / ${this.player.expToNext} EXP`;
    const expPct = Math.min(100, (this.player.exp / this.player.expToNext) * 100);
    document.getElementById('expBarFill').style.width = `${expPct}%`;

    const hpPct = Math.max(0, (this.player.hp / this.player.maxHp) * 100);
    document.getElementById('hpBarFill').style.width = `${hpPct}%`;
    document.getElementById('hpText').textContent = `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`;

    const dashPct = Math.min(100, (1 - this.player.dashCooldown / this.player.dashCooldownMax) * 100);
    document.getElementById('dashBarFill').style.width = `${dashPct}%`;

    const chargeEl = document.getElementById('chargeBarFill');
    if (chargeEl) {
      const chargePct = Math.min(100, (1 - this.player.chargeCooldown / this.player.chargeCooldownMax) * 100);
      chargeEl.style.width = `${chargePct}%`;
    }
  }

  // 적 스폰 로직
  handleSpawning(dt) {
    this.spawnTimer += dt;

    // 난이도 상승 곡선: 시간이 지날수록 스폰 쿨다운 감소 (최소 0.18초)
    this.spawnInterval = Math.max(0.2, 1.0 - (this.gameTime / 300) * 0.75);

    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnEnemy();
    }

    // 매 60초마다 보스 몬스터 등장
    const currentMin = Math.floor(this.gameTime / 60);
    if (currentMin > 0 && !this.bossSpawnedMinutes.has(currentMin)) {
      this.bossSpawnedMinutes.add(currentMin);
      this.spawnBoss(currentMin);
    }
  }

  spawnEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.max(this.canvas.width, this.canvas.height) * 0.6 + 60;
    const x = this.player.x + Math.cos(angle) * distance;
    const y = this.player.y + Math.sin(angle) * distance;

    const r = Math.random();
    let type = 'drone';

    if (this.gameTime > 40 && r < 0.25) {
      type = 'dasher';
    } else if (this.gameTime > 80 && r < 0.45) {
      type = 'tanker';
    } else if (this.gameTime > 120 && r < 0.60) {
      type = 'shooter';
    }

    this.enemies.push(new Enemy(x, y, type, this.gameTime));
  }

  spawnBoss(minute) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 600;
    const x = this.player.x + Math.cos(angle) * distance;
    const y = this.player.y + Math.sin(angle) * distance;

    this.enemies.push(new Enemy(x, y, 'boss', this.gameTime, minute));
    this.addFloatingText(this.player.x, this.player.y - 80, '⚠️ 경고: 거대 사이버 보스 출현! ⚠️', '#ff0055', 30);
    this.screenShake = 15;
  }

  addFloatingText(x, y, text, color = '#fff', size = 16) {
    this.floatingTexts.push({
      x, y, text, color, size,
      alpha: 1,
      vy: -35,
      life: 0.8
    });
  }

  createHitParticles(x, y, color = '#00f3ff', count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 160;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color: color,
        alpha: 1,
        life: 0.3 + Math.random() * 0.3
      });
    }
  }

  // 메인 게임 루프
  loop(currentTime) {
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    if (this.state === GameState.PLAYING) {
      this.update(dt);
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    this.gameTime += dt;
    this.handleSpawning(dt);

    // 플레이어 갱신
    this.player.update(dt, this.keys, this.mouse);

    // 카메라 추적 (플레이어 중심 부드러운 이동)
    const targetCamX = this.player.x - this.canvas.width / 2;
    const targetCamY = this.player.y - this.canvas.height / 2;
    this.camera.x += (targetCamX - this.camera.x) * 0.1;
    this.camera.y += (targetCamY - this.camera.y) * 0.1;

    // 화면 흔들림 감쇠
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }

    // 오비탈 갱신
    this.orbitals.forEach(orb => orb.update(dt));

    // 투사체 갱신 및 충돌
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt);

      if (p.isEnemy) {
        // 적 투사체 -> 플레이어 피격
        const dist = Math.hypot(p.x - this.player.x, p.y - this.player.y);
        if (dist < p.radius + this.player.radius) {
          this.player.takeDamage(p.damage);
          this.projectiles.splice(i, 1);
          continue;
        }
      }

      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
      }
    }

    // 검기(슬래시) 갱신 및 적 피격
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const slash = this.slashes[i];
      slash.update(dt);

      for (let j = 0; j < this.enemies.length; j++) {
        const enemy = this.enemies[j];
        if (slash instanceof MegaSlash) {
          // 대형 검기는 다단히트 및 완전 관통
          if (!slash.hitCooldowns.has(enemy)) {
            const dist = Math.hypot(slash.x - enemy.x, slash.y - enemy.y);
            if (dist < slash.radius + enemy.radius) {
              enemy.takeDamage(slash.damage, slash.vx, slash.vy);
              slash.hitCooldowns.set(enemy, 0.15); // 0.15초마다 재타격
              this.createHitParticles(enemy.x, enemy.y, slash.isFull ? '#ff0077' : '#00f3ff', 8);
              window.soundManager.playHit();
              this.screenShake = Math.max(this.screenShake, slash.isFull ? 8 : 4);
            }
          }
        } else {
          // 일반 검기
          if (!slash.hitEnemies.has(enemy)) {
            const dist = Math.hypot(slash.x - enemy.x, slash.y - enemy.y);
            if (dist < slash.radius + enemy.radius) {
              enemy.takeDamage(slash.damage, slash.vx, slash.vy);
              slash.hitEnemies.add(enemy);
              this.createHitParticles(enemy.x, enemy.y, '#00f3ff', 6);
              window.soundManager.playHit();
            }
          }
        }
      }

      if (slash.life <= 0) {
        this.slashes.splice(i, 1);
      }
    }

    // 적 업데이트 및 상호작용
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(dt, this.player, this);

      // 플레이어 접촉 데미지
      const distToPlayer = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);
      if (distToPlayer < enemy.radius + this.player.radius) {
        this.player.takeDamage(enemy.contactDamage * dt * 3);
      }

      // 오비탈과의 충돌
      this.orbitals.forEach(orb => {
        const orbDist = Math.hypot(orb.x - enemy.x, orb.y - enemy.y);
        if (orbDist < orb.radius + enemy.radius) {
          enemy.takeDamage(orb.damage * dt, orb.vx, orb.vy);
          this.createHitParticles(orb.x, orb.y, '#ff00aa', 2);
        }
      });

      // 적 사망 처리
      if (enemy.hp <= 0) {
        this.killCount++;
        window.soundManager.playExplosion();
        this.createHitParticles(enemy.x, enemy.y, enemy.color, 16);
        this.gems.push(new Gem(enemy.x, enemy.y, enemy.expValue));
        this.enemies.splice(i, 1);
      }
    }

    // 보석(Gem) 업데이트
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const gem = this.gems[i];
      const dist = Math.hypot(gem.x - this.player.x, gem.y - this.player.y);

      // 자석 반경 내 흡인
      if (dist < this.player.magnetRadius) {
        const angle = Math.atan2(this.player.y - gem.y, this.player.x - gem.x);
        const pullSpeed = 450;
        gem.x += Math.cos(angle) * pullSpeed * dt;
        gem.y += Math.sin(angle) * pullSpeed * dt;
      }

      // 획득 판정
      if (dist < this.player.radius + gem.radius) {
        this.player.gainExp(gem.exp);
        window.soundManager.playGem();
        this.gems.splice(i, 1);
      }
    }

    // 파티클 업데이트
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.alpha -= dt / pt.life;
      if (pt.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 플로팅 텍스트 업데이트
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= dt / ft.life;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    this.updateHUD();
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();

    // 화면 흔들림 오프셋
    let shakeX = 0;
    let shakeY = 0;
    if (this.screenShake > 0) {
      shakeX = (Math.random() - 0.5) * this.screenShake;
      shakeY = (Math.random() - 0.5) * this.screenShake;
    }

    this.ctx.translate(-this.camera.x + shakeX, -this.camera.y + shakeY);

    // 네온 그리드 배경 렌더링
    this.renderGrid();

    // 보석 렌더링
    this.gems.forEach(g => g.draw(this.ctx));

    // 검기 렌더링
    this.slashes.forEach(s => s.draw(this.ctx));

    // 투사체 렌더링
    this.projectiles.forEach(p => p.draw(this.ctx));

    // 적 렌더링
    this.enemies.forEach(e => e.draw(this.ctx));

    // 오비탈 렌더링
    this.orbitals.forEach(o => o.draw(this.ctx));

    // 플레이어 렌더링
    if (this.player) {
      this.player.draw(this.ctx);
    }

    // 파티클 렌더링
    this.particles.forEach(pt => {
      this.ctx.fillStyle = pt.color;
      this.ctx.globalAlpha = Math.max(0, pt.alpha);
      this.ctx.beginPath();
      this.ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // 플로팅 텍스트 렌더링
    this.floatingTexts.forEach(ft => {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, ft.alpha);
      this.ctx.fillStyle = ft.color;
      this.ctx.font = `bold ${ft.size}px Pretendard`;
      this.ctx.textAlign = 'center';
      this.ctx.shadowColor = ft.color;
      this.ctx.shadowBlur = 8;
      this.ctx.fillText(ft.text, ft.x, ft.y);
      this.ctx.restore();
    });

    this.ctx.restore();
  }

  renderGrid() {
    const gridSize = 80;
    const startX = Math.floor(this.camera.x / gridSize) * gridSize;
    const endX = startX + this.canvas.width + gridSize;
    const startY = Math.floor(this.camera.y / gridSize) * gridSize;
    const endY = startY + this.canvas.height + gridSize;

    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.08)';

    this.ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      this.ctx.moveTo(x, startY);
      this.ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(endX, y);
    }
    this.ctx.stroke();

    // 중심 원환 네온 장식
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 0, 85, 0.15)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 300, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }
}

// === 플레이어 클래스 ===
class Player {
  constructor(x, y, game) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.radius = 18;

    this.maxHp = 100;
    this.hp = 100;
    this.speed = 260;

    this.level = 1;
    this.exp = 0;
    this.expToNext = 20;

    this.magnetRadius = 130;

    // 참격 공격 능력치
    this.slashDamage = 35;
    this.slashCooldown = 0;
    this.slashCooldownMax = 0.45;

    // 우클릭 차징 공격 (대형 검기)
    this.isCharging = false;
    this.chargeTime = 0;
    this.chargeMaxTime = 0.8; // 0.8초 이상 모으면 풀차징
    this.chargeCooldown = 0;
    this.chargeCooldownMax = 3.5; // 우클릭 쿨다운 3.5초

    // 대시 능력치
    this.dashCooldown = 0;
    this.dashCooldownMax = 2.2;
    this.dashDuration = 0;
    this.dashSpeed = 750;
    this.dashDir = { x: 0, y: 0 };
    this.isInvulnerable = false;

    // 스킬 관련
    this.orbitalCount = 0;
    this.lightningLevel = 0;
    this.lightningTimer = 0;

    // 신규 스킬 상태
    this.laserLevel = 0;
    this.laserTimer = 0;

    this.missileLevel = 0;
    this.missileTimer = 0;

    this.novaLevel = 0;
    this.novaTimer = 0;

    this.dashBladeLevel = 0;

    // 회전 각도 (마우스 방향)
    this.angle = 0;
  }

  gainExp(amount) {
    this.exp += amount;
    if (this.exp >= this.expToNext) {
      this.exp -= this.expToNext;
      this.level++;
      this.expToNext = Math.round(this.expToNext * 1.45 + 15);
      this.game.triggerLevelUp();
    }
  }

  takeDamage(amount) {
    if (this.isInvulnerable || this.dashDuration > 0) return;
    this.hp -= amount;
    this.game.screenShake = 6;
    window.soundManager.playHit();

    if (this.hp <= 0) {
      this.hp = 0;
      this.game.gameOver();
    }
  }

  startCharging() {
    if (this.chargeCooldown > 0) return; // 쿨타임 중에는 차징 불가
    this.isCharging = true;
    this.chargeTime = 0;
  }

  releaseCharge(targetPos) {
    if (!this.isCharging) return;
    const ratio = Math.min(1, this.chargeTime / this.chargeMaxTime);
    this.isCharging = false;

    // 최소 0.2초 이상 모았을 때 차징 공격 발동
    if (this.chargeTime >= 0.2) {
      const isFull = ratio >= 0.95;
      // 풀 차징 시 전체 쿨타임(3.5초), 짧게 차징(부분 차징) 시 쿨타임 50%(1.75초)만 적용
      this.chargeCooldown = isFull ? this.chargeCooldownMax : (this.chargeCooldownMax * 0.5);
      const angle = Math.atan2(targetPos.y - this.y, targetPos.x - this.x);
      
      // 데미지 배율 (기본 1.8배 ~ 최대 4.5배)
      const dmgMult = 1.8 + ratio * 2.7;
      const damage = Math.round(this.slashDamage * dmgMult);
      
      // 반경 배율 (기본 45 ~ 풀차징 80)
      const radius = 45 + ratio * 35;
      const speed = 420 + ratio * 150;
      const life = 0.9 + ratio * 0.4;
      
      this.game.slashes.push(new MegaSlash(this.x, this.y, angle, damage, radius, speed, life, isFull));
      this.game.screenShake = isFull ? 14 : 7;
      window.soundManager.playMegaSlash();

      // 발사 시 반동 파티클
      for (let i = 0; i < (isFull ? 20 : 10); i++) {
        this.game.createHitParticles(this.x, this.y, isFull ? '#ff0077' : '#00f3ff', 2);
      }
    }
    this.chargeTime = 0;
  }

  triggerDash() {
    if (this.dashCooldown <= 0) {
      this.dashCooldown = this.dashCooldownMax;
      this.dashDuration = 0.18; // 대시 시간
      window.soundManager.playDash();

      // 이동 방향이 없으면 보고 있는 방향으로 대시
      if (this.dashDir.x === 0 && this.dashDir.y === 0) {
        this.dashDir.x = Math.cos(this.angle);
        this.dashDir.y = Math.sin(this.angle);
      }

      this.game.createHitParticles(this.x, this.y, '#00f3ff', 12);
    }
  }

  attackSlash(targetPos) {
    if (this.slashCooldown <= 0) {
      this.slashCooldown = this.slashCooldownMax;

      const angle = Math.atan2(targetPos.y - this.y, targetPos.x - this.x);
      this.game.slashes.push(new Slash(this.x, this.y, angle, this.slashDamage));
      window.soundManager.playSlash();
    }
  }

  update(dt, keys, mouse) {
    // 쿨다운 갱신
    if (this.slashCooldown > 0) this.slashCooldown -= dt;
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.chargeCooldown > 0) this.chargeCooldown -= dt;

    // 마우스 방향 계산
    const worldMouse = this.game.getMouseWorldPos();
    this.angle = Math.atan2(worldMouse.y - this.y, worldMouse.x - this.x);

    // 차징 중 시간 누적 및 파티클 이펙트
    if (this.isCharging && mouse.rightDown) {
      this.chargeTime += dt;
      const ratio = Math.min(1, this.chargeTime / this.chargeMaxTime);
      
      // 기 모으는 파티클 수렴 효과
      if (Math.random() < 0.6 + ratio * 0.4) {
        const gatherAngle = Math.random() * Math.PI * 2;
        const gatherDist = 40 + (1 - ratio) * 40;
        this.game.particles.push({
          x: this.x + Math.cos(gatherAngle) * gatherDist,
          y: this.y + Math.sin(gatherAngle) * gatherDist,
          vx: -Math.cos(gatherAngle) * (100 + ratio * 150),
          vy: -Math.sin(gatherAngle) * (100 + ratio * 150),
          size: 2 + ratio * 3,
          color: ratio >= 0.95 ? '#ff0077' : '#00f3ff',
          alpha: 0.8,
          life: 0.25
        });
      }
    } else if (this.isCharging && !mouse.rightDown) {
      this.releaseCharge(worldMouse);
    }

    // 자동 공격 (마우스 누르고 있거나 가장 가까운 적에게 자동 검기)
    if (mouse.down) {
      this.attackSlash(worldMouse);
    } else if (this.slashCooldown <= 0 && this.game.enemies.length > 0) {
      // 자동 타겟팅 (반경 350 이내 가장 가까운 적)
      let closestEnemy = null;
      let closestDist = 350;
      this.game.enemies.forEach(e => {
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (d < closestDist) {
          closestDist = d;
          closestEnemy = e;
        }
      });
      if (closestEnemy) {
        this.attackSlash({ x: closestEnemy.x, y: closestEnemy.y });
      }
    }

    // 번개 스킬 처리
    if (this.lightningLevel > 0) {
      this.lightningTimer += dt;
      const strikeInterval = Math.max(1.0, 3.0 - this.lightningLevel * 0.4);
      if (this.lightningTimer >= strikeInterval) {
        this.lightningTimer = 0;
        this.castLightning();
      }
    }

    // 대시 이동 중
    if (this.dashDuration > 0) {
      this.dashDuration -= dt;
      this.x += this.dashDir.x * this.dashSpeed * dt;
      this.y += this.dashDir.y * this.dashSpeed * dt;

      // 대시 잔상 파티클
      if (Math.random() < 0.6) {
        this.game.particles.push({
          x: this.x, y: this.y,
          vx: 0, vy: 0,
          size: this.radius,
          color: 'rgba(0, 243, 255, 0.4)',
          alpha: 0.6,
          life: 0.2
        });
      }
      return;
    }

    // 일반 방향키 이동
    let dx = 0;
    let dy = 0;

    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;

    if (dx !== 0 && dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    }

    this.dashDir.x = dx;
    this.dashDir.y = dy;

    this.x += dx * this.speed * dt;
    this.y += dy * this.speed * dt;
  }

  castLightning() {
    if (this.game.enemies.length === 0) return;
    // 사거리 내 무작위 적 타겟
    const range = 450;
    const candidates = this.game.enemies.filter(e => Math.hypot(e.x - this.x, e.y - this.y) < range);
    if (candidates.length === 0) return;

    const target = candidates[Math.floor(Math.random() * candidates.length)];
    const damage = 60 + this.lightningLevel * 25;
    target.takeDamage(damage, 0, 0);

    window.soundManager.playLightning();
    this.game.addFloatingText(target.x, target.y - 20, `⚡ ${damage}`, '#ffea00', 20);

    // 번개 이펙트 파티클
    for (let i = 0; i < 10; i++) {
      this.game.createHitParticles(target.x, target.y, '#ffee55', 4);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // 사이버 글로우 효과
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 15;

    // 몸체 (네온 사이버 전사)
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 3;

    // 캐릭터 삼각형 본체
    ctx.beginPath();
    ctx.moveTo(this.radius + 6, 0);
    ctx.lineTo(-this.radius, -this.radius + 4);
    ctx.lineTo(-this.radius + 6, 0);
    ctx.lineTo(-this.radius, this.radius - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 코어 에너지
    ctx.fillStyle = '#00f3ff';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    // 차징 중 표시 인디케이터
    if (this.isCharging) {
      const chargeRatio = Math.min(1, this.chargeTime / this.chargeMaxTime);
      const isFull = chargeRatio >= 0.95;
      ctx.save();
      ctx.strokeStyle = isFull ? '#ff0077' : '#00f3ff';
      ctx.lineWidth = 3;
      ctx.shadowColor = isFull ? '#ff0077' : '#00f3ff';
      ctx.shadowBlur = isFull ? 20 : 10;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargeRatio);
      ctx.stroke();
      ctx.restore();
    }

    // 광선검 블레이드
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(28, 10);
    ctx.stroke();

    ctx.restore();
  }
}

// === 대형 검기(MegaSlash) 클래스 ===
class MegaSlash {
  constructor(x, y, angle, damage, radius = 65, speed = 500, life = 1.1, isFull = false) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = speed;
    this.damage = damage;
    this.radius = radius;
    this.life = life;
    this.maxLife = life;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.isFull = isFull;
    this.hitCooldowns = new Map(); // 적 관통 지속 타격
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;

    // 타격 쿨다운 감소 (0.12초마다 다단히트 가능)
    for (const [enemy, cd] of this.hitCooldowns.entries()) {
      const nextCd = cd - dt;
      if (nextCd <= 0) {
        this.hitCooldowns.delete(enemy);
      } else {
        this.hitCooldowns.set(enemy, nextCd);
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const progress = this.life / this.maxLife;
    ctx.globalAlpha = Math.min(1, progress * 1.6);

    const mainColor = this.isFull ? '#ff0077' : '#00f3ff';
    const subColor = this.isFull ? '#ffe600' : '#ffffff';

    ctx.shadowColor = mainColor;
    ctx.shadowBlur = this.isFull ? 28 : 18;

    // 외곽 거대 호
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = this.isFull ? 7 : 5;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, -Math.PI * 0.5, Math.PI * 0.5, false);
    ctx.stroke();

    // 중간 강렬한 광선
    ctx.strokeStyle = subColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius - 5, -Math.PI * 0.42, Math.PI * 0.42, false);
    ctx.stroke();

    // 꼬리 파동 잔상
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-10, 0, this.radius * 0.75, -Math.PI * 0.35, Math.PI * 0.35, false);
    ctx.stroke();

    ctx.restore();
  }
}

// === 검기(Slash) 클래스 ===
class Slash {
  constructor(x, y, angle, damage) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 520;
    this.damage = damage;
    this.radius = 28;
    this.life = 0.55;
    this.maxLife = 0.55;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.hitEnemies = new Set();
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const progress = this.life / this.maxLife;
    ctx.globalAlpha = Math.min(1, progress * 1.5);

    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 4;

    // 초승달 모양의 검기
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, -Math.PI * 0.45, Math.PI * 0.45, false);
    ctx.stroke();

    // 검기 내부 하이라이트
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius - 3, -Math.PI * 0.35, Math.PI * 0.35, false);
    ctx.stroke();

    ctx.restore();
  }
}

// === 오비탈(회전 에너지 구체) ===
class Orbital {
  constructor(player, index, total) {
    this.player = player;
    this.index = index;
    this.total = total;
    this.orbitRadius = 75;
    this.angle = (index / total) * Math.PI * 2;
    this.speed = 4.2;
    this.radius = 10;
    this.damage = 45;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
  }

  update(dt) {
    this.angle += this.speed * dt;
    const newX = this.player.x + Math.cos(this.angle) * this.orbitRadius;
    const newY = this.player.y + Math.sin(this.angle) * this.orbitRadius;
    this.vx = (newX - this.x) / dt;
    this.vy = (newY - this.y) / dt;
    this.x = newX;
    this.y = newY;
  }

  draw(ctx) {
    ctx.save();
    ctx.shadowColor = '#ff00aa';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ff00aa';

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// === 적(Enemy) 클래스 ===
class Enemy {
  constructor(x, y, type, gameTime, bossMinute = 1) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.bossMinute = bossMinute;

    // 타입별 스탯 튜닝
    if (type === 'drone') {
      this.radius = 14;
      this.speed = 120 + Math.min(60, gameTime * 0.2);
      this.hp = 25 + gameTime * 0.5;
      this.maxHp = this.hp;
      this.contactDamage = 12;
      this.expValue = 10;
      this.color = '#00f3ff';
    } else if (type === 'dasher') {
      this.radius = 12;
      this.speed = 210 + Math.min(70, gameTime * 0.25);
      this.hp = 20 + gameTime * 0.4;
      this.maxHp = this.hp;
      this.contactDamage = 15;
      this.expValue = 15;
      this.color = '#ffb703';
    } else if (type === 'tanker') {
      this.radius = 24;
      this.speed = 70;
      this.hp = 110 + gameTime * 1.5;
      this.maxHp = this.hp;
      this.contactDamage = 25;
      this.expValue = 35;
      this.color = '#7928ca';
    } else if (type === 'shooter') {
      this.radius = 16;
      this.speed = 90;
      this.hp = 45 + gameTime * 0.8;
      this.maxHp = this.hp;
      this.contactDamage = 14;
      this.expValue = 25;
      this.color = '#00ff88';
      this.shootCooldown = 2.0;
    } else if (type === 'boss') {
      this.radius = 48;
      this.speed = 80;
      this.hp = 800 * bossMinute + gameTime * 10;
      this.maxHp = this.hp;
      this.contactDamage = 40;
      this.expValue = 300;
      this.color = '#ff0055';
      this.shootCooldown = 1.8;

      // 보스 전용 스킬 시스템
      this.skillTimer = 3.0; // 주기적으로 스킬 시전
      this.currentSkill = null; // 'warning', 'charging_dash' 등
      this.skillActionTimer = 0;
      this.dashTargetAngle = 0;
      this.dashSpeed = 0;
    }

    // 넉백 벡터
    this.knockbackX = 0;
    this.knockbackY = 0;
  }

  takeDamage(dmg, vx = 0, vy = 0) {
    this.hp -= dmg;

    // 넉백 부여
    const knockbackPower = (this.type === 'boss' || this.type === 'tanker') ? 0.08 : 0.45;
    this.knockbackX += vx * knockbackPower;
    this.knockbackY += vy * knockbackPower;
  }

  update(dt, player, game) {
    // 넉백 감쇠
    this.x += this.knockbackX * dt;
    this.y += this.knockbackY * dt;
    this.knockbackX *= 0.88;
    this.knockbackY *= 0.88;

    // 플레이어를 향한 방향 벡터
    const angle = Math.atan2(player.y - this.y, player.x - this.x);

    // 원거리 적(shooter) 기본 공격 로직
    if (this.type === 'shooter') {
      this.shootCooldown -= dt;
      if (this.shootCooldown <= 0) {
        this.shootCooldown = 2.4;
        const bulletSpeed = 220;
        game.projectiles.push(new Projectile(
          this.x, this.y,
          Math.cos(angle) * bulletSpeed,
          Math.sin(angle) * bulletSpeed,
          10,
          true,
          this.color
        ));
      }
    }

    // === 보스 스킬 인공지능 패턴 ===
    if (this.type === 'boss') {
      this.updateBossSkills(dt, player, game, angle);
      return; // 보스는 updateBossSkills 내부에서 이동 처리
    }

    // 이동 처리
    this.x += Math.cos(angle) * this.speed * dt;
    this.y += Math.sin(angle) * this.speed * dt;
  }

  updateBossSkills(dt, player, game, angleToPlayer) {
    // 진행 중인 스킬 액션이 있을 때
    if (this.currentSkill === 'dash_charge') {
      this.skillActionTimer -= dt;
      // 돌진 준비 중: 플레이어 방향 조준선 유지 및 붉은 기 모으기
      if (Math.random() < 0.4) {
        game.particles.push({
          x: this.x + (Math.random() - 0.5) * 60,
          y: this.y + (Math.random() - 0.5) * 60,
          vx: Math.cos(this.dashTargetAngle) * 60,
          vy: Math.sin(this.dashTargetAngle) * 60,
          size: 3,
          color: '#ff0055',
          alpha: 0.8,
          life: 0.2
        });
      }

      if (this.skillActionTimer <= 0) {
        // 초고속 돌진 개시!
        this.currentSkill = 'dashing';
        this.skillActionTimer = 0.55; // 0.55초간 돌진
        this.dashSpeed = 650;
        game.screenShake = 8;
        window.soundManager.playNova();
      }
      return;
    } else if (this.currentSkill === 'dashing') {
      this.skillActionTimer -= dt;
      this.x += Math.cos(this.dashTargetAngle) * this.dashSpeed * dt;
      this.y += Math.sin(this.dashTargetAngle) * this.dashSpeed * dt;

      // 돌진 잔상 이펙트
      game.particles.push({
        x: this.x, y: this.y,
        vx: 0, vy: 0,
        size: this.radius,
        color: 'rgba(255, 0, 85, 0.4)',
        alpha: 0.6,
        life: 0.2
      });

      if (this.skillActionTimer <= 0) {
        this.currentSkill = null;
        this.skillTimer = 3.5; // 다음 스킬 쿨타임
      }
      return;
    }

    // 평상시: 플레이어 추적 이동 및 기본 사격
    this.x += Math.cos(angleToPlayer) * this.speed * dt;
    this.y += Math.sin(angleToPlayer) * this.speed * dt;

    // 기본 사격 (2갈래)
    this.shootCooldown -= dt;
    if (this.shootCooldown <= 0) {
      this.shootCooldown = 2.0;
      const bulletSpeed = 240;
      [-0.2, 0.2].forEach(offset => {
        game.projectiles.push(new Projectile(
          this.x, this.y,
          Math.cos(angleToPlayer + offset) * bulletSpeed,
          Math.sin(angleToPlayer + offset) * bulletSpeed,
          16,
          true,
          '#ff0055'
        ));
      });
    }

    // 특수 스킬 쿨다운 감소
    this.skillTimer -= dt;
    if (this.skillTimer <= 0) {
      // 3가지 스킬 중 무작위 시전:
      // 1. 360도 전방위 탄막 폭풍 (Nova Ring)
      // 2. 고속 돌진 강습 (Dash Charge)
      // 3. 미니 드론 지원군 소환 (Summon Reinforcements)
      const skills = ['nova_ring', 'dash_attack', 'summon_minions'];
      const chosen = skills[Math.floor(Math.random() * skills.length)];

      if (chosen === 'nova_ring') {
        this.skillTimer = 4.2;
        game.addFloatingText(this.x, this.y - 65, '⚠️ [SKILL] 전방위 펄스 탄막!', '#ff0055', 22);
        game.screenShake = 10;
        window.soundManager.playNova();

        // 16방향 링 탄막 발사
        const bulletCount = 16;
        const bSpeed = 220;
        for (let i = 0; i < bulletCount; i++) {
          const bAngle = (i / bulletCount) * Math.PI * 2;
          game.projectiles.push(new Projectile(
            this.x, this.y,
            Math.cos(bAngle) * bSpeed,
            Math.sin(bAngle) * bSpeed,
            18,
            true,
            '#ff0055'
          ));
        }
      } else if (chosen === 'dash_attack') {
        this.currentSkill = 'dash_charge';
        this.skillActionTimer = 0.9; // 0.9초 예고 후 돌진
        this.dashTargetAngle = angleToPlayer;
        game.addFloatingText(this.x, this.y - 65, '⚡ [SKILL] 초고속 돌진 강습!', '#ffe600', 22);
      } else if (chosen === 'summon_minions') {
        this.skillTimer = 5.0;
        game.addFloatingText(this.x, this.y - 65, '👾 [SKILL] 호위 드론 소환!', '#00f3ff', 22);
        window.soundManager.playLevelUp();

        // 보스 주변에 호위 드론 3마리 스폰
        for (let i = 0; i < 3; i++) {
          const spawnAngle = (i / 3) * Math.PI * 2;
          const sx = this.x + Math.cos(spawnAngle) * 90;
          const sy = this.y + Math.sin(spawnAngle) * 90;
          game.enemies.push(new Enemy(sx, sy, 'drone', game.gameTime));
          game.createHitParticles(sx, sy, '#00f3ff', 8);
        }
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#111';
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2.5;

    if (this.type === 'drone') {
      // 마름모 모양 드론
      ctx.beginPath();
      ctx.moveTo(0, -this.radius);
      ctx.lineTo(this.radius, 0);
      ctx.lineTo(0, this.radius);
      ctx.lineTo(-this.radius, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (this.type === 'dasher') {
      // 화살촉 모양
      ctx.beginPath();
      ctx.moveTo(this.radius, 0);
      ctx.lineTo(-this.radius, -this.radius * 0.7);
      ctx.lineTo(-this.radius * 0.4, 0);
      ctx.lineTo(-this.radius, this.radius * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (this.type === 'tanker' || this.type === 'boss') {
      // 8각 거대 코어
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 보스 전용 돌진 준비 조준선 렌더링
      if (this.type === 'boss' && this.currentSkill === 'dash_charge') {
        ctx.save();
        ctx.strokeStyle = '#ff0055';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(this.dashTargetAngle) * 350, Math.sin(this.dashTargetAngle) * 350);
        ctx.stroke();
        ctx.restore();
      }

      // 보스 내부 코어 박동 효과
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 슈터: 오각형
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 적 체력바 렌더링 (손상되었을 때만)
    if (this.hp < this.maxHp) {
      const barW = this.radius * 2;
      const barH = 4;
      const hpPct = Math.max(0, this.hp / this.maxHp);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(-barW / 2, -this.radius - 10, barW, barH);

      ctx.fillStyle = '#ff0055';
      ctx.fillRect(-barW / 2, -this.radius - 10, barW * hpPct, barH);
    }

    ctx.restore();
  }
}

// === 투사체 (적 총알 등) ===
class Projectile {
  constructor(x, y, vx, vy, damage, isEnemy = true, color = '#ff0055') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.isEnemy = isEnemy;
    this.color = color;
    this.radius = 6;
    this.life = 4.0;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = this.color;

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// === 경험치 보석(Gem) ===
class Gem {
  constructor(x, y, exp) {
    this.x = x;
    this.y = y;
    this.exp = exp;
    this.radius = 6;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.shadowColor = '#00ffaa';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#00ffaa';

    // 다이아몬드 형태
    ctx.beginPath();
    ctx.moveTo(0, -this.radius);
    ctx.lineTo(this.radius * 0.7, 0);
    ctx.lineTo(0, this.radius);
    ctx.lineTo(-this.radius * 0.7, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

// 인스턴스 초기화
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
