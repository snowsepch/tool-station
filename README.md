# 夥伴工具站

Apple Shop 通用工具的集散地。不綁定任何門市或通路，所有夥伴自取自用。

- 線上網址：https://snowsepch.github.io/tool-station/
- 本機正本：`iCloud:夥伴工具站/index.html`（單檔 HTML，無 build step）
- Repo：https://github.com/snowsepch/tool-station（public）
- 字型：`fonts/jf-openhuninn-2.1.woff2`（自架，不依賴本機字型）
- 主色：酒紅莓紅 `#8B233D`，僅淺色模式（不做深色模式，已確認）

跟 store-hub（9 門市選擇）、youchang-hub（右昌單店）是第三種平行的入口概念。
門市專屬工具（需帶店名／地址）仍歸那兩個 hub 管，不進這站。

---

## 給夥伴：怎麼用

1. 開站，看到工具卡片牆。每張卡片標了「誰會用到」「大概花多久」。
2. 第一次用某支工具，先點卡片上的 **使用說明**：它解決什麼問題、什麼時候用、
   怎麼操作、常見問題都在裡面。看完可以直接從說明底部開啟工具。
3. 想要專屬版本，點 **個人化**：填暱稱、門市、預設分類等，產生自己的連結。
   連結可以複製、掃 QR code 傳到手機，或用 Safari「加入主畫面」變成捷徑。
4. 設定會記在這台裝置，下次回站卡片會直接變「開啟我的版本」。
5. 用不到的工具可以用右上角 **選擇顯示** 關掉，只影響自己的畫面。

---

## 給維護者：怎麼新增一支工具

**只需要改 `index.html` 裡的 `TOOLS` 陣列，加一筆。**
卡片、使用說明、分組、搜尋、個人化表單、防呆、記住設定、QR code 全部自動長出來，
不用碰下面任何一行渲染邏輯。

### 最小可用（沒有個人化的工具）

```js
{
  id: "campaign-countdown",              // 唯一，也是 localStorage 的 key，取了就別改
  name: "檔期倒數氛圍生成器",
  desc: "一次設定，整個檔期的每日倒數社群圖一次出好。",
  icon: "ph-calendar-dots",              // Phosphor 圖示名稱
  baseUrl: "https://snowsepch.github.io/campaign-countdown/",
  group: "檔期支援",                      // 分組標題，沒填歸「其他工具」
  audience: "社群小編、檔期負責人",         // 顯示在卡片上
  duration: "設定一次約 3 分鐘",
  keywords: ["倒數", "限時", "社群圖"],     // 名稱/說明沒寫到的講法，給搜尋用
  guide: { /* 見下方 */ }
}
```

### guide：使用說明的欄位

**每支工具都該寫。** 沒寫的話 console 會警告，而且夥伴第一次開會不知道怎麼用。

| 欄位 | 必要性 | 內容 |
|---|---|---|
| `summary` | 建議必寫 | 一段話講清楚「這支解決什麼問題」。用夥伴的語言，不要寫功能清單。 |
| `for[]` | 建議必寫 | 什麼時候該打開它。寫具體場景，不要寫「需要時」。 |
| `notFor[]` | 選填 | 這支不做什麼。避免夥伴拿錯工具、期待錯方向。 |
| `steps[]` | 建議必寫 | 操作步驟，一步一句。可用 `<strong>` 標關鍵按鈕名稱（只有這個標籤會生效，其他都會被轉義）。 |
| `tips[]` | 選填 | 小提醒。知道了會少走冤枉路的那種，不是警語。 |
| `faq[]` | 選填 | `{ q, a }` 陣列。用原生 `<details>` 摺疊，預設全收合。 |

沒寫的區塊自動不出現，不會留空標題。

```js
guide: {
  summary: "把整個檔期的倒數圖一次做完，每天發文不用臨時想圖。",
  for: [
    "檔期開跑前，一次把整期的倒數圖備好",
    "要維持整期社群視覺一致，不想每天重配色"
  ],
  notFor: ["做非倒數性質的活動主視覺"],
  steps: [
    "填檔期名稱與結束日期。",
    "選一個強調色，整期會統一用這個顏色。",
    "點 <strong>產生</strong>，從今天到結束日每天一張。",
    "單張下載，或用 <strong>全部下載</strong> 逐張存檔。"
  ],
  tips: ["比例選 4:5 貼 IG 貼文、9:16 貼限動。"],
  faq: [{ q: "檔期改期了怎麼辦？", a: "改結束日期重新產生一次即可。" }]
}
```

### personalize：個人化欄位（選填）

沒有這個欄位的工具，卡片就不會長個人化按鈕，不會出錯。

```js
personalize: {
  subtitle: "modal 的副標",
  constraints: [ /* 見下方 */ ],
  fields: [
    { key: "name", type: "text", shared: true, label: "暱稱（選填）",
      placeholder: "例如：小美", maxlength: 12 },
    { key: "cat", type: "chips", label: "預設分類",
      options: [{ value: "", label: "不指定" }, { value: "mac", label: "Mac" }] },
    { key: "hide", type: "chips-multi", label: "隱藏分類（可多選）",
      options: [{ value: "mac", label: "Mac" }] },
    { key: "model", type: "select", label: "預設機型", emptyLabel: "不指定",
      groups: [{ key: "mac", label: "Mac", options: [{ value: "imac", label: "iMac" }] }] }
  ]
}
```

**欄位型態**

