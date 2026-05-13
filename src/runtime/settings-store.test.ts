import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { loadSettings } from "./settings-store.js"

let dataDir: string

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "settings-store-test-"))
})

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true })
})

function writeSettings(content: unknown): void {
  writeFileSync(join(dataDir, "settings.json"), JSON.stringify(content))
}

function readSettings(): unknown {
  return JSON.parse(readFileSync(join(dataDir, "settings.json"), "utf-8"))
}

describe("loadSettings: マイグレーション", () => {
  it("旧 reasoning 系 model は reasoningEffort=low に移行され model が削除される", () => {
    writeSettings({ theme: "modern", model: "grok-4-1-fast-reasoning", locale: "ja", resonance: false })

    const settings = loadSettings(dataDir)

    expect(settings.reasoningEffort).toBe("low")
    expect(settings).not.toHaveProperty("model")
    expect(readSettings()).toEqual({
      theme: "modern",
      locale: "ja",
      resonance: false,
      reasoningEffort: "low",
    })
  })

  it("旧 non-reasoning 系 model は reasoningEffort=none に移行される", () => {
    writeSettings({ theme: "classic", model: "grok-4-1-fast-non-reasoning", locale: "en", resonance: true })

    const settings = loadSettings(dataDir)

    expect(settings.reasoningEffort).toBe("none")
    expect(settings.theme).toBe("classic")
    expect(settings.locale).toBe("en")
    expect(settings.resonance).toBe(true)
    expect(readSettings()).not.toHaveProperty("model")
  })

  it("reasoningEffort 既存値は旧 model より優先される（model だけ削除書き戻し）", () => {
    writeSettings({
      theme: "modern",
      model: "grok-4-1-fast-non-reasoning",
      reasoningEffort: "high",
      locale: "ja",
      resonance: false,
    })

    const settings = loadSettings(dataDir)

    expect(settings.reasoningEffort).toBe("high")
    const written = readSettings() as Record<string, unknown>
    expect(written).not.toHaveProperty("model")
    expect(written.reasoningEffort).toBe("high")
  })

  it("未知の model のみ・reasoningEffort 不存在は fail-fast", () => {
    writeSettings({ theme: "modern", model: "grok-x-unknown", locale: "ja", resonance: false })

    expect(() => loadSettings(dataDir)).toThrow(/未知の旧 model/)
  })

  it("無効な reasoningEffort は fail-fast", () => {
    writeSettings({ theme: "modern", reasoningEffort: "extreme", locale: "ja", resonance: false })

    expect(() => loadSettings(dataDir)).toThrow(/無効な reasoningEffort/)
  })
})
