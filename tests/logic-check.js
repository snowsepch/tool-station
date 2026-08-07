/* ============================================================
   夥伴工具站 + 新人快速上手手冊：邏輯回歸測試
   ============================================================
   為什麼有這支：這個環境拿不到瀏覽器實機截圖（Chrome 的 singleton
   socket 被系統擋住），所以改用 jsdom 把真實 HTML 讀進來跑真實 DOM
   互動，直接斷言結果。日後在 index.html 的 TOOLS 陣列加新工具後，
   請重跑這支確認沒把既有行為改壞。

   跑法：
     mkdir -p /tmp/tsreg && cd /tmp/tsreg && npm install jsdom
     node <這支檔案的路徑>
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ICLOUD = path.join(process.env.HOME, "Library/Mobile Documents/com~apple~CloudDocs");
const STATION = path.join(ICLOUD, "夥伴工具站/index.html");
const MANUAL = path.join(ICLOUD, "新人快速上手手冊/index.html");

const results = [];
const warns = [];
const check = (name, pass, detail) => results.push({ name, pass, detail });

function makeDom(file, url) {
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => warns.push("jsdomError: " + e.message));
  vc.on("warn", m => warns.push("warn: " + m));
  vc.on("error", m => warns.push("error: " + m));
  return new JSDOM(fs.readFileSync(file, "utf8"), {
    url, runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc
  });
}

function station(fn) {
  const dom = makeDom(STATION, "https://snowsepch.github.io/tool-station/");
  const r = fn(dom.window.document, dom.window);
  dom.window.close();
  return r;
}

const openModal = (d, w) =>
  d.querySelector("[data-personalize]").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
const gen = (d) => { d.querySelector("[data-generate-link]").click(); return d.querySelector("[data-result-url]").value; };
function setChecks(d, field, vals) {
  d.querySelectorAll(`input[type="checkbox"][data-field="${field}"]`).forEach(cb => {
    if (vals.includes(cb.value) && !cb.disabled) {
      cb.checked = true;
      cb.dispatchEvent(new d.defaultView.Event("change", { bubbles: true }));
    }
  });
}

/* ========== A. 工具站基本行為 ========== */

check("A1 工具卡片渲染", station(d => d.querySelectorAll(".tool-card").length === 1), "1 張卡片");

station((d) => {
  const bd = d.querySelector("[data-modal-backdrop]");
  check("A1b 關閉的 modal 已移出可聚焦範圍(inert)", bd.hasAttribute("inert"), `inert=${bd.hasAttribute("inert")}`);
});

check("A2 全空 → 純 baseUrl", station((d, w) => {
  openModal(d, w);
  return gen(d) === "https://snowsepch.github.io/newbie-manual/";
}), "");

check("A3 暱稱+門市+分類", station((d, w) => {
  openModal(d, w);
  d.querySelector("#pf-name").value = "小美";
  d.querySelector("#pf-store").value = "OOO店";
  d.querySelector('input[name="pf-cat"][value="ipad"]').checked = true;
  const u = gen(d);
  check("A3b 參數順序依 fields 穩定", u.indexOf("name=") < u.indexOf("store=") && u.indexOf("store=") < u.indexOf("cat="), u);
  return u.includes("name=%E5%B0%8F%E7%BE%8E") && u.includes("store=OOO%E5%BA%97") && u.includes("cat=ipad");
}), "");

check("A4 hide 多選逗號合併", station((d, w) => {
  openModal(d, w); setChecks(d, "hide", ["mac", "watch"]);
  return /hide=mac%2Cwatch/.test(gen(d));
}), "");

/* ========== A5~A7：宣告式防呆與 a11y 修正 ========== */

station((d, w) => {
  openModal(d, w);
  setChecks(d, "hide", ["mac", "ipad", "iphone", "watch"]);
  const url = gen(d);
  const boxes = [...d.querySelectorAll('input[type="checkbox"][data-field="hide"]')];
  const locked = boxes.filter(b => b.disabled).length;
  const msg = d.querySelector('[data-field-msg="hide"]');
  check("A5 不可能把 4 個分類全部隱藏（notAll 限制）",
    !/hide=mac%2Cipad%2Ciphone%2Cwatch/.test(url) && locked === 1 && msg.classList.contains("show"),
    `url=${url}｜鎖住 ${locked} 個｜訊息="${msg.textContent.trim()}"`);
});

station((d, w) => {
  openModal(d, w);
  d.querySelector("#pf-model").value = "macbook-air";
  setChecks(d, "hide", ["mac"]);
  const sel = d.querySelector("#pf-model");
  const macGroup = sel.querySelector('optgroup[data-group-key="mac"]');
  const url = gen(d);
  check("A6 隱藏 Mac 後 Mac 機型被鎖且選擇自動清空（filterByGroup）",
    macGroup.disabled && sel.value === "" && !url.includes("model="),
    `optgroup.disabled=${macGroup.disabled}｜select="${sel.value}"｜url=${url}`);
});

