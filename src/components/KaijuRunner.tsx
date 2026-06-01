import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

type Rect = { x: number; y: number; w: number; h: number };
type Coin = { x: number; y: number; r: number };
type Laser = { x: number; y: number };
type Dust = { x: number; y: number; life: number; vx: number; vy: number };
type Spark = { x: number; y: number; life: number; maxLife: number; vx: number; vy: number; color: string };

type Skin = {
  id: string;
  name: string;
  body: string;
  belly: string;
  dark: string;
  spike: string;
  eye: string;
};

const SKINS: Skin[] = [
  {
    id: "emerald",
    name: "Esmeralda",
    body: "hsl(140 70% 38%)",
    belly: "hsl(45 80% 70%)",
    dark: "hsl(140 60% 22%)",
    spike: "hsl(140 60% 22%)",
    eye: "hsl(15 100% 55%)",
  },
  {
    id: "crimson",
    name: "Carmesim",
    body: "hsl(0 70% 42%)",
    belly: "hsl(35 80% 65%)",
    dark: "hsl(0 65% 25%)",
    spike: "hsl(20 90% 55%)",
    eye: "hsl(50 100% 60%)",
  },
  {
    id: "void",
    name: "Sombra",
    body: "hsl(260 40% 30%)",
    belly: "hsl(280 60% 55%)",
    dark: "hsl(260 50% 15%)",
    spike: "hsl(290 100% 65%)",
    eye: "hsl(180 100% 60%)",
  },
];

import { ThemeToggle } from "@/components/theme-toggle";

