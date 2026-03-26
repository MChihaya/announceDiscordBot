const { Client, GatewayIntentBits } = require("discord.js");
const cron = require("node-cron");
const fs = require("fs");
require("dotenv").config();

const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// 曜日名の対応表（ログ用）
const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

client.once("ready", () => {
  console.log(`ログイン成功: ${client.user.tag}`);

  const mention = `<@&${config.roleId}>`;

  for (const schedule of config.schedules) {
    const { channelId, dayOfWeek, hour, minute, messages } = schedule;

    // node-cron形式: 分 時 * * 曜日
    const cronExpression = `${minute} ${hour} * * ${dayOfWeek}`;

    cron.schedule(
      cronExpression,
      async () => {
        try {
          const channel = await client.channels.fetch(channelId);
          if (!channel) {
            console.error(`チャンネルが見つかりません: ${channelId}`);
            return;
          }
          const totalWeight = messages.reduce((sum, m) => sum + m.weight, 0);
          let rand = Math.random() * totalWeight;
          const picked = messages.find((m) => (rand -= m.weight) < 0);
          await channel.send({
            content: `${mention} ${picked.text}`,
            allowedMentions: { parse: ["roles"] },
          });
          console.log(
            `[${new Date().toLocaleString("ja-JP", { timeZone: config.timezone })}] メッセージ送信完了 → #${channel.name}`
          );
        } catch (error) {
          console.error("メッセージ送信エラー:", error);
        }
      },
      { timezone: config.timezone }
    );

    console.log(
      `スケジュール登録: 毎週${dayNames[dayOfWeek]}曜日 ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} → チャンネル ${channelId}`
    );
  }
});

client.login(process.env.DISCORD_TOKEN);