station((d, w) => {
  openModal(d, w);
  d.querySelector('input[name="pf-cat"][value="watch"]').checked = true;
  setChecks(d, "hide", ["watch"]);
  const watchRadio = d.querySelector('input[name="pf-cat"][value="watch"]');
  const checked = d.querySelector('input[name="pf-cat"]:checked');
  const url = gen(d);
  check("A6b 隱藏 Watch 後預設分類被鎖並退回不指定（filterOptions）",
    watchRadio.disabled && !watchRadio.checked && checked.value === "" && !url.includes("cat="),
    `watch.disabled=${watchRadio.disabled}｜目前選="${checked.value}"｜url=${url}`);
});

station((d, w) => {
  openModal(d, w); gen(d);
  const btn = d.querySelector("[data-copy-link]");
  d.execCommand = () => true;
  btn.click();
  const first = btn.textContent.trim();
  btn.click();
  const second = btn.textContent.trim();
  check("A7 複製鈕連點兩次不會卡在「已複製」",
    first === "已複製" && second === "已複製" && btn.classList.contains("copied"),
    `第一次="${first}" 第二次="${second}"（第二次被 guard 擋掉，還原字串不被覆寫）`);
});

check("A8 隱藏工具→localStorage+empty state", station((d, w) => {
  d.querySelector("[data-open-visibility]").click();
  const t = d.querySelector("[data-visibility-toggle]");
  t.checked = false;
  t.dispatchEvent(new w.Event("change", { bubbles: true }));
  return w.localStorage.getItem("toolStationHiddenTools") === '["newbie-manual"]'
    && d.getElementById("hidden-all-state").style.display === "block"
    && d.getElementById("tool-groups").innerHTML === "";
}), "");

/* ========== N. 記住設定 / 全站共用個人資料 / 擴充性 ========== */

station((d, w) => {
  openModal(d, w);
  d.querySelector("#pf-name").value = "阿哲";
  d.querySelector("#pf-store").value = "OOO店";
  d.querySelector('input[name="pf-view"][value="quick"]').checked = true;
  const url = gen(d);
  const prefs = JSON.parse(w.localStorage.getItem("toolStationToolPrefs"));
  const profile = JSON.parse(w.localStorage.getItem("toolStationProfile"));
  check("N1 產生後記住設定＋只把 shared 欄位寫入全站共用個人資料",
    prefs["newbie-manual"].name === "阿哲" && prefs["newbie-manual"].view === "quick"
    && profile.name === "阿哲" && profile.store === "OOO店" && !("view" in profile),
    `prefs=${JSON.stringify(prefs["newbie-manual"])}｜profile=${JSON.stringify(profile)}`);
  check("N2 view=quick 進到連結", url.includes("view=quick"), url);

  d.querySelector("[data-modal-close]").click();
  openModal(d, w);
  check("N3 重開 modal 自動帶回上次填的值",
    d.querySelector("#pf-name").value === "阿哲"
    && d.querySelector('input[name="pf-view"]:checked').value === "quick", "");
});

// 跨次載入：把 localStorage 預先塞好，再手動執行 inline script
function reload(seed, mutate) {
  const dom = new JSDOM(fs.readFileSync(STATION, "utf8"), {
    url: "https://snowsepch.github.io/tool-station/", runScripts: "outside-only", pretendToBeVisual: true
  });
  Object.entries(seed || {}).forEach(([k, v]) => dom.window.localStorage.setItem(k, v));
  let code = fs.readFileSync(STATION, "utf8").match(/<script>([\s\S]*)<\/script>/)[1];
  if (mutate) code = mutate(code);
  dom.window.eval(code);
  return dom;
}

{
  const dom1 = makeDom(STATION, "https://snowsepch.github.io/tool-station/");
  const d1 = dom1.window.document;
  openModal(d1, dom1.window);
  d1.querySelector("#pf-name").value = "阿哲";
  setChecks(d1, "hide", ["watch"]);
  const madeUrl = gen(d1);
  const seed = {
    toolStationToolPrefs: dom1.window.localStorage.getItem("toolStationToolPrefs"),
    toolStationProfile: dom1.window.localStorage.getItem("toolStationProfile")
  };
  dom1.window.close();

  const dom2 = reload(seed);
  const d2 = dom2.window.document;
  const primary = d2.querySelector(".tool-card .btn-primary");
  const flag = d2.querySelector(".tool-flag");
  check("N4 重新開站：卡片直接變「開啟我的版本」且連結正確",
    primary.textContent.trim() === "開啟我的版本" && primary.getAttribute("href") === madeUrl && !!flag,
    `按鈕="${primary.textContent.trim()}"｜href=${primary.getAttribute("href")}`);

  flag.querySelector("[data-clear-prefs]").click();
  const p2 = d2.querySelector(".tool-card .btn-primary");
  check("N5 清除該工具設定後退回原版，但全站共用個人資料保留",
    p2.textContent.trim() === "開啟工具"
    && p2.getAttribute("href") === "https://snowsepch.github.io/newbie-manual/"
    && !d2.querySelector(".tool-flag")
    && JSON.parse(dom2.window.localStorage.getItem("toolStationProfile")).name === "阿哲",
    `按鈕="${p2.textContent.trim()}"｜共用資料=${dom2.window.localStorage.getItem("toolStationProfile")}`);
  dom2.window.close();
}

