"use client";

import { useRef, useEffect, useCallback, useState } from "react";

/* ── Types ── */
interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  stuck: boolean; // true when glued to paddle (Thermal Paste)
  dead: boolean; // true when lost past the bottom edge
}

interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  baseWidth: number;
}

interface Brick {
  col: number;
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  label: string; // row label
  isBoss: boolean;
  hitFlash: number; // frame counter for flash effect
}

interface PowerUp {
  x: number;
  y: number;
  vy: number;
  type: "thermal" | "rgb" | "overclock" | "leak";
  width: number;
  height: number;
}

interface OneDriveEvent {
  active: boolean;
  countdown: number; // seconds remaining in countdown
  remaining: number; // seconds remaining in effect
  timer: number; // accumulator
}

/* ── Constants ── */
const CANVAS_W = 800;
const CANVAS_H = 600;

const BRICK_COLS = 8;
const BRICK_ROWS = 5;
const BRICK_GAP = 4;
const BRICK_TOP = 60;
const BRICK_LEFT = 40;
const BRICK_RIGHT = CANVAS_W - 40;
const BRICK_W =
  (BRICK_RIGHT - BRICK_LEFT - BRICK_GAP * (BRICK_COLS - 1)) / BRICK_COLS;
const BRICK_H = 24;

const ROW_LABELS = ["VRM", "RAM", "PCIe", "SATA", "I/O"];
const ROW_MAX_HP = [3, 2, 2, 1, 1];
const BUILD_PARTS = ["PSU", "Motherboard", "RAM", "GPU", "CPU"];

const PADDLE_Y = CANVAS_H - 50;
const PADDLE_BASE_W = 110;
const PADDLE_H = 14;
const BALL_RADIUS = 8;
// px/s. Ball velocity is integrated against dt (seconds), so this must be a
// per-second speed -- 330px/s is ~5.5px per frame at 60fps.
const BALL_BASE_SPEED = 330;

const DROP_CHANCE = 0.18;
const BAD_DROP_CHANCE = 0.12;
const DROP_SPEED = 2.2;
const DROP_SIZE = 24;

const ONEDRIVE_INTERVAL = 45; // seconds

/* ── Helpers ── */
function aabb(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/* ── Sound engine (tiny, off by default) ── */
let audioCtx: AudioContext | null = null;
function getAudio() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}
function beep(freq: number, dur: number, vol = 0.08) {
  try {
    const ctx = getAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.value = vol;
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + dur
    );
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch {
    // sound not available
  }
}

