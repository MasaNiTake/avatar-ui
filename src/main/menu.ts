// AUI カスタムメニュー
// AUIメニュー: テーマ・推論強度・言語のradio選択 + 共振checkbox + About
// Edit/View/Window: Electron標準

import { app, Menu, type BrowserWindow, type MenuItemConstructorOptions } from "electron"
import { getSettings, updateSettings, type Theme, type ReasoningEffort } from "../runtime/settings-store.js"
import { setLocale, type Locale } from "../shared/i18n.js"
import * as log from "../logger.js"

/** メニューを構築して適用する */
export function buildAppMenu(getMainWindow: () => BrowserWindow | null): void {
  const settings = getSettings()

  const template: MenuItemConstructorOptions[] = [
    // --- AUI アプリメニュー ---
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        // テーマ
        {
          label: "Theme",
          submenu: [
            {
              label: "Modern",
              type: "radio",
              checked: settings.theme === "modern",
              click: () => onThemeChange("modern", getMainWindow),
            },
            {
              label: "Classic",
              type: "radio",
              checked: settings.theme === "classic",
              click: () => onThemeChange("classic", getMainWindow),
            },
          ],
        },
        // 推論強度（xAI Grok 4.3 の reasoning_effort）
        {
          label: "Reasoning",
          submenu: [
            {
              label: "Off (fastest)",
              type: "radio",
              checked: settings.reasoningEffort === "none",
              click: () => onReasoningChange("none"),
            },
            {
              label: "Low (default)",
              type: "radio",
              checked: settings.reasoningEffort === "low",
              click: () => onReasoningChange("low"),
            },
            {
              label: "Medium",
              type: "radio",
              checked: settings.reasoningEffort === "medium",
              click: () => onReasoningChange("medium"),
            },
            {
              label: "High",
              type: "radio",
              checked: settings.reasoningEffort === "high",
              click: () => onReasoningChange("high"),
            },
          ],
        },
        // 言語
        {
          label: "Language",
          submenu: [
            {
              label: "日本語",
              type: "radio",
              checked: settings.locale === "ja",
              click: () => onLocaleChange("ja", getMainWindow),
            },
            {
              label: "English",
              type: "radio",
              checked: settings.locale === "en",
              click: () => onLocaleChange("en", getMainWindow),
            },
          ],
        },
        // 共振（観測→AI転送→応答生成）
        { type: "separator" },
        {
          label: "Resonance",
          type: "checkbox",
          checked: settings.resonance,
          click: (menuItem) => onResonanceChange(menuItem.checked),
        },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    // --- Edit（標準） ---
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    // --- View（開発用） ---
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { role: "togglefullscreen" },
      ],
    },
    // --- Window（標準） ---
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { role: "close" },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function onThemeChange(theme: Theme, getMainWindow: () => BrowserWindow | null): void {
  updateSettings({ theme })
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send("settings.theme", theme)
  }
  log.info(`[MENU] テーマ変更: ${theme}`)
}

function onResonanceChange(enabled: boolean): void {
  updateSettings({ resonance: enabled })
  log.info(`[MENU] 共振モード変更: ${enabled ? "on" : "off"}`)
}

function onReasoningChange(reasoningEffort: ReasoningEffort): void {
  updateSettings({ reasoningEffort })
  // chain使い捨て方針のため、切替時のリセット処理は不要（次回sendMessageで自然に新規chainが張られる）
  log.info(`[MENU] 推論強度変更: ${reasoningEffort}`)
}

function onLocaleChange(locale: Locale, getMainWindow: () => BrowserWindow | null): void {
  updateSettings({ locale })
  setLocale(locale)
  // メニューのradio状態を更新するために再構築
  buildAppMenu(getMainWindow)
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send("settings.locale", locale)
  }
  log.info(`[MENU] 言語変更: ${locale}`)
}