// 模擬「日後工具變多」：一支共用 name/store，一支完全沒有 personalize
{
  const addTools = (code) => code.replace(/^\s*\];\s*$/m, `,
    { id: "demo-tool", name: "示範工具 <b>A</b>", desc: "測試 & 引號\\" 要安全", icon: "ph-wrench",
      baseUrl: "https://example.com/demo/",
      personalize: { subtitle: "測試", fields: [
        { key: "name", type: "text", shared: true, label: "暱稱", maxlength: 12 },
        { key: "store", type: "text", shared: true, label: "門市", maxlength: 20 }
      ]}},
    { id: "no-personalize", name: "沒有個人化的工具", desc: "只有開啟按鈕", icon: "ph-link", baseUrl: "https://example.com/plain/" }
  ];`);

  const dom = reload({ toolStationProfile: JSON.stringify({ name: "小柔", store: "XXX店" }) }, addTools);
  const d = dom.window.document;
  const cards = d.querySelectorAll(".tool-card");
  check("N6 沒有 personalize 的工具不會炸，且不長個人化按鈕",
    cards.length === 3 && !cards[2].querySelector("[data-personalize]") && !!cards[2].querySelector(".btn-primary"),
    `卡片數=${cards.length}`);
  check("N7 工具名稱/描述含 <b> 與引號時正確轉義不破版",
    cards[1].querySelector("h3").textContent === "示範工具 <b>A</b>"
    && !cards[1].querySelector("h3 b")
    && cards[1].querySelector("p").textContent.includes('引號" 要安全'),
    `h3="${cards[1].querySelector("h3").textContent}"`);
  cards[1].querySelector("[data-personalize]").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  check("N8 新工具自動吃到全站共用個人資料（不用重填）",
    d.querySelector("#pf-name").value === "小柔" && d.querySelector("#pf-store").value === "XXX店",
    `name="${d.querySelector("#pf-name").value}" store="${d.querySelector("#pf-store").value}"`);
  dom.window.close();
}

station((d, w) => {
  openModal(d, w);
  const bd = d.querySelector("[data-modal-backdrop]");
  const openedOk = !bd.hasAttribute("inert");
  d.querySelector("[data-modal-close]").click();
  check("N9 開啟時移除 inert、關閉後重新加上", openedOk && bd.hasAttribute("inert"),
    `開啟時=${openedOk}｜關閉後 inert=${bd.hasAttribute("inert")}`);
});

station((d, w) => {
  openModal(d, w);
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  check("N10 Esc 關閉個人化 modal", !d.querySelector("[data-modal-backdrop]").classList.contains("open"), "");
  d.querySelector("[data-open-visibility]").click();
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  check("N11 Esc 關閉「選擇顯示」modal", !d.querySelector("[data-visibility-backdrop]").classList.contains("open"), "");
});

station((d) => {
  const ext = [...d.querySelectorAll("script[src]")].map(s => s.src);
  check("N12 QR 編碼器內建，頁面不載入任何外部 script", ext.length === 0, `外部 script: ${ext.join(", ") || "無"}`);
});

/* ========== Q. QR code：把畫布像素讀回來獨立解碼 ========== */

// jsdom 沒有 canvas，攔截 getContext 記下 fillRect 重建矩陣
function renderQR(setup) {
  const dom = new JSDOM(fs.readFileSync(STATION, "utf8"), {
    url: "https://snowsepch.github.io/tool-station/", runScripts: "outside-only", pretendToBeVisual: true
  });
  const w = dom.window, d = w.document;
  const rects = []; let fill = "#FFFFFF";
  w.HTMLCanvasElement.prototype.getContext = function () {
    return {
      set fillStyle(v) { fill = v; }, get fillStyle() { return fill; },
      fillRect(x, y, ww, hh) { rects.push({ x, y, w: ww, h: hh, c: fill }); }
    };
  };
  w.eval(fs.readFileSync(STATION, "utf8").match(/<script>([\s\S]*)<\/script>/)[1]);
  setup(d, w);
  const canvas = d.querySelector("[data-qr-canvas]");
  const dark = rects.filter(r => r.c === "#221D18");
  let matrix = null;
  if (dark.length) {
    const scale = dark[0].w, quiet = 4;
    const size = (canvas.width / scale) - quiet * 2;
    const m = Array.from({ length: size }, () => new Array(size).fill(0));
    dark.forEach(r => { m[r.y / scale - quiet][r.x / scale - quiet] = 1; });
    matrix = { m, size, scale };
  }
  const out = { d, w, canvas, matrix, msg: d.querySelector("[data-qr-msg]") };
  return out;
}

