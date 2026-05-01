// send.js
// GitHub Actions から1回だけ起動されて、config.json のスケジュールに従って
// Discord にメッセージを1通送信して終了するスクリプト。
//
// 使い方:
//   node send.js          # config.schedules すべてに対して1通ずつ送信
//   node send.js 0        # config.schedules[0] のみ送信
//   node send.js --index 0  # 同上
//
// 必要な環境変数:
//   DISCORD_TOKEN  ... Discord Bot のトークン (GitHub Secrets に登録)

const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const path = require("path");
require("dotenv").config(); // ローカル実行時のみ .env を読む。Actions 上では env で渡す。

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, "config.json"), "utf-8")
);

// --- 引数パース --------------------------------------------------------------
function parseIndex(argv) {
  const args = argv.slice(2);
  if (args.length === 0) return null;
  const idxFlag = args.indexOf("--index");
  if (idxFlag !== -1 && args[idxFlag + 1] !== undefined) {
    return Number(args[idxFlag + 1]);
  }
  const n = Number(args[0]);
  return Number.isInteger(n) ? n : null;
}

// --- 重み付きランダム選択 ----------------------------------------------------
function pickWeighted(messages) {
  const total = messages.reduce((s, m) => s + m.weight, 0);
  if (total <= 0) {
    throw new Error("有効なメッセージがありません (weight 合計が 0)");
  }
  let rand = Math.random() * total;
  return messages.find((m) => (rand -= m.weight) < 0);
}

// --- メイン ------------------------------------------------------------------
async function main() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error("環境変数 DISCORD_TOKEN が設定されていません");
    process.exit(1);
  }

  const idx = parseIndex(process.argv);
  const targets =
    idx === null
      ? config.schedules
      : [config.schedules[idx]].filter(Boolean);

  if (targets.length === 0) {
    console.error(`schedules[${idx}] が存在しません`);
    process.exit(1);
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);
  console.log(`ログイン成功: ${client.user.tag}`);

  const mention = `<@&${config.roleId}>`;
  let failed = 0;

  for (const schedule of targets) {
    const { channelId, messages } = schedule;
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel) throw new Error(`チャンネルが見つかりません: ${channelId}`);

      const picked = pickWeighted(messages);
      await channel.send({
        content: `${mention} ${picked.text}`,
        allowedMentions: { parse: ["roles"] },
      });

      const now = new Date().toLocaleString("ja-JP", {
        timeZone: config.timezone || "Asia/Tokyo",
      });
      console.log(`[${now}] 送信完了 → #${channel.name}: ${picked.text}`);
    } catch (e) {
      failed++;
      console.error(`送信失敗 (channelId=${channelId}):`, e);
    }
  }

  await client.destroy();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