/* ── Component ── */
export function BreakoutGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* React state: HUD only */
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [hiscore, setHiscore] = useState(0);
  const [buildParts, setBuildParts] = useState<string[]>([]);
  const [gameStatus, setGameStatus] = useState<
    "waiting" | "playing" | "paused" | "won" | "lost"
  >("waiting");
  const [toast, setToast] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [overclockActive, setOverclockActive] = useState(false);
  const [rgbActive, setRgbActive] = useState(false);

  /* Refs: all game state lives here to avoid React render overhead */
  const ballsRef = useRef<Ball[]>([]);
  const paddleRef = useRef<Paddle>({
    x: CANVAS_W / 2 - PADDLE_BASE_W / 2,
    y: PADDLE_Y,
    width: PADDLE_BASE_W,
    height: PADDLE_H,
    baseWidth: PADDLE_BASE_W,
  });
  const bricksRef = useRef<Brick[]>([]);
  const dropsRef = useRef<PowerUp[]>([]);
  const livesRef = useRef(3);
  const scoreRef = useRef(0);
  const statusRef = useRef<typeof gameStatus>("waiting");
  const hiscoreRef = useRef(0);
  const soundRef = useRef(false);
  const buildRef = useRef<string[]>([]);
  const clearedRowsRef = useRef<Set<number>>(new Set());
  const bossRef = useRef<Brick | null>(null);
  const overclockRef = useRef({ active: false, timer: 0 });
  const rgbRef = useRef({ active: false, timer: 0 });
  const oneDriveRef = useRef<OneDriveEvent>({
    active: false,
    countdown: 0,
    remaining: 0,
    timer: 0,
  });
  const leakRef = useRef({ active: false, timer: 0 });
  const toastRef = useRef<string | null>(null);
  const toastTimerRef = useRef(0);
  const keysRef = useRef<Set<string>>(new Set());
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const oneDriveTimerRef = useRef(0);
  const speedMultiplierRef = useRef(1);
  const shakeRef = useRef(0);
  const prefersReducedMotion = useRef(false);
  const touchRef = useRef<{ active: boolean; lastX: number }>({
    active: false,
    lastX: 0,
  });
  const driftRef = useRef(0);

  /* ── Init / reset ── */
  const initBricks = useCallback(() => {
    const bricks: Brick[] = [];
    const topOffset = BRICK_TOP;
    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        const x = BRICK_LEFT + col * (BRICK_W + BRICK_GAP);
        const y = topOffset + row * (BRICK_H + BRICK_GAP);
        const isBoss = row === 0 && col === 3;
        bricks.push({
          col,
          row,
          x,
          y,
          w: BRICK_W,
          h: BRICK_H,
          hp: isBoss ? 6 : ROW_MAX_HP[row],
          maxHp: isBoss ? 6 : ROW_MAX_HP[row],
          alive: true,
          label: ROW_LABELS[row],
          isBoss,
          hitFlash: 0,
        });
      }
    }
    return bricks;
  }, []);

  const resetGame = useCallback(() => {
    const p = paddleRef.current;
    p.x = CANVAS_W / 2 - PADDLE_BASE_W / 2;
    p.width = PADDLE_BASE_W;
    p.baseWidth = PADDLE_BASE_W;

    ballsRef.current = [
      {
        x: CANVAS_W / 2,
        y: PADDLE_Y - BALL_RADIUS - 2,
        vx: 0,
        vy: 0,
        radius: BALL_RADIUS,
        speed: BALL_BASE_SPEED,
        stuck: true,
        dead: false,
      },
    ];

    bricksRef.current = initBricks();
    dropsRef.current = [];
    livesRef.current = 3;
    scoreRef.current = 0;
    statusRef.current = "waiting";
    buildRef.current = [];
    clearedRowsRef.current = new Set();
    bossRef.current =
      bricksRef.current.find((b) => b.isBoss && b.alive) ?? null;
    overclockRef.current = { active: false, timer: 0 };
    rgbRef.current = { active: false, timer: 0 };
    oneDriveRef.current = {
      active: false,
      countdown: 0,
      remaining: 0,
      timer: 0,
    };
    leakRef.current = { active: false, timer: 0 };
    toastRef.current = null;
    toastTimerRef.current = 0;
    oneDriveTimerRef.current = 0;
    speedMultiplierRef.current = 1;
    shakeRef.current = 0;
    setScore(0);
    setLives(3);
    setBuildParts([]);
    setGameStatus("waiting");
    setToast(null);
    setOverclockActive(false);
    setRgbActive(false);
    setHiscore(hiscoreRef.current);
  }, [initBricks]);

  /* ── Ball-paddle launch ── */
  const launchBall = useCallback(() => {
    const status = statusRef.current;
    // "playing" included so thermal-pasted (glued) balls can be relaunched
    if (status !== "waiting" && status !== "playing") return;
    const stuckBalls = ballsRef.current.filter((b) => b.stuck && !b.dead);
    if (stuckBalls.length === 0) return;
    for (const b of stuckBalls) {
      b.stuck = false;
      // Launch within a +/- 65 degree cone from vertical, never horizontal
      const a = Math.random() * 2.27 - 1.135;
      b.vx = Math.sin(a) * b.speed;
      b.vy = -Math.cos(a) * b.speed;
    }
    statusRef.current = "playing";
    setGameStatus("playing");
  }, []);

  /* ── Spawn power-up drop ── */
  const spawnDrop = useCallback((bx: number, by: number) => {
    const rand = Math.random();
    const isBad = rand < BAD_DROP_CHANCE;
    const types: PowerUp["type"][] = ["thermal", "rgb", "overclock"];
    const type: PowerUp["type"] = isBad
      ? "leak"
      : types[Math.floor(Math.random() * types.length)];
    dropsRef.current.push({
      x: bx + BRICK_W / 2 - DROP_SIZE / 2,
      y: by,
      vy: DROP_SPEED,
      type,
      width: DROP_SIZE,
      height: DROP_SIZE,
    });
  }, []);

  /* ── Apply power-up ── */
  const applyPowerUp = useCallback(
    (type: PowerUp["type"]) => {
      if (soundRef.current) beep(600, 0.15, 0.1);
      switch (type) {
        case "thermal": {
          // Ball sticks to paddle on next catch
          const balls = ballsRef.current;
          if (balls.length > 0) {
            // Set all balls to stuck on next paddle hit
            // We'll handle this in collision logic by setting a flag
            // For simplicity: set the first active ball to stuck
            const active = balls.filter((b) => !b.stuck && !b.dead);
            if (active.length > 0) {
              active[0].stuck = true;
            }
          }
          break;
        }
        case "rgb": {
          // Multiball: split into 3
          rgbRef.current = { active: true, timer: 180 }; // 3s at 60fps
          setRgbActive(true);
          const balls = ballsRef.current;
          const existing = balls.filter((b) => !b.stuck);
          const toSplit = [...existing];
          for (const b of toSplit) {
            const angle1 = Math.atan2(b.vy, b.vx) + 0.5;
            const angle2 = Math.atan2(b.vy, b.vx) - 0.5;
            balls.push({
              x: b.x,
              y: b.y,
              vx: Math.cos(angle1) * b.speed,
              vy: Math.sin(angle1) * b.speed,
              radius: BALL_RADIUS,
              speed: b.speed,
              stuck: false,
              dead: false,
            });
            balls.push({
              x: b.x,
              y: b.y,
              vx: Math.cos(angle2) * b.speed,
              vy: Math.sin(angle2) * b.speed,
              radius: BALL_RADIUS,
              speed: b.speed,
              stuck: false,
              dead: false,
            });
          }
          break;
        }
        case "overclock": {
          overclockRef.current = { active: true, timer: 600 }; // 10s at 60fps
          speedMultiplierRef.current = 1.4;
          setOverclockActive(true);
          break;
        }
        case "leak": {
          // Bad: paddle halves + slippery for 4s
          leakRef.current = { active: true, timer: 240 };
          const p = paddleRef.current;
          p.width = Math.max(p.baseWidth / 2, 40);
          break;
        }
      }
    },
    []
  );

  /* ── Check row cleared ── */
  const checkRowCleared = useCallback(
    (row: number) => {
      if (clearedRowsRef.current.has(row)) return;
      const rowBricks = bricksRef.current.filter(
        (b) => b.row === row && b.alive
      );
      if (rowBricks.length === 0) {
        clearedRowsRef.current.add(row);
        buildRef.current = [...buildRef.current, BUILD_PARTS[row]];
        setBuildParts([...buildRef.current]);
        if (soundRef.current) beep(400, 0.2, 0.12);
      }
    },
    []
  );

  /* ── Lose a life ── */
  const loseLife = useCallback(() => {
    livesRef.current--;
    setLives(livesRef.current);
    if (soundRef.current) beep(120, 0.3, 0.08);

    if (livesRef.current <= 0) {
      // Game over
      statusRef.current = "lost";
      setGameStatus("lost");
      if (scoreRef.current > hiscoreRef.current) {
        hiscoreRef.current = scoreRef.current;
        setHiscore(hiscoreRef.current);
        try {
          localStorage.setItem(
            "xtreme-breakout-hiscore",
            String(hiscoreRef.current)
          );
        } catch {
          // localStorage not available
        }
      }
      return;
    }

    // Reset ball to paddle
    const p = paddleRef.current;
    ballsRef.current = [
      {
        x: p.x + p.width / 2,
        y: PADDLE_Y - BALL_RADIUS - 2,
        vx: 0,
        vy: 0,
        radius: BALL_RADIUS,
        speed: BALL_BASE_SPEED,
        stuck: true,
        dead: false,
      },
    ];
    // Cancel power-ups
    overclockRef.current = { active: false, timer: 0 };
    rgbRef.current = { active: false, timer: 0 };
    leakRef.current = { active: false, timer: 0 };
    speedMultiplierRef.current = 1;
    p.width = p.baseWidth;
    setOverclockActive(false);
    setRgbActive(false);
    statusRef.current = "waiting";
    setGameStatus("waiting");
  }, []);

  /* ── Game loop ── */
  const gameLoop = useCallback(
    (time: number) => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / CANVAS_W;
      const scaleY = rect.height / CANVAS_H;
      const scale = Math.min(scaleX, scaleY);

      // Delta time (capped at 33ms to prevent huge steps on tab return)
      const rawDt = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 1 / 60;
      const dt = Math.min(rawDt, 0.033);
      lastTimeRef.current = time;

      const status = statusRef.current;
      const balls = ballsRef.current;
      const paddle = paddleRef.current;
      const bricks = bricksRef.current;
      const drops = dropsRef.current;

      /* ── Update ── */
      if (status === "playing") {
        // OneDrive timer
        oneDriveTimerRef.current += dt;
        const od = oneDriveRef.current;
        if (!od.active && oneDriveTimerRef.current >= ONEDRIVE_INTERVAL - 2) {
          // Start countdown
          od.countdown = 2 - (oneDriveTimerRef.current - (ONEDRIVE_INTERVAL - 2));
          if (od.countdown <= 0) {
            od.active = true;
            od.remaining = 5;
            od.timer = 0;
            oneDriveTimerRef.current = 0;
            od.countdown = 0;
            toastRef.current = "OneDrive is syncing your paddle...";
            toastTimerRef.current = 300; // 5s at 60fps
            setToast(toastRef.current);
          }
        }
        if (od.active) {
          od.remaining -= dt;
          toastTimerRef.current--;
          if (toastTimerRef.current <= 0) {
            toastRef.current = null;
            setToast(null);
          }
          if (od.remaining <= 0) {
            od.active = false;
            od.remaining = 0;
            toastRef.current = null;
            setToast(null);
          }
        }

        // Overclock timer
        const oc = overclockRef.current;
        if (oc.active) {
          oc.timer--;
          if (oc.timer <= 0) {
            oc.active = false;
            speedMultiplierRef.current = 1;
            setOverclockActive(false);
          }
        }

        // RGB timer
        const rgb = rgbRef.current;
        if (rgb.active) {
          rgb.timer--;
          if (rgb.timer <= 0) {
            rgb.active = false;
            setRgbActive(false);
          }
        }

        // Leak timer
        const leak = leakRef.current;
        if (leak.active) {
          leak.timer--;
          if (leak.timer <= 0) {
            leak.active = false;
            paddle.width = paddle.baseWidth;
          }
        }

        // Move paddle via keys
        const invert = od.active;
        const keySpeed = 480; // px/s
        let keyDir = 0;
        if (keysRef.current.has("ArrowLeft")) keyDir -= 1;
        if (keysRef.current.has("ArrowRight")) keyDir += 1;
        if (invert) keyDir *= -1;
        if (keyDir !== 0) driftRef.current = keyDir;
        paddle.x += keyDir * keySpeed * dt;

        // Leak slippery: the paddle keeps drifting after you let go
        if (leak.active && keyDir === 0 && Math.abs(driftRef.current) > 0.02) {
          paddle.x += driftRef.current * keySpeed * dt * 0.6;
          driftRef.current *= 0.9;
        }
        if (!leak.active && keyDir === 0) driftRef.current = 0;

        // Clamp paddle
        paddle.x = Math.max(0, Math.min(CANVAS_W - paddle.width, paddle.x));

        // Update balls (sub-step for fast balls)
        const speedMul = speedMultiplierRef.current;
        for (const ball of balls) {
          if (ball.stuck) {
            ball.x = paddle.x + paddle.width / 2;
            ball.y = PADDLE_Y - ball.radius - 2;
            continue;
          }

          const effectiveSpeed = ball.speed * speedMul;
          // Size sub-steps off actual on-screen movement (px/frame), not the
          // raw px/s speed, so this stays correct as dt varies.
          const pxPerFrame = effectiveSpeed * dt;
          const steps = Math.max(1, Math.ceil(pxPerFrame / 3)); // sub-step when fast
          const stepDt = dt / steps;

          for (let s = 0; s < steps; s++) {
            ball.x += ball.vx * stepDt * speedMul;
            ball.y += ball.vy * stepDt * speedMul;

            // Wall collisions
            if (ball.x - ball.radius < 0) {
              ball.x = ball.radius;
              ball.vx = Math.abs(ball.vx);
            }
            if (ball.x + ball.radius > CANVAS_W) {
              ball.x = CANVAS_W - ball.radius;
              ball.vx = -Math.abs(ball.vx);
            }
            if (ball.y - ball.radius < 0) {
              ball.y = ball.radius;
              ball.vy = Math.abs(ball.vy);
            }

            // Bottom (death)
            if (ball.y + ball.radius > CANVAS_H) {
              ball.dead = true;
              break;
            }

            // Paddle collision
            if (
              aabb(
                ball.x - ball.radius,
                ball.y - ball.radius,
                ball.radius * 2,
                ball.radius * 2,
                paddle.x,
                paddle.y,
                paddle.width,
                paddle.height
              ) &&
              ball.vy > 0 // only when moving down
            ) {
              // Angle based on hit position
              const hitPos =
                (ball.x - paddle.x) / paddle.width; // 0..1
              const angle = (hitPos - 0.5) * Math.PI * 0.7; // -63deg to +63deg
              const spd = effectiveSpeed;
              ball.vx = Math.sin(angle) * spd;
              ball.vy = -Math.cos(angle) * spd;
              ball.y = paddle.y - ball.radius;
              if (soundRef.current && Math.random() < 0.3)
                beep(300, 0.05, 0.05);
            }

            // Brick collisions
            for (const brick of bricks) {
              if (!brick.alive) continue;
              if (
                aabb(
                  ball.x - ball.radius,
                  ball.y - ball.radius,
                  ball.radius * 2,
                  ball.radius * 2,
                  brick.x,
                  brick.y,
                  brick.w,
                  brick.h
                )
              ) {
                // Determine collision side
                const ballLeft = ball.x - ball.radius;
                const ballRight = ball.x + ball.radius;
                const ballTop = ball.y - ball.radius;
                const ballBottom = ball.y + ball.radius;
                const brickLeft = brick.x;
                const brickRight = brick.x + brick.w;
                const brickTop = brick.y;
                const brickBottom = brick.y + brick.h;

                const overlapLeft = ballRight - brickLeft;
                const overlapRight = brickRight - ballLeft;
                const overlapTop = ballBottom - brickTop;
                const overlapBottom = brickBottom - ballTop;

                const minOverlapX = Math.min(overlapLeft, overlapRight);
                const minOverlapY = Math.min(overlapTop, overlapBottom);

                if (minOverlapX < minOverlapY) {
                  ball.vx = overlapLeft < overlapRight ? -Math.abs(ball.vx) : Math.abs(ball.vx);
                } else {
                  ball.vy = overlapTop < overlapBottom ? -Math.abs(ball.vy) : Math.abs(ball.vy);
                }

                // Hit brick
                brick.hp--;
                brick.hitFlash = 8; // flash for 8 frames
                if (soundRef.current) beep(500, 0.06, 0.07);

                if (brick.hp <= 0) {
                  brick.alive = false;
                  const points = brick.isBoss ? 500 : brick.maxHp * 50;
                  scoreRef.current +=
                    overclockRef.current.active ? points * 2 : points;
                  setScore(scoreRef.current);

                  // Check if boss killed
                  if (brick.isBoss) {
                    bossRef.current = null;
                    statusRef.current = "won";
                    setGameStatus("won");
                    if (soundRef.current) beep(800, 0.3, 0.15);
                    if (scoreRef.current > hiscoreRef.current) {
                      hiscoreRef.current = scoreRef.current;
                      setHiscore(hiscoreRef.current);
                      try {
                        localStorage.setItem(
                          "xtreme-breakout-hiscore",
                          String(hiscoreRef.current)
                        );
                      } catch {
                        // ignore
                      }
                    }
                    // Mark all rows as cleared for build display
                    for (let r = 0; r < BRICK_ROWS; r++) {
                      if (!clearedRowsRef.current.has(r)) {
                        clearedRowsRef.current.add(r);
                        buildRef.current.push(BUILD_PARTS[r]);
                      }
                    }
                    setBuildParts([...buildRef.current]);
                  }

                  // Chance to drop power-up
                  if (Math.random() < DROP_CHANCE) {
                    spawnDrop(brick.x, brick.y);
                  }

                  // Check row cleared
                  checkRowCleared(brick.row);
                }

                break; // one brick per sub-step
              }
            }
          }
        }

        // Remove balls lost past the bottom; lose a life only when none remain.
        // Glued (thermal paste) balls are alive and do NOT cost a life.
        ballsRef.current = balls.filter((b) => !b.dead);
        if (ballsRef.current.length === 0) {
          loseLife();
        }

        // Update drops
        for (const drop of drops) {
          drop.y += drop.vy * dt * 60;
          // Check paddle catch
          if (
            aabb(
              drop.x,
              drop.y,
              drop.width,
              drop.height,
              paddle.x,
              paddle.y,
              paddle.width,
              paddle.height
            )
          ) {
            applyPowerUp(drop.type);
            drop.y = CANVAS_H + 100; // mark for removal
          }
          // Off screen
          if (drop.y > CANVAS_H + 50) {
            drop.y = CANVAS_H + 100;
          }
        }
        dropsRef.current = drops.filter((d) => d.y < CANVAS_H + 50);

        // Flash decay
        for (const brick of bricks) {
          if (brick.hitFlash > 0) brick.hitFlash--;
        }

        // Shake decay
        if (shakeRef.current > 0) shakeRef.current -= dt * 15;
      }

      /* ── Draw ── */

      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Scale
      ctx.save();
      // Apply DPR
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Centre the game
      const offsetX = (canvas.width / dpr - CANVAS_W * scale) / 2;
      const offsetY = (canvas.height / dpr - CANVAS_H * scale) / 2;
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      // Screen shake
      let shakeX = 0;
      let shakeY = 0;
      if (shakeRef.current > 0 && !prefersReducedMotion.current) {
        shakeX = (Math.random() - 0.5) * shakeRef.current * 6;
        shakeY = (Math.random() - 0.5) * shakeRef.current * 6;
      }
      ctx.translate(shakeX, shakeY);

      // Background
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(-20, -20, CANVAS_W + 40, CANVAS_H + 40);

      // Grid lines (subtle motherboard look)
      ctx.strokeStyle = "rgba(45, 212, 191, 0.06)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x < CANVAS_W; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_H);
        ctx.stroke();
      }
      for (let y = 0; y < CANVAS_H; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_W, y);
        ctx.stroke();
      }

      // Draw bricks
      for (const brick of bricks) {
        if (!brick.alive) continue;

        // HP-based colour
        const hpRatio = brick.hp / brick.maxHp;
        let baseColor: string;
        if (brick.isBoss) {
          baseColor = brick.hitFlash > 0 ? "#f59e0b" : "#d97706";
        } else {
          const g = Math.floor(180 + 75 * hpRatio);
          baseColor = `rgb(20, ${g}, 50)`;
        }

        // Flash on hit
        const flash =
          brick.hitFlash > 0 && brick.hitFlash % 2 === 0;
        const fillColor = flash ? "#fdfdf8" : baseColor;

        // PCB-style brick with pin details
        ctx.fillStyle = fillColor;
        ctx.fillRect(brick.x, brick.y, brick.w, brick.h);

        // Darker border
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 1;
        ctx.strokeRect(brick.x, brick.y, brick.w, brick.h);

        // Pin details on left and right edges
        ctx.fillStyle = "rgba(245, 245, 245, 0.5)";
        const pinW = 3;
        const pinSpacing = 6;
        for (
          let py = brick.y + 4;
          py < brick.y + brick.h - 2;
          py += pinSpacing
        ) {
          ctx.fillRect(brick.x - 1, py, pinW, 2);
          ctx.fillRect(brick.x + brick.w - pinW + 1, py, pinW, 2);
        }

        // Row label on first brick of each row
        if (brick.col === 0) {
          ctx.fillStyle = "rgba(45, 212, 191, 0.5)";
          ctx.font = "10px monospace";
          ctx.textAlign = "right";
          ctx.fillText(brick.label, brick.x - 6, brick.y + brick.h / 2 + 4);
        }

        // Boss label
        if (brick.isBoss) {
          ctx.fillStyle = "#f5f5f5";
          ctx.font = "bold 9px monospace";
          ctx.textAlign = "center";
          ctx.fillText(
            `i7 2600K [${brick.hp}]`,
            brick.x + brick.w / 2,
            brick.y + brick.h / 2 + 4
          );
        }

        // HP pips for non-boss
        if (!brick.isBoss && brick.maxHp > 1) {
          ctx.fillStyle = "rgba(255,255,255,0.6)";
          for (let p = 0; p < brick.hp; p++) {
            ctx.fillRect(
              brick.x + 4 + p * 6,
              brick.y + brick.h - 5,
              4,
              2
            );
          }
        }
      }

      // Draw drops
      for (const drop of drops) {
        ctx.save();
        switch (drop.type) {
          case "thermal": {
            // White blob
            ctx.fillStyle = "#fdfdf8";
            ctx.beginPath();
            ctx.arc(
              drop.x + drop.width / 2,
              drop.y + drop.height / 2,
              drop.width / 2,
              0,
              Math.PI * 2
            );
            ctx.fill();
            ctx.fillStyle = "#e5e5e5";
            ctx.beginPath();
            ctx.arc(
              drop.x + drop.width / 2 - 3,
              drop.y + drop.height / 2 - 2,
              4,
              0,
              Math.PI * 2
            );
            ctx.fill();
            break;
          }
          case "rgb": {
            // Cycling colours
            const hue = (Date.now() / 10) % 360;
            ctx.fillStyle = `hsl(${hue}, 100%, 55%)`;
            ctx.fillRect(drop.x, drop.y, drop.width, drop.height);
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 2;
            ctx.strokeRect(drop.x, drop.y, drop.width, drop.height);
            break;
          }
          case "overclock": {
            // Amber lightning bolt
            ctx.fillStyle = "#f59e0b";
            ctx.beginPath();
            const cx = drop.x + drop.width / 2;
            const cy = drop.y + drop.height / 2;
            ctx.moveTo(cx, cy - 10);
            ctx.lineTo(cx - 6, cy + 2);
            ctx.lineTo(cx + 2, cy + 2);
            ctx.lineTo(cx - 2, cy + 10);
            ctx.lineTo(cx + 8, cy - 2);
            ctx.lineTo(cx, cy - 2);
            ctx.closePath();
            ctx.fill();
            break;
          }
          case "leak": {
            // Blue droplet
            ctx.fillStyle = "#3b82f6";
            ctx.beginPath();
            ctx.arc(
              drop.x + drop.width / 2,
              drop.y + drop.height / 2,
              drop.width / 2,
              0,
              Math.PI * 2
            );
            ctx.fill();
            ctx.fillStyle = "#60a5fa";
            ctx.beginPath();
            ctx.arc(
              drop.x + drop.width / 2 - 3,
              drop.y + drop.height / 2 - 2,
              5,
              0,
              Math.PI * 2
            );
            ctx.fill();
            break;
          }
        }
        ctx.restore();
      }

      // Draw paddle
      const paddleGrad = ctx.createLinearGradient(
        paddle.x,
        paddle.y,
        paddle.x,
        paddle.y + paddle.height
      );
      if (leakRef.current.active) {
        paddleGrad.addColorStop(0, "#3b82f6");
        paddleGrad.addColorStop(1, "#1d4ed8");
      } else if (rgbRef.current.active) {
        const hue = (Date.now() / 5) % 360;
        paddleGrad.addColorStop(0, `hsl(${hue}, 100%, 55%)`);
        paddleGrad.addColorStop(1, `hsl(${(hue + 30) % 360}, 100%, 40%)`);
      } else {
        paddleGrad.addColorStop(0, "#2dd4bf");
        paddleGrad.addColorStop(1, "#0d9488");
      }
      ctx.fillStyle = paddleGrad;
      ctx.beginPath();
      ctx.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw balls (glued balls included, sitting on the paddle)
      for (const ball of balls) {
        if (ball.dead) continue;
        ctx.fillStyle = rgbRef.current.active
          ? `hsl(${(Date.now() / 5) % 360}, 100%, 70%)`
          : "#fdfdf8";
        ctx.shadowColor = overclockRef.current.active
          ? "#f59e0b"
          : "transparent";
        ctx.shadowBlur = overclockRef.current.active ? 12 : 0;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // OneDrive countdown indicator
      const od2 = oneDriveRef.current;
      if (
        !od2.active &&
        oneDriveTimerRef.current >= ONEDRIVE_INTERVAL - 2 &&
        oneDriveTimerRef.current < ONEDRIVE_INTERVAL
      ) {
        const cd = Math.ceil(
          ONEDRIVE_INTERVAL - oneDriveTimerRef.current
        );
        ctx.fillStyle = "rgba(245, 158, 11, 0.9)";
        ctx.font = "bold 18px monospace";
        ctx.textAlign = "center";
        ctx.fillText(
          `OneDrive sync in ${cd}...`,
          CANVAS_W / 2,
          CANVAS_H / 2
        );
      }

      // Overclock indicator
      if (overclockRef.current.active) {
        ctx.fillStyle = "rgba(245, 158, 11, 0.85)";
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "right";
        ctx.fillText("OVERCLOCK x2", CANVAS_W - 20, 30);
      }

      // Leak indicator
      if (leakRef.current.active) {
        ctx.fillStyle = "rgba(59, 130, 246, 0.85)";
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "right";
        ctx.fillText("WATER LEAK!", CANVAS_W - 20, leakRef.current.active ? 50 : 30);
      }

      // Pause overlay
      if (status === "paused") {
        ctx.fillStyle = "rgba(10, 10, 15, 0.7)";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = "#f5f5f5";
        ctx.font = "bold 32px monospace";
        ctx.textAlign = "center";
        ctx.fillText("PAUSED", CANVAS_W / 2, CANVAS_H / 2 - 10);
        ctx.font = "14px monospace";
        ctx.fillText(
          "Press P to resume",
          CANVAS_W / 2,
          CANVAS_H / 2 + 25
        );
      }

      // Game over overlay
      if (status === "lost") {
        ctx.fillStyle = "rgba(10, 10, 15, 0.8)";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 36px monospace";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", CANVAS_W / 2, CANVAS_H / 2 - 20);
        ctx.fillStyle = "#f5f5f5";
        ctx.font = "18px monospace";
        ctx.fillText(
          `Score: ${scoreRef.current}`,
          CANVAS_W / 2,
          CANVAS_H / 2 + 25
        );
        ctx.fillText(
          "Click or press Space to restart",
          CANVAS_W / 2,
          CANVAS_H / 2 + 55
        );
      }

      // Won overlay
      if (status === "won") {
        ctx.fillStyle = "rgba(10, 10, 15, 0.75)";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = "#2dd4bf";
        ctx.font = "bold 36px monospace";
        ctx.textAlign = "center";
        ctx.fillText("POST OK", CANVAS_W / 2, CANVAS_H / 2 - 20);
        ctx.fillStyle = "#f5f5f5";
        ctx.font = "18px monospace";
        ctx.fillText(
          "PC BOOTED. The i7 2600K is finally at peace.",
          CANVAS_W / 2,
          CANVAS_H / 2 + 20
        );
        ctx.fillText(
          `Score: ${scoreRef.current}`,
          CANVAS_W / 2,
          CANVAS_H / 2 + 50
        );
        ctx.fillText(
          "Click or press Space to play again",
          CANVAS_W / 2,
          CANVAS_H / 2 + 80
        );
      }

      // Waiting prompt
      if (status === "waiting") {
        ctx.fillStyle = "rgba(245, 245, 245, 0.7)";
        ctx.font = "16px monospace";
        ctx.textAlign = "center";
        // Blink effect
        if (Math.floor(Date.now() / 600) % 2 === 0) {
          ctx.fillText(
            "Click, press Space, or tap to launch",
            CANVAS_W / 2,
            CANVAS_H / 2 + 60
          );
        }
      }

      ctx.restore();

      rafRef.current = requestAnimationFrame(gameLoop);
    },
    [applyPowerUp, checkRowCleared, loseLife, spawnDrop]
  );

  /* ── Canvas resize ── */
  const resize = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const dpr = window.devicePixelRatio || 1;
    const maxW = container.clientWidth;
    const maxH = Math.min(window.innerHeight * 0.7, 600);
    canvas.width = maxW * dpr;
    canvas.height = maxH * dpr;
    canvas.style.width = `${maxW}px`;
    canvas.style.height = `${maxH}px`;
  }, []);

  /* ── Effects ── */
  useEffect(() => {
    // Load hiscore
    try {
      const stored = localStorage.getItem("xtreme-breakout-hiscore");
      if (stored) {
        const hs = parseInt(stored, 10);
        if (!isNaN(hs)) {
          hiscoreRef.current = hs;
          setHiscore(hs);
        }
      }
    } catch {
      // ignore
    }

    // Check reduced motion
    prefersReducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Init game
    resetGame();
    resize();

    // Start loop
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(gameLoop);

    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [gameLoop, resetGame, resize]);

  /* ── Keyboard ── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);

      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        if (
          statusRef.current === "waiting" ||
          statusRef.current === "playing"
        ) {
          launchBall();
        } else if (
          statusRef.current === "lost" ||
          statusRef.current === "won"
        ) {
          resetGame();
        }
      }
      if (e.key === "p" || e.key === "P") {
        if (statusRef.current === "playing") {
          statusRef.current = "paused";
          setGameStatus("paused");
        } else if (statusRef.current === "paused") {
          statusRef.current = "playing";
          setGameStatus("playing");
          lastTimeRef.current = 0; // prevent huge dt jump
        }
      }
      if (e.key === "Escape") {
        if (canvasRef.current) canvasRef.current.blur();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [launchBall, resetGame]);

  /* ── Mouse ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getCanvasX = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / CANVAS_W;
      const offsetX =
        (canvas.width / (window.devicePixelRatio || 1) -
          CANVAS_W * Math.min(scaleX, rect.height / CANVAS_H)) /
        2;
      const scale = Math.min(scaleX, rect.height / CANVAS_H);
      return (clientX - rect.left - offsetX) / scale;
    };

    const handleMouseMove = (e: MouseEvent) => {
      let x = getCanvasX(e.clientX);
      // OneDrive sync event inverts ALL controls, including the mouse
      if (oneDriveRef.current.active) x = CANVAS_W - x;
      const paddle = paddleRef.current;
      paddle.x = x - paddle.width / 2;
      paddle.x = Math.max(0, Math.min(CANVAS_W - paddle.width, paddle.x));
    };

    const handleClick = () => {
      if (
        statusRef.current === "waiting" ||
        statusRef.current === "playing"
      ) {
        launchBall();
      } else if (
        statusRef.current === "lost" ||
        statusRef.current === "won"
      ) {
        resetGame();
      }
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("click", handleClick);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("click", handleClick);
    };
  }, [launchBall, resetGame]);

  /* ── Touch ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getCanvasX = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / CANVAS_W;
      const offsetX =
        (canvas.width / (window.devicePixelRatio || 1) -
          CANVAS_W * Math.min(scaleX, rect.height / CANVAS_H)) /
        2;
      const scale = Math.min(scaleX, rect.height / CANVAS_H);
      return (clientX - rect.left - offsetX) / scale;
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      let x = getCanvasX(e.touches[0].clientX);
      if (oneDriveRef.current.active) x = CANVAS_W - x;
      const paddle = paddleRef.current;
      paddle.x = x - paddle.width / 2;
      paddle.x = Math.max(0, Math.min(CANVAS_W - paddle.width, paddle.x));
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (
        statusRef.current === "waiting" ||
        statusRef.current === "playing"
      ) {
        launchBall();
      } else if (
        statusRef.current === "lost" ||
        statusRef.current === "won"
      ) {
        resetGame();
      }
      const x = getCanvasX(e.touches[0].clientX);
      const paddle = paddleRef.current;
      paddle.x = x - paddle.width / 2;
      paddle.x = Math.max(0, Math.min(CANVAS_W - paddle.width, paddle.x));
    };

    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });

    return () => {
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchstart", handleTouchStart);
    };
  }, [launchBall, resetGame]);

  /* ── Tab visibility: pause when hidden ── */
  useEffect(() => {
    const handleVisibility = () => {
      if (
        document.hidden &&
        statusRef.current === "playing"
      ) {
        statusRef.current = "paused";
        setGameStatus("paused");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  /* ── Mute toggle ── */
  const toggleSound = useCallback(() => {
    soundRef.current = !soundRef.current;
    setSoundOn(soundRef.current);
  }, []);

  /* ── Render ── */
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 min-w-0 rounded-lg overflow-hidden border border-surface-border"
      >
        <canvas
          ref={canvasRef}
          className="block w-full cursor-none"
          tabIndex={-1}
          aria-label="Xtreme Breakout game canvas"
        />
      </div>

      {/* Side panel */}
      <div className="w-full lg:w-64 shrink-0 space-y-6">
        {/* Scoreboard */}
        <div className="rounded-lg border border-surface-border bg-surface p-4">
          <h2 className="font-serif text-lg font-bold text-foreground mb-3">
            SCORE
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-foreground/60">Score</span>
              <span className="text-accent font-mono font-bold text-lg">
                {score}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground/60">High Score</span>
              <span className="text-amber font-mono font-bold">{hiscore}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground/60">Lives</span>
              <span className="text-red-400 font-mono font-bold">
                {"♥".repeat(Math.max(0, lives))}
                {"♡".repeat(Math.max(0, 3 - lives))}
              </span>
            </div>
            {(overclockActive || rgbActive) && (
              <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-surface-border">
                {overclockActive && (
                  <span className="text-xs px-2 py-0.5 rounded bg-amber/20 text-amber border border-amber/30">
                    OC x2
                  </span>
                )}
                {rgbActive && (
                  <span className="text-xs px-2 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30">
                    RGB
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Build progress */}
        <div className="rounded-lg border border-surface-border bg-surface p-4">
          <h2 className="font-serif text-lg font-bold text-foreground mb-3">
            BUILD PROGRESS
          </h2>
          <ul className="space-y-1.5 text-sm">
            {BUILD_PARTS.map((part, i) => {
              const acquired = buildParts.includes(part);
              return (
                <li
                  key={part}
                  className={`flex items-center gap-2 font-mono ${
                    acquired ? "text-accent" : "text-foreground/30"
                  }`}
                >
                  <span className="text-xs w-4">
                    {acquired ? "✓" : "○"}
                  </span>
                  {part}
                </li>
              );
            })}
          </ul>
          {buildParts.length >= BUILD_PARTS.length && (
            <p className="text-accent font-mono font-bold mt-3 text-sm pt-3 border-t border-surface-border">
              PC BOOTED.
            </p>
          )}
          {gameStatus === "won" && (
            <p className="text-accent font-mono font-bold mt-3 text-sm pt-3 border-t border-surface-border">
              POST OK -- i7 2600K defeated.
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="rounded-lg border border-surface-border bg-surface p-4">
          <h2 className="font-serif text-lg font-bold text-foreground mb-3">
            CONTROLS
          </h2>
          <ul className="text-xs text-foreground/50 space-y-1 font-mono">
            <li>Mouse / touch -- move paddle</li>
            <li>Arrow keys -- move paddle</li>
            <li>Space / click -- launch ball</li>
            <li>P -- pause</li>
            <li>ESC -- release focus</li>
          </ul>
        </div>

        {/* Legend + sound */}
        <div className="rounded-lg border border-surface-border bg-surface p-4">
          <h2 className="font-serif text-lg font-bold text-foreground mb-3">
            POWER-UPS
          </h2>
          <ul className="text-xs text-foreground/50 space-y-1.5">
            <li>
              <span className="inline-block w-3 h-3 rounded-full bg-white mr-1.5 align-middle" />
              Thermal Paste: ball sticks
            </li>
            <li>
              <span className="inline-block w-3 h-3 rounded mr-1.5 align-middle bg-[hsl(var(--rgb-hue,0),100%,55%)]" />
              RGB Kit: multiball (x3)
            </li>
            <li>
              <span className="inline-block w-3 h-3 rounded mr-1.5 align-middle bg-amber" />
              Overclock: +40% speed, x2 score
            </li>
            <li>
              <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-1.5 align-middle" />
              Water Leak: avoid!
            </li>
          </ul>
          <button
            onClick={toggleSound}
            className={`mt-3 w-full text-xs font-mono py-1.5 rounded border transition-colors ${
              soundOn
                ? "border-accent text-accent bg-accent/10"
                : "border-surface-border text-foreground/40 hover:text-foreground/60"
            }`}
          >
            {soundOn ? "SOUND ON" : "SOUND OFF"}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded bg-amber/90 text-[#0a0a0f] text-sm font-mono font-bold shadow-lg animate-pulse">
          {toast}
        </div>
      )}
    </div>
  );
}