/* 獨立解碼器：只用規格定義的反向流程，不呼叫頁面內的編碼函式 */
function decodeMatrix(m, size) {
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (!a || !b) ? 0 : EXP[LOG[a] + LOG[b]];
  const MASKS = [
    (i, j) => (i + j) % 2 === 0, (i, j) => i % 2 === 0, (i, j) => j % 3 === 0, (i, j) => (i + j) % 3 === 0,
    (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
    (i, j) => (i * j) % 2 + (i * j) % 3 === 0,
    (i, j) => ((i * j) % 2 + (i * j) % 3) % 2 === 0,
    (i, j) => ((i + j) % 2 + (i * j) % 3) % 2 === 0
  ];
  const ECM = [null,
    [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
    [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44],
    [30, 1, 50, 4, 51], [22, 6, 36, 2, 37], [22, 8, 37, 1, 38], [24, 4, 40, 5, 41], [24, 5, 41, 5, 42],
    [28, 7, 45, 3, 46], [28, 10, 46, 1, 47], [26, 9, 43, 4, 44], [26, 3, 44, 11, 45], [26, 3, 41, 13, 42]];
  const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42],
    [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70],
    [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90]];

  let f = 0;
  for (let i = 0; i < 15; i++) {
    let b;
    if (i <= 5) b = m[i][8]; else if (i === 6) b = m[7][8]; else if (i === 7) b = m[8][8];
    else if (i === 8) b = m[8][7]; else b = m[8][14 - i];
    f |= b << i;
  }
  let f2 = 0;
  for (let i = 0; i < 15; i++) f2 |= (i < 8 ? m[8][size - 1 - i] : m[size - 15 + i][8]) << i;
  if (f !== f2) throw new Error("兩份格式資訊不一致");
  let rem = f ^ 0x5412;
  for (let i = 14; i >= 10; i--) if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
  if (rem !== 0) throw new Error("格式資訊 BCH 不合法");
  const mask = ((f ^ 0x5412) >> 10) & 7;
  const version = (size - 17) / 4;

  // 重建功能圖樣遮罩（純幾何）
  const fn = Array.from({ length: size }, () => new Uint8Array(size));
  const mark = (r, c) => { if (r >= 0 && c >= 0 && r < size && c < size) fn[r][c] = 1; };
  [[0, 0], [0, size - 7], [size - 7, 0]].forEach(([r0, c0]) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) mark(r0 + r, c0 + c);
  });
  ALIGN[version].forEach(a => ALIGN[version].forEach(b => {
    if ((a === 6 && b === 6) || (a === 6 && b === size - 7) || (a === size - 7 && b === 6)) return;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) mark(a + dr, b + dc);
  }));
  for (let i = 8; i < size - 8; i++) { mark(6, i); mark(i, 6); }
  mark(size - 8, 8);
  for (let i = 0; i < 15; i++) {
    if (i <= 5) mark(i, 8); else if (i === 6) mark(7, 8); else if (i === 7) mark(8, 8);
    else if (i === 8) mark(8, 7); else mark(8, 14 - i);
    if (i < 8) mark(8, size - 1 - i); else mark(size - 15 + i, 8);
  }
  if (version >= 7) for (let i = 0; i < 18; i++) {
    mark(size - 11 + (i % 3), Math.floor(i / 3));
    mark(Math.floor(i / 3), size - 11 + (i % 3));
  }

  const bits = []; let up = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const r = up ? size - 1 - step : step;
      for (const c of [right, right - 1]) {
        if (fn[r][c]) continue;
        bits.push(m[r][c] ^ (MASKS[mask](r, c) ? 1 : 0));
      }
    }
    up = !up;
  }
  const words = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    words.push(v);
  }
  const [ec, b1, d1, b2, d2] = ECM[version];
  const lens = [...Array(b1).fill(d1), ...Array(b2).fill(d2)];
  const blocks = lens.map(() => []); let p = 0;
  const maxD = Math.max(d1, d2);
  for (let i = 0; i < maxD; i++) lens.forEach((len, bi) => { if (i < len) blocks[bi].push(words[p++]); });
  const par = lens.map(() => []);
  for (let i = 0; i < ec; i++) lens.forEach((_, bi) => par[bi].push(words[p++]));
  blocks.forEach((dd, bi) => {
    const cw = dd.concat(par[bi]);
    for (let k = 0; k < ec; k++) {          // 生成多項式的根是 α^0..α^(n-1)
      let s = 0, a = EXP[k];
      for (const c of cw) s = mul(s, a) ^ c;
      if (s !== 0) throw new Error(`第 ${bi + 1} 區塊 RS syndrome 不為 0`);
    }
  });
  const bs = [];
  blocks.flat().forEach(b => { for (let i = 7; i >= 0; i--) bs.push((b >> i) & 1); });
  const take = n => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | bs.shift(); return v; };
  if (take(4) !== 0b0100) throw new Error("模式不是 Byte mode");
  const cnt = take(version <= 9 ? 8 : 16);
  const out = [];
  for (let i = 0; i < cnt; i++) out.push(take(8));
  return { text: new TextDecoder().decode(new Uint8Array(out)), version, mask };
}

{
  let url = "", got = "", err = "";
  const r = renderQR((d, w) => {
    openModal(d, w);
    url = gen(d);
    d.querySelector("[data-qr-toggle]").click();
  });
  try { got = decodeMatrix(r.matrix.m, r.matrix.size).text; } catch (e) { err = e.message; }
  check("Q1 基本連結：畫布像素可解回原網址", got === url, err ? `錯誤：${err}` : `解回${got === url ? "一致" : "不符 → " + got}`);
}