| type | 用途 |
|---|---|
| `text` | 自由輸入，記得給 `maxlength` |
| `chips` | 單選（radio），選項少的時候用 |
| `chips-multi` | 多選（checkbox），送出時用逗號合併成一個參數 |
| `select` | 下拉選單，選項多（如 17 款機型）時用，支援 `groups` 分組 |

**`shared: true`** 的欄位（目前 `name` / `store`）會存進全站共用個人資料，
之後任何新工具只要有同名 `key`，就會自動預填，夥伴不用重填。
所以新工具的暱稱欄位請一律用 `key: "name"`、門市用 `key: "store"`。

**constraints：宣告式防呆**

寫在陣列裡就自動生效，不用自己寫 if。目的是「不讓夥伴產生出無效的連結」，
而不是產生完才報錯。

| type | 效果 |
|---|---|
| `notAll` | 某個多選欄位不可以全選（留最後一個鎖住不給勾） |
| `filterByGroup` | 來源欄位勾到的值，把目標 select 的對應 group 整組鎖住並清空 |
| `filterOptions` | 來源欄位勾到的值，把目標 chips 的同名選項鎖住並退回預設 |

```js
constraints: [
  { type: "notAll", field: "hide", message: "至少要留一個分類。" },
  { type: "filterByGroup", source: "hide", target: "model", message: "已隱藏的分類，其機型不能設為預設。" },
  { type: "filterOptions", source: "hide", target: "cat", message: "已隱藏的分類不能當預設分類。" }
]
```

### 工具端要配合的事

個人化連結是 `baseUrl?key=value` 的形式，**工具本身要自己讀 query string**。
參考新人手冊 `index.html` 的 `initFromQuery()`：

- 非法值一律忽略，不要炸掉頁面
- 會讓工具無法使用的組合（例如把所有分類都隱藏）要有 guard 擋掉
- 建議在工具頁 header 加「← 返回工具站」連回 https://snowsepch.github.io/tool-station/

---

## 自動長出來的行為（不用自己處理）

| 行為 | 觸發條件 |
|---|---|
| 分組標題 | 出現兩種以上 `group` 才顯示。只有一組時就是單純的卡片牆。 |
| 分組順序 | 依 `TOOLS` 陣列裡第一次出現的順序；「其他工具」永遠排最後。 |
| 搜尋框 | 可見工具滿 5 支（`SEARCH_MIN`）才出現。比對名稱、說明、分組、audience、keywords、guide.summary。 |
| 隱藏工具 | 「選擇顯示」開關，存 `toolStationHiddenTools`，只影響這台裝置。 |
| 記住設定 | 存 `toolStationToolPrefs`，卡片變「開啟我的版本」，附清除入口。 |
| 共用個人資料 | 存 `toolStationProfile`，只收 `shared: true` 的欄位。 |
| QR code | 內建自寫編碼器（Byte mode + EC M，版本 1..20），零外部依賴，離線可用。 |
| 設定檔健檢 | 載入時檢查缺欄位、id 重複、key 重複、constraint 指向不存在的欄位、漏寫 guide，直接 `console.warn`。 |

---

## 改完一定要跑的回歸測試

`tests/logic-check.js`，64 項斷言，涵蓋工具站 + 新人手冊 + QR 全鏈。
這個環境拿不到瀏覽器實機截圖（Chrome singleton socket 被系統擋），所以用 jsdom
跑真實 DOM 互動來替代。

```bash
mkdir -p /tmp/tsreg && cd /tmp/tsreg && npm install jsdom
NODE_PATH=/tmp/tsreg/node_modules node ~/Library/Mobile\ Documents/com~apple~CloudDocs/夥伴工具站/tests/logic-check.js
```

`NODE_PATH` 是必要的，node 會從腳本所在位置找 `node_modules` 而不是 cwd。

測試涵蓋：

- **A 系列**：卡片渲染、連結組裝、參數順序、多選合併、防呆限制、複製鈕、隱藏工具
- **N 系列**：記住設定、共用個人資料、沒有 personalize 的工具、HTML 轉義、inert / Esc
- **Q 系列**：QR 編碼器（把畫布像素讀回來獨立解碼，含 RS syndrome 數學檢查）
- **G 系列**：使用說明渲染、分組、搜尋、轉義、登錄表健檢、WCAG 對比
- **B 系列**：新人手冊端接收參數，含非法值與衝突組合的安全降級

加新工具後跑一次，確認 64 項全過再推。

---

## 視覺規範

- 一個主色（酒紅 `#8B233D`）貫穿全站，不要在某個區塊換色
- 圓角一律 18px（卡片）／999px（按鈕，全 pill）／10-13px（小元件），不要混
- 所有文字色都要過 WCAG AA。`--tertiary-ink` 只有 2.96，**只能用在裝飾性圖示**；
  要讀的字用 `--muted-ink`（4.75~4.96）或 `--sub-ink`（5.26+）
- 觸控目標 44px 起
- 動效一律用 `prefers-reduced-motion` 包起來

---

## 更新紀錄

- 2026-07-30 上線，收錄新人快速上手手冊，個人化連結產生器
- 2026-07-31 配色定案酒紅系（同色系微調三輪肉眼無感，最後換色相家族）；
  換 jf open 粉圓體；加「選擇顯示」開關
- 2026-08-05 邏輯稽核 + 宣告式 constraints + 記住設定 + 共用個人資料 + 內建 QR 編碼器
- 2026-08-07 **每支工具的使用說明**（`guide` 欄位驅動的說明 modal）；
  卡片加 audience／duration 快速判斷列；工具變多用的分組與搜尋；
  動作區改固定兩排避免按鈕亂換行；新增 `--muted-ink` 過 AA 的第三階文字色
</content>
</invoke>
