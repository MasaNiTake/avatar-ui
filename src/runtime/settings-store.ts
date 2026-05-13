// 設定ストア: ユーザー嗜好の永続化（data/settings.json）
// Mainプロセスが正本。Rendererへの反映はIPC経由。
// デフォルト値はここにハードコード（.envには持たない）

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { Locale } from "../shared/i18n.js"

export type Theme = "modern" | "classic"

// 推論強度（xAI Grok 4.3 の reasoning_effort パラメータ）
// OpenAI SDK 型 ReasoningEffort の部分集合（avatar-ui では minimal/xhigh は採用しない）
export const REASONING_EFFORTS = ["none", "low", "medium", "high"] as const
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number]

export type Settings = {
  theme: Theme
  locale: Locale
  resonance: boolean
  reasoningEffort: ReasoningEffort
}

// デフォルト設定（ハードコード。.envからは取らない）
const DEFAULT_REASONING_EFFORT: ReasoningEffort = "low"

const DEFAULTS: Settings = {
  theme: "modern",
  locale: "ja",
  resonance: false,
  reasoningEffort: DEFAULT_REASONING_EFFORT,
}

// 旧モデルIDからreasoning_effortへのマイグレーション表
// 2026-05-15に廃止された grok-4-1-fast-* および誤って書かれた grok-4-3-fast-* を救済
const LEGACY_MODEL_TO_EFFORT: Record<string, ReasoningEffort> = {
  "grok-4-1-fast-non-reasoning": "none",
  "grok-4-fast-non-reasoning": "none",
  "grok-4-3-fast-non-reasoning": "none",
  "grok-4-1-fast-reasoning": "low",
  "grok-4-fast-reasoning": "low",
  "grok-4-3-fast-reasoning": "low",
}

function isValidReasoningEffort(v: unknown): v is ReasoningEffort {
  return typeof v === "string" && REASONING_EFFORTS.includes(v as ReasoningEffort)
}

function isValidLocale(v: unknown): v is Locale {
  return v === "ja" || v === "en"
}

let settings: Settings | null = null
let settingsPath: string

/** 起動時に1回呼ぶ。dataDir = "data" 等 */
export function loadSettings(dataDir: string): Settings {
  settingsPath = join(dataDir, "settings.json")

  let raw: string
  try {
    raw = readFileSync(settingsPath, "utf-8")
  } catch (err: unknown) {
    // ファイル未存在は正常（初回起動）、それ以外はfail-fast
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      settings = { ...DEFAULTS }
      return settings
    }
    throw err
  }

  const parsed = JSON.parse(raw) as Partial<Settings> & { model?: unknown }

  // reasoningEffort の解決順
  //   1. parsed.reasoningEffort が有効ならそれを採用
  //   2. parsed.reasoningEffort 無効 → fail-fast
  //   3. parsed.reasoningEffort 未設定かつ旧 model が既知 → マップ
  //   4. parsed.reasoningEffort 未設定かつ未知 model → fail-fast
  //   5. どちらも無い → DEFAULTS（壊れた settings.json の補完）
  let reasoningEffort: ReasoningEffort
  if (parsed.reasoningEffort !== undefined) {
    if (!isValidReasoningEffort(parsed.reasoningEffort)) {
      throw new Error(
        `settings-store: 無効な reasoningEffort: ${JSON.stringify(parsed.reasoningEffort)}`,
      )
    }
    reasoningEffort = parsed.reasoningEffort
  } else if (typeof parsed.model === "string") {
    const mapped = LEGACY_MODEL_TO_EFFORT[parsed.model]
    if (mapped === undefined) {
      throw new Error(`settings-store: 未知の旧 model 値: ${parsed.model}`)
    }
    reasoningEffort = mapped
  } else {
    reasoningEffort = DEFAULTS.reasoningEffort
  }

  settings = {
    theme: parsed.theme === "classic" ? "classic" : DEFAULTS.theme,
    locale: isValidLocale(parsed.locale) ? parsed.locale : DEFAULTS.locale,
    resonance: typeof parsed.resonance === "boolean" ? parsed.resonance : DEFAULTS.resonance,
    reasoningEffort,
  }

  // 旧 model フィールド削除 / reasoningEffort 補完が必要な場合のみ書き戻し（冪等）
  if (parsed.model !== undefined || parsed.reasoningEffort === undefined) {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  }
  return settings
}

export function getSettings(): Settings {
  if (!settings) throw new Error("settings-store: loadSettings() が未呼び出し")
  return settings
}

export function updateSettings(partial: Partial<Settings>): Settings {
  if (!settings) throw new Error("settings-store: loadSettings() が未呼び出し")
  settings = { ...settings, ...partial }
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  return settings
}