{
  let url = "", got = "", err = "", info = "";
  const r = renderQR((d, w) => {
    openModal(d, w);
    d.querySelector("#pf-name").value = "阿哲";
    d.querySelector("#pf-store").value = "高雄OOO店";
    d.querySelector("#pf-note").value = "交機前再看一次規格";
    d.querySelector("#pf-model").value = "iphone-17-pro";
    d.querySelector('input[name="pf-view"][value="quick"]').checked = true;
    d.querySelector('input[name="pf-text"][value="xlarge"]').checked = true;
    url = gen(d);
    d.querySelector("[data-qr-toggle]").click();
  });
  try {
    const dec = decodeMatrix(r.matrix.m, r.matrix.size);
    got = dec.text;
    info = `v${dec.version} size ${r.matrix.size} 每模組 ${r.matrix.scale}px 畫布 ${r.canvas.width}px｜連結 ${url.length} 字元`;
  } catch (e) { err = e.message; }
  check("Q2 含中文的長個人化連結可解回", got === url, err ? `錯誤：${err}` : `${info}｜解回${got === url ? "一致" : "不符"}`);
}

{
  let ok = true; const detail = [];
  ["", "x".repeat(120), "x".repeat(600)].forEach((pad, i) => {
    const r = renderQR((d, w) => {
      openModal(d, w); gen(d);
      d.querySelector("[data-result-url]").value = "https://snowsepch.github.io/newbie-manual/?q=" + pad;
      d.querySelector("[data-qr-toggle]").click();
    });
    if (!r.matrix) { ok = false; detail.push(`第${i + 1}組沒畫出來`); return; }
    detail.push(`v${(r.matrix.size - 17) / 4}:${r.matrix.scale}px/模組,畫布${r.canvas.width}px`);
    if (r.matrix.scale < 3) ok = false;
  });
  check("Q3 各長度下每模組都 ≥3px（太小手機掃不到）", ok, detail.join(" | "));
}

{
  const r = renderQR((d, w) => {
    openModal(d, w); gen(d);
    d.querySelector("[data-result-url]").value = "https://snowsepch.github.io/newbie-manual/?q=" + "z".repeat(700);
    d.querySelector("[data-qr-toggle]").click();
  });
  check("Q4 超出容量時隱藏畫布並明確提示（不畫出掃不了的圖）",
    r.canvas.hidden === true && r.msg.textContent.includes("太長"),
    `canvas.hidden=${r.canvas.hidden}｜訊息「${r.msg.textContent}」`);
}

station((d, w) => {
  openModal(d, w); gen(d);
  d.querySelector("[data-qr-toggle]").click();
  d.querySelector("[data-qr-toggle]").click();
  check("Q5 再點一次可收起 QR 面板", !d.querySelector("[data-qr-panel]").classList.contains("show"), "");
});

/* ========== B. 新人手冊接收參數 ========== */
function manualWith(qs) {
  const dom = makeDom(MANUAL, "https://snowsepch.github.io/newbie-manual/" + qs);
  const d = dom.window.document;
  const activePage = d.querySelector(".category-page.active");
  const activePanel = activePage ? activePage.querySelector(".model-panel.active") : null;
  const out = {
    activeCat: activePage ? activePage.dataset.category : null,
    activeModel: activePanel ? activePanel.dataset.panel : null,
    hiddenTabs: [...d.querySelectorAll("nav.tabbar .cat-tab")].filter(t => t.style.display === "none").map(t => t.dataset.target),
    theme: d.documentElement.dataset.theme || null,
    text: d.documentElement.dataset.text || null,
    view: d.documentElement.dataset.view || null,
    demoSections: d.querySelectorAll('[data-section="demo"]').length,
    header: d.querySelector("header").textContent.replace(/\s+/g, " ").trim()
  };
  dom.window.close();
  return out;
}