export default function KaijuRunner() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shootRef = useRef<() => void>(() => {});
  const shieldRef = useRef<() => void>(() => {});
  const restartRef = useRef<() => void>(() => {});
  const skinRef = useRef<Skin>(SKINS[0]);
  const { resolvedTheme, setTheme } = useTheme();
  const isDarkRef = useRef<boolean>(true);
  // 0 = dia, 1 = noite (interpolado suavemente para transição)
  const themeMixRef = useRef<number>(1);
  const themeTargetRef = useRef<number>(1);
  useEffect(() => {
    isDarkRef.current = resolvedTheme !== "light";
    themeTargetRef.current = resolvedTheme === "light" ? 0 : 1;
  }, [resolvedTheme]);

  // auto night mode by score
  const [autoNight, setAutoNight] = useState<boolean>(() => {
    return localStorage.getItem("kaiju-auto-night") === "1";
  });
  const autoNightRef = useRef(autoNight);
  useEffect(() => {
    autoNightRef.current = autoNight;
    localStorage.setItem("kaiju-auto-night", autoNight ? "1" : "0");
  }, [autoNight]);
  const [nightThreshold, setNightThreshold] = useState<number>(() => {
    const v = localStorage.getItem("kaiju-night-threshold");
    const n = v ? parseInt(v, 10) : 300;
    return Number.isFinite(n) && n >= 0 ? n : 300;
  });
  const nightThresholdRef = useRef(nightThreshold);
  useEffect(() => {
    nightThresholdRef.current = nightThreshold;
    localStorage.setItem("kaiju-night-threshold", String(nightThreshold));
  }, [nightThreshold]);

  const [score, setScore] = useState(0);
  const [best, setBest] = useState<number>(() => {
    const v = localStorage.getItem("kaiju-best");
    return v ? parseInt(v, 10) : 0;
  });
  const [gameOver, setGameOver] = useState(false);
  const [shieldActive, setShieldActive] = useState(false);
  const [hp, setHp] = useState(3);
  const [invulnPct, setInvulnPct] = useState(0);
  const [invulnSec, setInvulnSec] = useState(0);
  const [showSkinMenu, setShowSkinMenu] = useState(false);
  const [skinId, setSkinId] = useState<string>(() => {
    return localStorage.getItem("kaiju-skin") || "emerald";
  });
  const [pendingSkinId, setPendingSkinId] = useState<string>(skinId);

  // keep skinRef in sync
  useEffect(() => {
    const s = SKINS.find((s) => s.id === skinId) || SKINS[0];
    skinRef.current = s;
    localStorage.setItem("kaiju-skin", s.id);
  }, [skinId]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      const w = Math.max(320, canvas.clientWidth | 0);
      const h = Math.max(240, canvas.clientHeight | 0);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
    };
    resize();
    window.addEventListener("resize", resize);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const groundY = () => canvas.height - 60;

    let player = {
      x: 80,
      y: groundY() - 40,
      w: 40,
      h: 40,
      dy: 0,
      gravity: 0.7,
      jumpForce: -15,
      shield: false,
      hp: 3,
      invuln: 0, // frames de invulnerabilidade
      shootAnim: 0, // frames restantes de animação de tiro
      landSquash: 0, // frames de squash ao pousar
      idleTime: 0, // tempo parado para idle
      shake: 0, // intensidade do tremor de tela
    };

    // --- Sound System (Web Audio API) ---
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playSound = (type: OscillatorType, freq: number, duration: number, vol = 0.1, sweep = 0) => {
      try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        if (sweep) osc.frequency.exponentialRampToValueAtTime(sweep, audioCtx.currentTime + duration);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
      } catch (e) { console.error(e); }
    };

    // Sons mudam levemente no modo noturno (pitch mais grave + ambiência)
    const nightFactor = () => {
      const m = themeMixRef.current;
      return { mix: m, pitch: 1 - m * 0.35, vol: 1 + m * 0.1 };
    };
    const sounds = {
      jump: () => {
        const n = nightFactor();
        playSound(n.mix > 0.5 ? "sine" : "square", 150 * n.pitch, 0.2, 0.05 * n.vol, 400 * n.pitch);
      },
      land: () => {
        const n = nightFactor();
        playSound("triangle", 100 * n.pitch, 0.1 + n.mix * 0.08, 0.08 * n.vol, 50 * n.pitch);
        if (n.mix > 0.5) playSound("sine", 60, 0.3, 0.04, 30); // eco grave noturno
      },
      coin: () => {
        const n = nightFactor();
        playSound("sine", 800 * n.pitch, 0.15, 0.05, 1200 * n.pitch);
        if (n.mix > 0.5) setTimeout(() => playSound("sine", 1600, 0.18, 0.025, 2200), 50);
      },
      laser: () => {
        const n = nightFactor();
        playSound(n.mix > 0.5 ? "triangle" : "sawtooth", 400 * n.pitch, 0.2, 0.03 * n.vol, 100 * n.pitch);
      },
      damage: () => playSound("sawtooth", 100, 0.4, 0.1, 40),
      shieldOn: () => {
        const n = nightFactor();
        playSound("sine", 300 * n.pitch, 0.25, 0.06, 900 * n.pitch);
        setTimeout(() => playSound("triangle", 600 * n.pitch, 0.2, 0.04, 1100 * n.pitch), 60);
      },
      shieldBlock: () => playSound("square", 700, 0.15, 0.07, 200),
      nightOn: () => {
        playSound("sine", 200, 1.2, 0.05, 80);
        setTimeout(() => playSound("triangle", 400, 0.8, 0.035, 150), 100);
      },
      dayOn: () => {
        playSound("sine", 500, 0.8, 0.04, 1000);
        setTimeout(() => playSound("triangle", 700, 0.6, 0.03, 1200), 80);
      },
    };

    // Estrelas com seeds aleatórios (regenerados ao alternar dia/noite)
    type StarSeed = { x: number; y: number; phase: number };
    const makeStarSeeds = () => {
      const layers = [28, 18, 10];
      return layers.map((count) =>
        Array.from({ length: count + Math.floor(Math.random() * 8) }, () => ({
          x: Math.random(),
          y: Math.random(),
          phase: Math.random() * Math.PI * 2,
        })) as StarSeed[],
      );
    };
    let starSeeds: StarSeed[][] = makeStarSeeds();
    let prevThemeTarget = themeTargetRef.current;

    // Fog/poeira ambiente (mais visível à noite)
    type Fog = { x: number; y: number; r: number; vx: number; vy: number; alpha: number };
    let fog: Fog[] = [];

    let prevOnGround = true;
    let obstacles: Rect[] = [];
    let enemies: Rect[] = [];
    let coins: Coin[] = [];
    let lasers: Laser[] = [];
    let dust: Dust[] = [];
    let sparks: Spark[] = [];
    let shieldPulse = 0; // animação ao ativar
    let shieldFlash = 0; // flash ao bloquear
    let localScore = 0;
    let over = false;
    let speed = 6;
    let frame = 0;
    let nextObstacle = 100;
    let nextEnemy = 250;
    let nextCoin = 80;

    const spawnDust = (x: number, y: number, count = 6) => {
      for (let i = 0; i < count; i++) {
        dust.push({
          x,
          y,
          life: 20,
          vx: (Math.random() - 0.5) * 3,
          vy: -Math.random() * 2,
        });
      }
    };

    const spawnSparks = (x: number, y: number, count = 14, color = "hsl(190 100% 70%)") => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const sp = 2 + Math.random() * 4;
        sparks.push({
          x,
          y,
          life: 24,
          maxLife: 24,
          vx: Math.cos(angle) * sp,
          vy: Math.sin(angle) * sp,
          color,
        });
      }
    };

    const damagePlayer = () => {
      if (player.invuln > 0 || player.shield) return false;
      player.hp -= 1;
      player.invuln = 80;
      player.shake = 15;
      sounds.damage();
      setHp(player.hp);
      if (player.hp <= 0) {
        over = true;
        setGameOver(true);
        setBest((b) => {
          const nb = Math.max(b, localScore);
          localStorage.setItem("kaiju-best", String(nb));
          return nb;
        });
      }
      return true;
    };

    const jump = () => {
      if (over) return;
      if (player.y >= groundY() - player.h - 0.5) {
        player.dy = player.jumpForce;
        sounds.jump();
        spawnDust(player.x + player.w / 2, groundY(), 5);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
      if (e.code === "KeyX") shootRef.current();
      if (e.code === "KeyC") shieldRef.current();
    };

    const onPointer = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("button")) return;
      jump();
    };

    canvas.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);

    shootRef.current = () => {
      if (over) return;
      lasers.push({ x: player.x + player.w + 6, y: player.y + player.h / 2 });
      player.shootAnim = 14;
      sounds.laser();
    };

    shieldRef.current = () => {
      if (over) return;
      if (player.shield) return;
      player.shield = true;
      shieldPulse = 30;
      sounds.shieldOn();
      spawnSparks(
        player.x + player.w / 2,
        player.y + player.h / 2,
        18,
        "hsl(190 100% 70%)",
      );
      setShieldActive(true);
      setTimeout(() => {
        player.shield = false;
        setShieldActive(false);
      }, 3000);
    };

    const onShieldBlock = () => {
      shieldFlash = 14;
      sounds.shieldBlock();
      spawnSparks(
        player.x + player.w + 4,
        player.y + player.h / 2,
        12,
        "hsl(50 100% 70%)",
      );
    };

    restartRef.current = () => {
      obstacles = [];
      enemies = [];
      coins = [];
      lasers = [];
      dust = [];
      sparks = [];
      shieldPulse = 0;
      shieldFlash = 0;
      localScore = 0;
      speed = 6;
      frame = 0;
      nextObstacle = 100;
      nextEnemy = 250;
      nextCoin = 80;
      over = false;
      player.y = groundY() - player.h;
      player.dy = 0;
      player.shield = false;
      player.hp = 3;
      player.invuln = 0;
      player.shootAnim = 0;
      player.landSquash = 0;
      player.shake = 0;
      setHp(3);
      setShieldActive(false);
      setInvulnPct(0);
      setInvulnSec(0);
      setScore(0);
      setGameOver(false);
    };

    // Removed setInterval spawning to use frame-based logic in loop

    const collide = (a: Rect, b: Rect) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    let raf = 0;
    const loop = () => {
      frame++;
      if (!over) {
        // physics
        player.dy += player.gravity;
        player.y += player.dy;
        const gY = groundY();
        const wasInAir = !prevOnGround;
        if (player.y > gY - player.h) {
          player.y = gY - player.h;
          player.dy = 0;
          if (wasInAir) {
            // pousou
            player.landSquash = 10;
            sounds.land();
            spawnDust(player.x + player.w / 2, gY, 8);
          }
        }
        const onGround = player.y >= gY - player.h - 0.5;
        prevOnGround = onGround;

        if (player.invuln > 0) {
          player.invuln--;
          if (frame % 4 === 0) {
            setInvulnPct(player.invuln / 80);
            setInvulnSec(Math.ceil(player.invuln / 60));
          }
          if (player.invuln === 0) {
            setInvulnPct(0);
            setInvulnSec(0);
          }
        }
        if (player.shootAnim > 0) player.shootAnim--;
        if (player.landSquash > 0) player.landSquash--;
        if (shieldPulse > 0) shieldPulse--;
        if (shieldFlash > 0) shieldFlash--;
        if (onGround && Math.abs(player.dy) < 0.1) player.idleTime++;
        else player.idleTime = 0;

        // Difficulty scaling — mais agressiva ao longo do tempo
        if (frame % 360 === 0) speed += 0.5;
        const diff = 1 + frame / 3600; // multiplicador progressivo

        // frame-based spawning
        nextObstacle--;
        if (nextObstacle <= 0) {
          obstacles.push({ x: canvas.width, y: groundY() - 30, w: 26, h: 30 });
          nextObstacle = Math.max(28, (100 - speed * 5) / diff + Math.random() * 40);
        }

        nextEnemy--;
        if (nextEnemy <= 0) {
          const y = Math.random() * (groundY() - 160) + 60;
          enemies.push({ x: canvas.width, y, w: 36, h: 36 });
          nextEnemy = Math.max(45, (180 - speed * 7) / diff + Math.random() * 60);
        }

        nextCoin--;
        if (nextCoin <= 0) {
          const y = Math.random() * (groundY() - 120) + 40;
          coins.push({ x: canvas.width, y, r: 9 });
          nextCoin = Math.max(20, (80 - speed * 3) / diff + Math.random() * 30);
        }

        // obstacles
        for (let i = obstacles.length - 1; i >= 0; i--) {
          const o = obstacles[i];
          o.x -= speed;
          if (collide(player, o)) {
            if (player.shield) {
              obstacles.splice(i, 1);
              onShieldBlock();
            } else if (player.invuln <= 0) {
              if (damagePlayer()) obstacles.splice(i, 1);
            }
            continue;
          }
          if (o.x + o.w < 0) obstacles.splice(i, 1);
        }

        // enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          e.x -= speed + 1;
          let killed = false;
          for (let j = lasers.length - 1; j >= 0; j--) {
            const l = lasers[j];
            if (l.x >= e.x && l.x <= e.x + e.w && l.y >= e.y && l.y <= e.y + e.h) {
              enemies.splice(i, 1);
              lasers.splice(j, 1);
              localScore += 100;
              killed = true;
              break;
            }
          }
          if (killed) continue;
          if (collide(player, e)) {
            if (player.shield) {
              enemies.splice(i, 1);
              onShieldBlock();
            } else if (player.invuln <= 0) {
              if (damagePlayer()) enemies.splice(i, 1);
            }
            continue;
          }
          if (e.x + e.w < 0) enemies.splice(i, 1);
        }

        // coins
        for (let i = coins.length - 1; i >= 0; i--) {
          const c = coins[i];
          c.x -= speed;
          const cx = player.x + player.w / 2;
          const cy = player.y + player.h / 2;
          const dx = cx - c.x;
          const dy = cy - c.y;
          if (Math.hypot(dx, dy) < player.w / 2 + c.r) {
            coins.splice(i, 1);
            localScore += 20;
            sounds.coin();
            continue;
          }
          if (c.x + c.r < 0) coins.splice(i, 1);
        }

        // lasers
        for (let i = lasers.length - 1; i >= 0; i--) {
          lasers[i].x += 12;
          if (lasers[i].x > canvas.width) lasers.splice(i, 1);
        }

        // dust particles
        for (let i = dust.length - 1; i >= 0; i--) {
          const d = dust[i];
          d.x += d.vx;
          d.y += d.vy;
          d.vy += 0.15;
          d.life--;
          if (d.life <= 0) dust.splice(i, 1);
        }

        // sparks particles
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i];
          s.x += s.vx;
          s.y += s.vy;
          s.vx *= 0.94;
          s.vy *= 0.94;
          s.life--;
          if (s.life <= 0) sparks.splice(i, 1);
        }

        if (frame % 6 === 0) {
          localScore += 1;
          setScore(localScore);
        }

        if (player.shake > 0) player.shake *= 0.9;
      }

      // draw
      // draw with screen shake
      ctx.save();
      if (player.shake > 1) {
        ctx.translate((Math.random() - 0.5) * player.shake, (Math.random() - 0.5) * player.shake);
      }

      // ===== auto night mode by score =====
      if (autoNightRef.current && !over) {
        const wantNight = localScore >= nightThresholdRef.current;
        const nextTarget = wantNight ? 1 : 0;
        if (themeTargetRef.current !== nextTarget) {
          themeTargetRef.current = nextTarget;
          // sync app theme (smooth — dark class flips, but our canvas mix lerps)
          setTheme(wantNight ? "dark" : "light");
        }
      }

      // detecta mudança de alvo de tema → som de transição + regenera estrelas
      if (themeTargetRef.current !== prevThemeTarget) {
        if (themeTargetRef.current === 1) sounds.nightOn();
        else sounds.dayOn();
        // regenera seeds das estrelas (variação aleatória sem quebrar parallax — usado em todos os frames)
        starSeeds = makeStarSeeds();
        prevThemeTarget = themeTargetRef.current;
      }

      // smooth theme interpolation (mix: 0 = dia, 1 = noite)
      const target = themeTargetRef.current;
      themeMixRef.current += (target - themeMixRef.current) * 0.04;
      const mix = themeMixRef.current;
      const isDark = mix > 0.5;

      // helpers de cor (mistura entre dia e noite)
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      const mixHsl = (
        dayH: number, dayS: number, dayL: number,
        nightH: number, nightS: number, nightL: number,
        a = 1,
      ) =>
        `hsla(${lerp(dayH, nightH, mix).toFixed(1)}, ${lerp(dayS, nightS, mix).toFixed(1)}%, ${lerp(dayL, nightL, mix).toFixed(1)}%, ${a})`;

      // sky gradient (interpolado)
      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bg.addColorStop(0, mixHsl(205, 90, 75, 222, 47, 8));
      bg.addColorStop(1, mixHsl(190, 80, 88, 280, 40, 14));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // ===== céu: nuvens (dia) com fade-out + estrelas (noite) com parallax/twinkle =====
      const dayAlpha = 1 - mix;
      const nightAlpha = mix;

      // nuvens — visíveis no dia
      if (dayAlpha > 0.02) {
        ctx.globalAlpha = 0.85 * dayAlpha;
        ctx.fillStyle = "hsl(0, 0%, 100%)";
        for (let i = 0; i < 6; i++) {
          const cx = (canvas.width - ((i * 220 + frame * 0.3) % (canvas.width + 200)));
          const cy = 40 + (i * 37) % 120;
          ctx.beginPath();
          ctx.arc(cx, cy, 18, 0, Math.PI * 2);
          ctx.arc(cx + 20, cy + 4, 22, 0, Math.PI * 2);
          ctx.arc(cx + 44, cy, 16, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // estrelas — 3 camadas de parallax + twinkle + float (seeds aleatórios)
      if (nightAlpha > 0.02) {
        const layerCfg = [
          { speed: 0.15, size: 1, alpha: 0.5 },
          { speed: 0.35, size: 2, alpha: 0.75 },
          { speed: 0.6, size: 2, alpha: 1.0 },
        ];
        for (let li = 0; li < starSeeds.length; li++) {
          const L = layerCfg[li];
          const stars = starSeeds[li];
          for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            const baseX = s.x * canvas.width;
            const sx = (baseX + frame * L.speed) % canvas.width;
            const baseY = s.y * (canvas.height - 100);
            const sy = baseY + Math.sin(frame * 0.02 + s.phase) * (1 + li);
            const tw = 0.6 + 0.4 * Math.sin(frame * 0.06 + s.phase * 2);
            ctx.globalAlpha = L.alpha * tw * nightAlpha;
            ctx.fillStyle = "hsl(0, 0%, 100%)";
            ctx.fillRect(canvas.width - sx, sy, L.size, L.size);
          }
        }
        ctx.globalAlpha = 1;

        // Lua
        const moonX = canvas.width - 80;
        const moonY = 70;
        const moonR = 22;
        ctx.globalAlpha = nightAlpha;
        const moonGlow = ctx.createRadialGradient(moonX, moonY, moonR * 0.5, moonX, moonY, moonR * 3);
        moonGlow.addColorStop(0, "hsla(50, 90%, 90%, 0.55)");
        moonGlow.addColorStop(1, "hsla(50, 90%, 90%, 0)");
        ctx.fillStyle = moonGlow;
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonR * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "hsl(50, 95%, 92%)";
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // ground (interpolado)
      ctx.fillStyle = mixHsl(95, 35, 45, 222, 30, 18);
      ctx.fillRect(0, groundY(), canvas.width, canvas.height - groundY());

      // reflexo da lua no chão (intensidade baseada em mix)
      if (nightAlpha > 0.05) {
        const refX = canvas.width - 80;
        const refY = groundY();
        const refW = 220;
        const refH = canvas.height - groundY();
        const refGrad = ctx.createLinearGradient(refX, refY, refX, refY + refH);
        const a = nightAlpha * 0.45;
        refGrad.addColorStop(0, `hsla(50, 95%, 88%, ${a})`);
        refGrad.addColorStop(0.5, `hsla(200, 80%, 70%, ${a * 0.5})`);
        refGrad.addColorStop(1, "hsla(200, 80%, 70%, 0)");
        ctx.fillStyle = refGrad;
        ctx.beginPath();
        ctx.ellipse(refX, refY, refW, refH * 1.1, 0, 0, Math.PI * 2);
        ctx.fill();

        // brilho fino na linha do horizonte
        ctx.strokeStyle = `hsla(50, 100%, 92%, ${nightAlpha * 0.6})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(refX - refW * 0.6, refY + 1);
        ctx.lineTo(refX + refW * 0.6, refY + 1);
        ctx.stroke();
      }

      ctx.strokeStyle = mixHsl(95, 60, 30, 160, 80, 50);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, groundY());
      ctx.lineTo(canvas.width, groundY());
      ctx.stroke();

      // ===== fog/poeira ambiente — bem mais visível à noite, sutil de dia =====
      const fogTargetCount = Math.floor(8 + nightAlpha * 22);
      if (frame % 8 === 0 && fog.length < fogTargetCount) {
        fog.push({
          x: canvas.width + 20,
          y: groundY() - 10 - Math.random() * 80,
          r: 18 + Math.random() * 30,
          vx: -(0.5 + Math.random() * 0.8),
          vy: -0.05 - Math.random() * 0.1,
          alpha: 0.3 + Math.random() * 0.4,
        });
      }
      for (let i = fog.length - 1; i >= 0; i--) {
        const f = fog[i];
        f.x += f.vx;
        f.y += f.vy;
        f.alpha -= 0.002;
        if (f.x + f.r < 0 || f.alpha <= 0) {
          fog.splice(i, 1);
          continue;
        }
        // tonalidade muda dia/noite; alpha ponderado pelo mix
        const dayA = f.alpha * 0.18;
        const nightA = f.alpha * 0.55;
        const a = lerp(dayA, nightA, mix);
        ctx.fillStyle = mix > 0.5
          ? `hsla(220, 40%, 70%, ${a})`
          : `hsla(40, 30%, 85%, ${a})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // dust
      dust.forEach((d) => {
        ctx.fillStyle = `hsla(40, 30%, 70%, ${d.life / 25})`;
        ctx.fillRect(d.x, d.y, 3, 3);
      });

      // ===== player =====
      const skin = skinRef.current;
      const onGround = player.y >= groundY() - player.h - 0.5;
      const inAir = !onGround;
      const goingUp = inAir && player.dy < 0;
      const goingDown = inAir && player.dy > 0;
      const isIdle = onGround && player.idleTime > 30;
      const isShooting = player.shootAnim > 0;

      // tremor quando invulnerável (recém atingido)
      let shakeX = 0;
      let shakeY = 0;
      if (player.invuln > 0 && player.invuln > 50) {
        shakeX = (Math.random() - 0.5) * 6;
        shakeY = (Math.random() - 0.5) * 4;
      }

      // squash/stretch
      let scaleY = 1;
      let scaleX = 1;
      if (goingUp) {
        scaleY = 1.15;
        scaleX = 0.9;
      } else if (goingDown) {
        scaleY = 1.1;
        scaleX = 0.95;
      }
      if (player.landSquash > 0) {
        const t = player.landSquash / 10;
        scaleY = 1 - t * 0.35;
        scaleX = 1 + t * 0.25;
      }
      // idle breathing
      if (isIdle) {
        scaleY = 1 + Math.sin(frame * 0.08) * 0.03;
        scaleX = 1 - Math.sin(frame * 0.08) * 0.02;
      }

      const flashRed =
        player.invuln > 0 && Math.floor(player.invuln / 5) % 2 === 0;
      // piscar (alpha) durante invuln depois do flash inicial
      const blink =
        player.invuln > 0 && player.invuln <= 50
          ? Math.floor(player.invuln / 4) % 2 === 0
          : false;

      ctx.save();
      ctx.globalAlpha = blink ? 0.4 : 1;

      const baseW = player.w;
      const baseH = player.h;
      const drawW = baseW * scaleX;
      const drawH = baseH * scaleY;
      const px = player.x + (baseW - drawW) / 2 + shakeX;
      const py = player.y + (baseH - drawH) + shakeY;
      const pw = drawW;
      const ph = drawH;

      const bodyColor = player.shield
        ? "hsl(190 85% 55%)"
        : flashRed
          ? "hsl(0 95% 60%)"
          : skin.body;
      const bellyColor = player.shield ? "hsl(190 90% 75%)" : skin.belly;
      const darkColor = player.shield ? "hsl(200 70% 30%)" : skin.dark;
      const spikeColor = player.shield ? "hsl(200 70% 30%)" : skin.spike;

      // tail (idle: balanço maior; correndo: ciclo)
      const runCycle = onGround ? Math.sin(frame * 0.4) : 0;
      const idleTail = isIdle ? Math.sin(frame * 0.05) * 5 : 0;
      const tailWag = runCycle * 2 + idleTail;
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.moveTo(px - 2, py + ph - 8);
      ctx.lineTo(px - 18, py + ph - 14 + tailWag);
      ctx.lineTo(px - 22, py + ph - 6 + tailWag);
      ctx.lineTo(px - 2, py + ph - 2);
      ctx.closePath();
      ctx.fill();

      // body
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.roundRect(px, py + 8, pw, ph - 8, 8);
      ctx.fill();

      // belly
      ctx.fillStyle = bellyColor;
      ctx.beginPath();
      ctx.roundRect(px + 4, py + 22, pw - 14, ph - 26, 5);
      ctx.fill();
      ctx.strokeStyle = "hsla(0,0%,0%,0.15)";
      ctx.lineWidth = 1;
      for (let s = 0; s < 3; s++) {
        ctx.beginPath();
        ctx.moveTo(px + 6, py + 26 + s * 4);
        ctx.lineTo(px + pw - 12, py + 26 + s * 4);
        ctx.stroke();
      }

      // dorsal spikes
      ctx.fillStyle = spikeColor;
      for (let s = 0; s < 4; s++) {
        const sx = px + 4 + s * 9;
        ctx.beginPath();
        ctx.moveTo(sx, py + 10);
        ctx.lineTo(sx + 4, py + 1);
        ctx.lineTo(sx + 8, py + 10);
        ctx.closePath();
        ctx.fill();
      }

      // head — leve inclinação ao atirar
      const headTilt = isShooting ? -2 : 0;
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.roundRect(px + pw - 10, py + 4 + headTilt, 18, 18, 5);
      ctx.fill();

      // jaw — boca aberta ao atirar
      ctx.fillStyle = darkColor;
      const jawOpen = isShooting ? 6 : 0;
      ctx.fillRect(px + pw - 4, py + 16 + headTilt, 12, 4 + jawOpen);
      ctx.fillStyle = "hsl(0 0% 95%)";
      for (let t = 0; t < 3; t++) {
        ctx.fillRect(px + pw - 2 + t * 4, py + 16 + headTilt, 2, 2);
      }
      // glow da boca ao atirar
      if (isShooting) {
        const g = ctx.createRadialGradient(
          px + pw + 6,
          py + 20 + headTilt,
          0,
          px + pw + 6,
          py + 20 + headTilt,
          14,
        );
        g.addColorStop(0, "hsla(25,100%,70%,0.9)");
        g.addColorStop(1, "hsla(25,100%,50%,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px + pw + 6, py + 20 + headTilt, 14, 0, Math.PI * 2);
        ctx.fill();
      }

      // eye glow
      ctx.fillStyle = "hsl(0 0% 100%)";
      ctx.fillRect(px + pw + 1, py + 9 + headTilt, 4, 4);
      ctx.fillStyle = player.shield
        ? "hsl(190 100% 50%)"
        : isShooting
          ? "hsl(0 100% 60%)"
          : skin.eye;
      ctx.fillRect(px + pw + 2, py + 10 + headTilt, 2, 2);

      // legs
      ctx.fillStyle = darkColor;
      const legOffset = onGround && !isIdle ? runCycle * 4 : 0;
      // pernas se juntam no ar
      const legSpread = inAir ? 0 : 1;
      const leg1H = inAir ? 4 : 6 + legOffset;
      const leg2H = inAir ? 4 : 6 - legOffset;
      ctx.fillRect(px + 6 * legSpread + (inAir ? 10 : 0), py + ph - 4, 7, leg1H);
      ctx.fillRect(
        px + pw - 16 - (inAir ? 6 : 0),
        py + ph - 4,
        7,
        leg2H,
      );
      // claws
      ctx.fillStyle = "hsl(0 0% 95%)";
      if (onGround) {
        ctx.fillRect(px + 6, py + ph + 2 + legOffset, 2, 2);
        ctx.fillRect(px + 11, py + ph + 2 + legOffset, 2, 2);
        ctx.fillRect(px + pw - 16, py + ph + 2 - legOffset, 2, 2);
        ctx.fillRect(px + pw - 11, py + ph + 2 - legOffset, 2, 2);
      }

      // arm — postura de ataque ao atirar
      ctx.fillStyle = bodyColor;
      if (isShooting) {
        // braço estendido para frente
        const recoil = Math.max(0, player.shootAnim - 8) * 0.5;
        ctx.fillRect(px + pw - 14 - recoil, py + 16, 14, 5);
        // garra
        ctx.fillStyle = "hsl(0 0% 95%)";
        ctx.fillRect(px + pw - 2 - recoil, py + 15, 3, 7);
      } else {
        ctx.fillRect(px + pw - 14, py + 18, 6, 10);
      }

      // ===== iluminação noturna do kaiju =====
      // overlay azulado para escurecer/integrar com o céu noturno
      if (mix > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = "source-atop";
        ctx.globalAlpha = mix * 0.32;
        ctx.fillStyle = "hsl(230, 60%, 18%)";
        ctx.fillRect(px - 24, py - 4, pw + 48, ph + 14);
        ctx.restore();

        // rim light frio no topo (lua)
        ctx.save();
        ctx.globalCompositeOperation = "source-atop";
        ctx.globalAlpha = mix * 0.45;
        const rim = ctx.createLinearGradient(0, py, 0, py + ph * 0.4);
        rim.addColorStop(0, "hsla(200, 90%, 80%, 0.9)");
        rim.addColorStop(1, "hsla(200, 90%, 80%, 0)");
        ctx.fillStyle = rim;
        ctx.fillRect(px - 24, py - 4, pw + 48, ph * 0.5);
        ctx.restore();
      }

      ctx.restore();

      // invulnerability indicator (HUD on canvas) — adapta ao tema
      if (player.invuln > 0) {
        const barW = 100;
        const barH = 6;
        const bx = 20;
        const by = 20;
        ctx.fillStyle = mix > 0.5 ? "hsla(0,0%,100%,0.12)" : "hsla(0,0%,0%,0.35)";
        ctx.fillRect(bx, by, barW, barH);
        ctx.fillStyle = mix > 0.5 ? "hsl(340, 100%, 70%)" : "hsl(0, 100%, 55%)";
        ctx.fillRect(bx, by, (player.invuln / 80) * barW, barH);
        ctx.fillStyle = mix > 0.5 ? "hsl(0, 0%, 95%)" : "hsl(0, 0%, 15%)";
        ctx.font = "bold 10px monospace";
        ctx.fillText("INVULNERÁVEL", bx, by - 5);
      }

      // shield
      const shieldCx = player.x + player.w / 2;
      const shieldCy = player.y + player.h / 2;
      if (player.shield) {
        const baseR = player.w;
        const pulseR = baseR + Math.sin(frame * 0.2) * 3 + (shieldPulse > 0 ? shieldPulse * 0.8 : 0);
        const flashAlpha = shieldFlash > 0 ? shieldFlash / 14 : 0;

        // halo glow
        const grad = ctx.createRadialGradient(shieldCx, shieldCy, baseR * 0.4, shieldCx, shieldCy, pulseR + 6);
        grad.addColorStop(0, `hsla(190,100%,80%,${0.05 + flashAlpha * 0.3})`);
        grad.addColorStop(0.7, `hsla(190,100%,70%,${0.18 + flashAlpha * 0.4})`);
        grad.addColorStop(1, "hsla(190,100%,70%,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(shieldCx, shieldCy, pulseR + 6, 0, Math.PI * 2);
        ctx.fill();

        // ring
        ctx.strokeStyle = shieldFlash > 0
          ? `hsla(50,100%,80%,${0.6 + flashAlpha * 0.4})`
          : "hsla(190,90%,70%,0.85)";
        ctx.lineWidth = 3 + (shieldPulse > 0 ? shieldPulse * 0.15 : 0);
        ctx.beginPath();
        ctx.arc(shieldCx, shieldCy, pulseR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // sparks
      sparks.forEach((s) => {
        ctx.globalAlpha = s.life / s.maxLife;
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x, s.y, 3, 3);
      });
      ctx.globalAlpha = 1;

      // obstacles
      ctx.fillStyle = "hsl(0 80% 55%)";
      obstacles.forEach((o) => ctx.fillRect(o.x, o.y, o.w, o.h));

      // enemies
      ctx.fillStyle = "hsl(280 80% 60%)";
      enemies.forEach((e) => {
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.fillStyle = "hsl(0 0% 100%)";
        ctx.fillRect(e.x + 6, e.y + 10, 5, 5);
        ctx.fillRect(e.x + 24, e.y + 10, 5, 5);
        ctx.fillStyle = "hsl(280 80% 60%)";
      });

      // coins
      coins.forEach((c) => {
        ctx.fillStyle = "hsl(45 95% 55%)";
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "hsl(45 90% 35%)";
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // lasers
      ctx.fillStyle = "hsl(25 100% 60%)";
      lasers.forEach((l) => {
        ctx.fillRect(l.x, l.y - 2, 14, 4);
        ctx.fillStyle = "hsla(25,100%,80%,0.5)";
        ctx.fillRect(l.x - 6, l.y - 1, 6, 2);
        ctx.fillStyle = "hsl(25 100% 60%)";
      });

      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      // intervals.forEach((id) => clearInterval(id)); // removed intervals
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", onPointer);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-4">
      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-md">
        <img src="/logo.png" alt="Kaiju Dash Logo" className="w-16 h-16 rounded-lg object-cover border border-primary/20" />
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-primary italic uppercase">Kaiju Dash</h1>
          <p className="text-xs text-muted-foreground font-mono">Survival Protocol: Active</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm md:text-base flex-wrap gap-2">
        <div className="flex gap-4 font-mono items-center">
          <span className="text-primary">Pontos: {score}</span>
          <span className="text-muted-foreground">Recorde: {best}</span>
          <span className="flex gap-1" aria-label={`Vidas: ${hp}`}>
            {Array.from({ length: 3 }).map((_, i) => (
              <span
                key={i}
                className={
                  i < hp ? "text-destructive" : "text-muted-foreground/30"
                }
              >
                ❤
              </span>
            ))}
          </span>
        </div>
        <div className="text-xs text-muted-foreground hidden md:block">
          Espaço/Toque = Pular · X = Laser · C = Escudo
        </div>
      </div>

      {invulnPct > 0 && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-destructive/40 bg-destructive/10 animate-in fade-in"
          role="status"
          aria-live="polite"
        >
          <span className="text-xs font-mono font-bold text-destructive uppercase tracking-wider">
            🛡 Invulnerável
          </span>
          <div className="flex-1 h-2 bg-destructive/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-destructive transition-[width] duration-75"
              style={{ width: `${invulnPct * 100}%` }}
            />
          </div>
          <span className="text-xs font-mono text-destructive w-6 text-right">
            {invulnSec}s
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              setPendingSkinId(skinId);
              setShowSkinMenu(true);
            }}
            className="font-mono text-xs"
          >
            🦖 Escolher Skin
          </Button>
          <span className="text-xs text-muted-foreground font-mono">
            Atual: {SKINS.find(s => s.id === skinId)?.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoNight ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoNight((v) => !v)}
            className="font-mono text-xs"
            title={`Vira noite ao atingir ${nightThreshold} pts`}
          >
            {autoNight ? "🌙 Auto-Noite: ON" : "🌙 Auto-Noite: OFF"}
          </Button>
          <ThemeToggle />
        </div>
      </div>
      {autoNight && (
        <div className="-mt-2 flex flex-col gap-1">
          <p className="text-xs text-muted-foreground font-mono">
            {score < nightThreshold
              ? `☀️ Modo dia · vira noite em ${nightThreshold - score} pts`
              : `🌙 Modo noite ativo · volta ao dia se a pontuação cair abaixo de ${nightThreshold}`}
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="night-th" className="text-xs font-mono text-muted-foreground">
              Limiar:
            </label>
            <input
              id="night-th"
              type="number"
              min={0}
              step={50}
              value={nightThreshold}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (Number.isFinite(n) && n >= 0) setNightThreshold(n);
              }}
              className="w-24 h-7 px-2 rounded border border-border bg-background text-xs font-mono"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setNightThreshold(300)}
            >
              ↺ Padrão
            </Button>
          </div>
        </div>
      )}

      {showSkinMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <span className="text-2xl">🦎</span> Selecionar Skin do Kaiju
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Escolha sua skin e clique em <strong>Salvar</strong> para confirmar.
            </p>

            <div className="grid gap-3 mb-6">
              {SKINS.map((s) => {
                const active = s.id === pendingSkinId;
                return (
                  <button
                    key={s.id}
                    onClick={() => setPendingSkinId(s.id)}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-all text-left ${
                      active
                        ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                        : "border-border hover:border-primary/50 bg-background"
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex gap-1">
                        <div className="w-6 h-6 rounded-md" style={{ background: s.body }} />
                        <div className="w-2 h-6 rounded-md" style={{ background: s.spike }} />
                        <div className="w-2 h-6 rounded-md" style={{ background: s.eye }} />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.id === skinId ? "Skin equipada" : "Estilo único para seu monstro"}
                      </div>
                    </div>
                    {active && <span className="text-primary text-xl">✓</span>}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  setSkinId(pendingSkinId);
                  setShowSkinMenu(false);
                }}
                className="w-full font-bold"
                disabled={pendingSkinId === skinId}
              >
                💾 Salvar Skin
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setPendingSkinId("emerald")}
                  className="flex-1 text-xs"
                >
                  ↺ Restaurar Padrão
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPendingSkinId(skinId);
                    setShowSkinMenu(false);
                  }}
                  className="flex-1 text-xs"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative rounded-lg overflow-hidden border border-border shadow-2xl bg-background">
        <canvas
          ref={canvasRef}
          className="block w-full h-[60vh] touch-none select-none"
        />
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm">
            <h2 className="text-3xl md:text-5xl font-bold text-destructive">
              Game Over
            </h2>
            <p className="text-lg">Pontos: {score}</p>
            <Button size="lg" onClick={() => restartRef.current()}>
              Jogar de novo
            </Button>
          </div>
        )}
      </div>

      <div className="flex justify-center gap-3">
        <Button
          variant="default"
          size="lg"
          onClick={() => shootRef.current()}
          disabled={gameOver}
        >
          🔥 Laser
        </Button>
        <Button
          variant={shieldActive ? "secondary" : "outline"}
          size="lg"
          onClick={() => shieldRef.current()}
          disabled={gameOver || shieldActive}
        >
          🛡️ Escudo
        </Button>
      </div>
    </div>
  );
}
