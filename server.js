const express = require('express');
const crypto = require('crypto');

const TOKEN = process.env.TG_TOKEN;
const CHAT_ID = process.env.TG_CHAT_ID;
const SECRET = process.env.RAIN_SECRET || '';
const PORT = process.env.PORT || 3000;

if (!TOKEN || !CHAT_ID) {
  console.error('TG_TOKEN ve TG_CHAT_ID gerekli');
  process.exit(1);
}

const app = express();
const seen = new Set();
const MAX_NAMES = 50;

app.get('/', (_, res) => res.send('ok'));

app.post('/rain-webhook', express.raw({ type: '*/*', limit: '1mb' }), (req, res) => {
  if (SECRET) {
    const sig = req.get('X-Rain-Signature') || '';
    const exp = 'sha256=' + crypto.createHmac('sha256', SECRET).update(req.body).digest('hex');
    if (sig.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) {
      return res.sendStatus(401);
    }
  }

  res.sendStatus(200); // 5 sn sınırı için hemen dön

  let d;
  try { d = JSON.parse(req.body.toString('utf8')); } catch { return; }

  if (d.rainId) {
    if (seen.has(d.rainId)) return;
    seen.add(d.rainId);
    if (seen.size > 5000) seen.delete(seen.values().next().value);
  }

  const list = Array.isArray(d.recipients) ? d.recipients : [];
  const shown = list.slice(0, MAX_NAMES).join(', ');
  const extra = list.length > MAX_NAMES ? ` +${list.length - MAX_NAMES} kişi` : '';

  const text =
    `🌧 Rain dağıtıldı (${d.type})\n` +
    `Gönderen: ${d.sender ?? '-'}\n` +
    `Toplam: ${d.totalAmount} ${d.currency}\n` +
    `Kişi başı: ${d.amountPerUser} ${d.currency}\n` +
    `Alan sayısı: ${d.recipientCount}\n` +
    `Alanlar: ${shown}${extra}\n` +
    `Zaman: ${d.distributedAt}`;

  send(text.slice(0, 4000));
});

async function send(text, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text })
      });
      if (r.ok) return;
      console.error('Telegram hata', r.status, await r.text());
    } catch (e) { console.error(e.message); }
    await new Promise(r => setTimeout(r, 2000 * (i + 1)));
  }
}

app.listen(PORT, () => console.log('Dinliyor:', PORT));