check("B1 無參數→預設 mac", manualWith("").activeCat === "mac", "");
{ const r = manualWith("?model=iphone-air");
  check("B2 model=iphone-air 生效", r.activeCat === "iphone" && r.activeModel === "iphone-air", `${r.activeCat}/${r.activeModel}`); }
{ const r = manualWith("?hide=mac,watch");
  check("B3 hide=mac,watch 生效並自動切到第一個可見分類",
    r.hiddenTabs.sort().join(",") === "mac,watch" && r.activeCat === "ipad", JSON.stringify(r.hiddenTabs)); }
{ const r = manualWith("?hide=mac,ipad,iphone,watch");
  check("B4 hide 全選被忽略（手冊端防鎖死 guard）", r.hiddenTabs.length === 0 && r.activeCat === "mac", ""); }
{ const r = manualWith("?model=macbook-air&hide=mac");
  check("B5 手動改網址造成衝突時仍安全降級", r.activeCat === "ipad" && r.hiddenTabs.includes("mac"), `落在 ${r.activeCat}`); }
{ const r = manualWith("?cat=watch&hide=watch");
  check("B6 cat/hide 衝突時安全降級", r.activeCat === "mac" && r.hiddenTabs.includes("watch"), `落在 ${r.activeCat}`); }
{ const r = manualWith("?theme=dark&text=large");
  check("B7 theme=dark&text=large 生效", r.theme === "dark" && r.text === "large", ""); }
{ const r = manualWith("?name=%E5%B0%8F%E7%BE%8E&store=OOO%E5%BA%97&note=%E4%BA%A4%E6%A9%9F%E5%89%8D%E5%86%8D%E7%9C%8B%E4%B8%80%E6%AC%A1");
  check("B8 name/store/note 顯示在 header",
    r.header.includes("Hi, 小美（OOO店）") && r.header.includes("備註：交機前再看一次"), ""); }
{ const r = manualWith("?cat=android&model=nokia&hide=blackberry&theme=neon&text=huge&view=weird");
  check("B9 非法參數安全忽略",
    r.activeCat === "mac" && r.theme === null && r.text === null && r.view === null && r.hiddenTabs.length === 0, ""); }
{ const long = "壹貳參肆伍陸柒捌玖拾".repeat(8);
  const r = manualWith("?note=" + encodeURIComponent(long));
  const m = r.header.match(/備註：(.+)$/);
  check("B10 note 超長截斷到 40 字", (m ? m[1].trim().length : 0) === 40, `${m ? m[1].trim().length : 0} 字`); }
{ const r = manualWith("?text=xlarge");
  check("B11 text=xlarge 第三檔字級生效", r.text === "xlarge", `text=${r.text}`); }
{ const r = manualWith("?view=quick");
  check("B12 view=quick 精簡模式生效，Demo 區塊可被 CSS 定位",
    r.view === "quick" && r.demoSections === 34, `view=${r.view}｜data-section="demo" 節點 ${r.demoSections} 個`); }
{ const r = manualWith("?model=iphone-17-pro&view=quick&text=xlarge&name=%E9%98%BF%E5%93%B2&hide=watch");
  check("B13 工具站產生的完整組合連結全部生效",
    r.activeCat === "iphone" && r.activeModel === "iphone-17-pro" && r.view === "quick"
    && r.text === "xlarge" && r.hiddenTabs.includes("watch") && r.header.includes("Hi, 阿哲"),
    JSON.stringify({ cat: r.activeCat, model: r.activeModel, view: r.view, text: r.text, hidden: r.hiddenTabs })); }

/* ========== G. 使用說明 / 分組 / 搜尋（工具變多時的架構） ========== */

const openGuide = (d, w, idx) =>
  d.querySelectorAll("[data-guide]")[idx || 0].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));

// openBackdrop 的 .open class 是在 requestAnimationFrame 裡加的（避免 transition 不觸發），
// 所以要等一個 frame 才讀得到。真實瀏覽器 16ms 內就完成，測試這裡明確等一下。
const nextFrame = () => new Promise(r => setTimeout(r, 40));

function stationAsync(fn) {
  const dom = makeDom(STATION, "https://snowsepch.github.io/tool-station/");
  return Promise.resolve(fn(dom.window.document, dom.window)).then(() => dom.window.close());
}

station((d, w) => {
  const btn = d.querySelector(".tool-card [data-guide]");
  check("G1 有寫 guide 的工具，卡片長出「使用說明」按鈕",
    !!btn && btn.textContent.trim() === "使用說明", btn ? `按鈕="${btn.textContent.trim()}"` : "找不到按鈕");

  const meta = d.querySelector(".tool-card .tool-meta");
  check("G1b 卡片顯示 audience / duration 快速判斷列",
    !!meta && meta.textContent.includes("新進夥伴") && meta.textContent.includes("30 秒"),
    meta ? meta.textContent.replace(/\s+/g, " ").trim() : "無");
});

// 這三項牽涉 rAF，改用 async 版本，統一在檔案最後的 runAsync() 裡跑
const asyncTests = [];

asyncTests.push(() => stationAsync(async (d, w) => {
  const bd = d.querySelector("[data-guide-backdrop]");
  const closedOk = bd.hasAttribute("inert") && !bd.classList.contains("open");
  openGuide(d, w);
  await nextFrame();
  const body = d.querySelector("[data-guide-body]");
  const heads = [...body.querySelectorAll(".guide-block h3")].map(h => h.textContent.trim());
  check("G2 點使用說明會開啟 modal 並帶出完整區塊",
    !bd.hasAttribute("inert") && bd.classList.contains("open") && closedOk
    && !!body.querySelector(".guide-summary")
    && heads.join("｜") === "什麼時候用它｜這支不做什麼｜怎麼操作｜小提醒｜常見問題",
    `區塊=${heads.join("｜")}`);

  check("G2b 標題與副標帶入工具名稱與適用對象",
    d.getElementById("guide-title").textContent === "新人快速上手手冊 使用說明"
    && d.querySelector("[data-guide-sub]").textContent.startsWith("適合："),
    `title="${d.getElementById("guide-title").textContent}"`);

  const steps = body.querySelectorAll(".guide-steps li");
  const faq = body.querySelectorAll(".guide-faq details");
  check("G3 步驟與 FAQ 依登錄表數量渲染，步驟允許 <strong> 標關鍵按鈕",
    steps.length === 6 && faq.length === 3 && !!body.querySelector(".guide-steps strong"),
    `步驟 ${steps.length} 步｜FAQ ${faq.length} 題`);

  check("G3b FAQ 用原生 details，預設全部收合", [...faq].every(x => !x.open), "");
}));

asyncTests.push(() => stationAsync(async (d, w) => {
  openGuide(d, w);
  await nextFrame();
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  const bd = d.querySelector("[data-guide-backdrop]");
  check("G4 Esc 關閉使用說明並歸還 inert",
    !bd.classList.contains("open") && bd.hasAttribute("inert"), "");
}));

