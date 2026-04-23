// ─────────────────────────────────────────────
// utils/clickSound.ts
// Lightweight click SFX for UI feedback. Uses expo-audio on native
// and Web Audio API on web. Single shared player, replays on demand.
// No-ops if loading fails.
// ─────────────────────────────────────────────

import { Platform } from "react-native";

const CLICK_ASSET = require("../assets/sounds/click.wav");
const VOLUME = 1.0;
const DEBUG = false;

const log = (...args: unknown[]) => {
  if (DEBUG) console.log("[clickSound]", ...args);
};

// ── Native (system click via local Expo module) ──
// Falls through to a no-op if the module isn't linked (e.g. Expo Go).
let systemClick: { playSystemClick: () => void } | null = null;
try {
  // Lazy require so web bundles don't choke on it.
  systemClick = require("../modules/system-click");
} catch {
  systemClick = null;
}

// ── Web (Web Audio API) ──────────────────────
let webBuffer: AudioBuffer | null = null;
let webCtx: AudioContext | null = null;
let webLoading = false;

function getCtx(): AudioContext | null {
  if (webCtx) return webCtx;
  const Ctor =
    typeof window !== "undefined"
      ? (window as any).AudioContext || (window as any).webkitAudioContext
      : null;
  if (!Ctor) return null;
  try {
    const created: AudioContext = new Ctor();
    webCtx = created;
    return created;
  } catch (e) {
    log("AudioContext create failed", e);
    return null;
  }
}

async function loadWebBuffer(): Promise<void> {
  if (webBuffer || webLoading) return;
  webLoading = true;
  try {
    const ctx = getCtx();
    if (!ctx) return;
    const url =
      typeof CLICK_ASSET === "string"
        ? CLICK_ASSET
        : CLICK_ASSET?.uri ?? CLICK_ASSET?.default ?? null;
    if (!url) {
      log("no asset URL", CLICK_ASSET);
      return;
    }
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    webBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
      // Older Safari needs the callback form.
      try {
        const p = ctx.decodeAudioData(arr, resolve, reject);
        if (p && typeof (p as any).then === "function") {
          (p as Promise<AudioBuffer>).then(resolve, reject);
        }
      } catch (e) {
        reject(e);
      }
    });
    log("web buffer ready");
  } catch (e) {
    log("web load failed", e);
  } finally {
    webLoading = false;
  }
}

// Kick off a non-blocking preload so the first tap isn't silent (web only;
// native uses the OS-level system click via the local Expo module).
if (Platform.OS === "web") {
  loadWebBuffer();
}

export function playClick(): void {
  if (Platform.OS === "web") {
    const ctx = getCtx();
    if (!ctx) return;
    if (!webBuffer) {
      loadWebBuffer();
      return;
    }
    const fire = () => {
      try {
        const src = ctx.createBufferSource();
        src.buffer = webBuffer;
        const gain = ctx.createGain();
        gain.gain.value = VOLUME;
        src.connect(gain).connect(ctx.destination);
        src.start(0);
      } catch (e) {
        log("web play failed", e);
      }
    };
    if (ctx.state === "suspended") {
      ctx.resume().then(fire).catch((e) => log("resume failed", e));
    } else {
      fire();
    }
    return;
  }

  // Native: play the OS click (Android FX_KEY_CLICK / iOS SystemSound 1104).
  try {
    systemClick?.playSystemClick();
  } catch (e) {
    log("native play failed", e);
  }
}
