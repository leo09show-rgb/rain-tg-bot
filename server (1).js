const express = require("express");
const crypto = require("crypto");

const {
  TG_TOKEN,
  TG_CHAT_ID,
  RAIN_SECRET,
  SITE_NAME = "Pera",
  SITE_URL = "https://t2m.co/perabet-t",
  LINK_TEXT = "Pera'da Rain başladı, kaçıran kaybeder!",
  PORT = 10000,
} = process.env;

// Emojiler: buradan istediğin gibi değiştir
const E = {
  title: "🌧️",
  sender: "👑",
  total: "💸",
  winners: "🥳",
  each: "🎁",
  list: "🏆",
  link: "🔥",
};

const STABLE = new Set(["USDT", "USDC", "USD", "BUSD", "DAI", "TUSD"]);
const seen = new Set(); // tekrar eden rainId'leri yoksaymak için

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// 100 -> "100", 20.5 -> "20.5", 0.33333 -> "0.3333"
const num = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return String(n ?? "0");
  return x.toLocaleString("en-US", { maximumFractionDigits: 4 });
};

const usd = (n) =>
  "$" +
  Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// recipients: ["ali","veli"] veya [{username:"ali"}, ...] olabilir
const names = (recipients) =>
  (Array.isArray(recipients) ? recipients : [])
    .map((r) =>
      typeof r === "string"
        ? r
        : r?.username || r?.name || r?.userName || r?.nickname || r?.id
    )
    .filter(Boolean);

function formatMessage(p) {
  const currency = String(p.currency || "USDT").toUpperCase();
  const stable = STABLE.has(currency);
  const approx = (v) => (stable ? ` (~${usd(v)})` : "");

  const list = names(p.recipients);
  const count = p.recipientCount ?? list.length;

  const rawSender = String(p.sender ?? "").trim();
  const sender = /^(sistem|system)$/i.test(rawSender) ? "admin" : rawSender;

  const lines = [
    `${E.title} <b>${esc(SITE_NAME)} Rain!</b> ${E.title}`,
    "",
    `${E.sender} <b>Dağıtan:</b> ${esc(sender)}`,
    `${E.total} <b>Toplam:</b> ${num(p.totalAmount)} ${esc(currency)}${approx(p.totalAmount)}`,
    `${E.winners} <b>Kazanan:</b> ${esc(count)} kişi`,
    `${E.each} <b>Kişi başı:</b> ${num(p.amountPerUser)} ${esc(currency)}${approx(p.amountPerUser)}`,
  ];

  if (list.length) {
    lines.push("", `${E.list} <b>Kazananlar:</b>`, list.map(esc).join(", "));
  }

  lines.push(
    "",
    `${E.link} <a href="${esc(SITE_URL)}">${esc(LINK_TEXT)}</a>`
  );
  return lines.join("\n");
}

function validSignature(raw, header) {
  if (!RAIN_SECRET) return false;
  if (!header) return false;
  const given = String(header).replace(/^sha256=/i, "").trim().toLowerCase();
  const expected = crypto
    .createHmac("sha256", RAIN_SECRET)
    .update(raw)
    .digest("hex");
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function sendTelegram(text) {
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TG_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) console.error("Telegram hata", res.status, data);
  else console.log("Telegram'a gitti");
}

const app = express();

app.get("/", (_req, res) => res.send("ok"));

app.post(
  "/rain-webhook",
  express.raw({ type: "*/*", limit: "1mb" }),
  (req, res) => {
    const raw = req.body; // Buffer

    if (!validSignature(raw, req.get("X-Rain-Signature"))) {
      console.warn("İmza geçersiz");
      return res.status(401).send("invalid signature");
    }

    // 5 sn sınırı: hemen 200 dön, işi sonra yap
    res.status(200).send("ok");

    let p;
    try {
      p = JSON.parse(raw.toString("utf8"));
    } catch {
      return console.error("JSON okunamadı");
    }

    if (p.rainId) {
      if (seen.has(p.rainId)) return console.log("Tekrar, yoksayıldı", p.rainId);
      seen.add(p.rainId);
      if (seen.size > 1000) seen.delete(seen.values().next().value);
    }

    sendTelegram(formatMessage(p)).catch((e) => console.error(e));
  }
);

if (require.main === module) {
  if (!TG_TOKEN || !TG_CHAT_ID || !RAIN_SECRET) {
    console.error("TG_TOKEN, TG_CHAT_ID ve RAIN_SECRET gerekli");
    process.exit(1);
  }
  app.listen(PORT, () => console.log("Dinliyor:", PORT));
}

module.exports = { formatMessage };