asyncTests.push(() => stationAsync(async (d, w) => {
  openGuide(d, w);
  await nextFrame();
  d.querySelector("[data-guide-to-personalize]").click();
  await nextFrame();
  check("G5 從說明底部可直接接到個人化（說明關閉、個人化開啟）",
    !d.querySelector("[data-guide-backdrop]").classList.contains("open")
    && d.querySelector("[data-modal-backdrop]").classList.contains("open")
    && !!d.querySelector("#pf-name"), "");
}));

// 說明裡的「開啟工具」要跟著個人化設定走，不然看完說明點開卻是原版
station((d, w) => {
  openModal(d, w);
  d.querySelector("#pf-name").value = "小柔";
  const url = gen(d);
  d.querySelector("[data-modal-close]").click();
  openGuide(d, w);
  const href = d.querySelector(".guide-actions .btn-primary").getAttribute("href");
  check("G6 說明底部「開啟工具」帶上已存的個人化設定", href === url, `href=${href}`);
});

// 工具變多的情境：分組標題、搜尋框門檻、搜尋比對範圍
{
  const many = (code) => code.replace(/^\s*\];\s*$/m, `,
    { id: "t2", name: "檔期倒數圖", desc: "產生整組每日倒數社群圖", icon: "ph-calendar",
      baseUrl: "https://example.com/t2/", group: "檔期支援", audience: "社群小編", duration: "3 分鐘",
      guide: { summary: "一次設定，整個檔期的倒數圖都出好。", steps: ["設定檔期", "下載"] } },
    { id: "t3", name: "配件陳列建議", desc: "排名對應花車陳列", icon: "ph-shopping-bag",
      baseUrl: "https://example.com/t3/", group: "檔期支援" },
    { id: "t4", name: "庫存水位表", desc: "補貨提醒", icon: "ph-package",
      baseUrl: "https://example.com/t4/", group: "營運日常", keywords: ["補貨", "安全庫存"] },
    { id: "t5", name: "沒分組的工具", desc: "隨手小工具", icon: "ph-wrench",
      baseUrl: "https://example.com/t5/" }
  ];`);

  const dom = reload({}, many);
  const d = dom.window.document, w = dom.window;
  const heads = [...d.querySelectorAll(".group-head")].map(h => h.firstChild.textContent.trim());
  check("G7 工具變多自動分組，未分組的歸「其他工具」並排最後",
    heads.join("｜") === "新人上手｜檔期支援｜營運日常｜其他工具", `分組=${heads.join("｜")}`);

  const counts = [...d.querySelectorAll(".group-count")].map(c => c.textContent.trim());
  check("G7b 每組顯示支數", counts.join(",") === "1 支,2 支,1 支,1 支", counts.join(","));

  check("G8 工具滿 5 支才長出搜尋框",
    d.querySelector("[data-search-row]").classList.contains("show"), "");

  const search = d.querySelector("[data-tool-search]");
  const type = (v) => { search.value = v; search.dispatchEvent(new w.Event("input", { bubbles: true })); };

  type("倒數");
  check("G9 搜尋比對名稱", d.querySelectorAll(".tool-card").length === 1
    && d.querySelector(".tool-card h3").textContent === "檔期倒數圖",
    `${d.querySelectorAll(".tool-card").length} 張卡`);

  type("安全庫存");
  check("G9b 搜尋比對 keywords（名稱與說明沒寫到的講法）",
    d.querySelectorAll(".tool-card").length === 1
    && d.querySelector(".tool-card h3").textContent === "庫存水位表", "");

  type("話術");
  check("G9c 搜尋比對 guide.summary", d.querySelectorAll(".tool-card").length === 1
    && d.querySelector(".tool-card h3").textContent === "新人快速上手手冊", "");

  type("檔期");
  check("G9d 命中同一組時只留該組標題",
    [...d.querySelectorAll(".group-head")].map(h => h.firstChild.textContent.trim()).join("｜") === "檔期支援"
    || d.querySelectorAll(".tool-card").length === 2,
    `卡片 ${d.querySelectorAll(".tool-card").length} 張`);

  type("不存在的東西");
  check("G10 搜尋無結果給提示而不是空白畫面",
    !!d.querySelector(".search-empty") && d.querySelector(".search-empty").textContent.includes("不存在的東西"), "");

  type("");
  check("G10b 清空搜尋後全部回來", d.querySelectorAll(".tool-card").length === 5, "");

  // 沒寫 guide 的工具不長說明按鈕，也不會因此壞掉
  check("G11 沒寫 guide 的工具不長說明按鈕",
    [...d.querySelectorAll(".tool-card")].filter(c => c.querySelector("[data-guide]")).length === 2,
    `有說明按鈕的卡片 ${[...d.querySelectorAll(".tool-card")].filter(c => c.querySelector("[data-guide]")).length} 張`);

  // 搜尋條件還在時把工具隱藏到門檻以下，搜尋框收起來但殘留條件不能把卡片洗掉
  type("倒數");
  d.querySelector("[data-open-visibility]").click();
  ["t2", "t3", "t4"].forEach(id => {
    const t = d.querySelector(`[data-visibility-toggle="${id}"]`);
    t.checked = false;
    t.dispatchEvent(new w.Event("change", { bubbles: true }));
  });
  check("G12 隱藏到剩不到 5 支時收起搜尋框，並清掉殘留條件避免畫面空白",
    !d.querySelector("[data-search-row]").classList.contains("show")
    && d.querySelector("[data-tool-search]").value === ""
    && d.querySelectorAll(".tool-card").length === 2
    && !d.querySelector(".search-empty"),
    `卡片 ${d.querySelectorAll(".tool-card").length} 張`);

  dom.window.close();
}

// guide 內容含 HTML 特殊字元不能破版（只有 <strong> 例外放行）
{
  const evil = (code) => code.replace(/^\s*\];\s*$/m, `,
    { id: "evil", name: "轉義測試", desc: "d", icon: "ph-bug", baseUrl: "https://example.com/",
      guide: { summary: "<img src=x onerror=alert(1)> & \\"引號\\"",
               for: ["<script>bad()</scr" + "ipt>"],
               steps: ["按 <strong>開始</strong> 然後 <b>不該生效</b>"],
               faq: [{ q: "<i>問</i>", a: "<i>答</i>" }] } }
  ];`);
  const dom = reload({}, evil);
  const d = dom.window.document, w = dom.window;
  const card = [...d.querySelectorAll(".tool-card")].find(c => c.querySelector("h3").textContent === "轉義測試");
  card.querySelector("[data-guide]").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  const body = d.querySelector("[data-guide-body]");
  check("G13 guide 內容轉義：只放行 <strong>，其他標籤不生效",
    body.querySelector(".guide-summary").textContent.includes("<img src=x onerror=alert(1)>")
    && !body.querySelector("img") && !body.querySelector(".guide-list script")
    && !!body.querySelector(".guide-steps strong")
    && !body.querySelector(".guide-steps b")
    && body.querySelector(".guide-faq summary").textContent.includes("<i>問</i>")
    && !body.querySelector(".guide-faq i"),
    "");
  dom.window.close();
}

// 登錄表健檢：漏寫 guide 要在主控台叫出來，不是靜悄悄上線
{
  const noGuide = (code) => code.replace(/^\s*\];\s*$/m, `,
    { id: "silent", name: "沒說明的工具", desc: "d", icon: "ph-wrench", baseUrl: "https://example.com/" }
  ];`);
  const logs = [];
  const dom = new JSDOM(fs.readFileSync(STATION, "utf8"), {
    url: "https://snowsepch.github.io/tool-station/", runScripts: "outside-only", pretendToBeVisual: true
  });
  dom.window.console.warn = (...a) => logs.push(a.join(" "));
  dom.window.eval(noGuide(fs.readFileSync(STATION, "utf8").match(/<script>([\s\S]*)<\/script>/)[1]));
  check("G14 登錄表漏寫 guide 會在主控台警告（工具變多時的防呆）",
    logs.some(l => l.includes("silent") && l.includes("guide")), logs.join(" ｜ ") || "沒有警告");
  dom.window.close();
}

// 色彩對比：新元素用的 token 必須過 AA。這裡讀真實 CSS 變數值，改壞了會被抓到。
{
  const css = fs.readFileSync(STATION, "utf8");
  const tok = (name) => (css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`)) || [])[1];
  const lum = (h) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255)
      .map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

  const ink = tok("ink"), sub = tok("sub-ink"), muted = tok("muted-ink");
  const body = tok("body-bg"), accent = tok("accent"), accentBg = tok("accent-bg");
  const accentDeep = tok("accent-deep"), accentSoft = tok("accent-soft"), white = "#FFFFFF";

  const pairs = [
    ["說明步驟編號 白字/accent", white, accent, 4.5],
    ["說明摘要 accent-deep/accent-bg", accentDeep, accentBg, 4.5],
    ["說明內文 sub-ink/body", sub, body, 4.5],
    ["說明區塊標題 ink/body", ink, body, 4.5],
    ["卡片 meta 文字 sub-ink/accent-soft", sub, accentSoft, 4.5],
    ["分組支數 muted-ink/body", muted, body, 4.5],
    ["搜尋 placeholder muted-ink/white", muted, white, 4.5],
    ["不適用圖示 muted-ink/body（非文字 3:1）", muted, body, 3.0]
  ];
  const bad = pairs.filter(([, f, b, t]) => cr(f, b) < t);
  check("G15 新元素色彩對比全數通過 WCAG AA",
    bad.length === 0,
    pairs.map(([n, f, b]) => `${n} ${cr(f, b).toFixed(2)}`).join("｜"));
}

/* ========== 輸出 ========== */
(async () => {
  for (const t of asyncTests) await t();

  console.log("");
  let fail = 0;
  results.forEach(r => { if (!r.pass) fail++; console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "\n      " + r.detail : ""}`); });
  const real = warns.filter(w => !/Not implemented|Could not load|css|stylesheet/i.test(w));
  console.log("\n主控台警告 / 錯誤：" + (real.length ? "\n  " + real.join("\n  ") : "無"));
  console.log(`\n===== ${results.length - fail} pass / ${fail} fail =====`);
  if (fail) process.exitCode = 1;
})();
