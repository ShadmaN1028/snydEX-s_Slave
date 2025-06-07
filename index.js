require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
} = require("discord.js");
const express = require("express");
const os = require("os");
const nodeName = os.hostname();

// Create Express server for health checks
const app = express();
const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  console.log("✅ Health ping received at", new Date().toISOString());
  res.json({
    status: "online",
    bot: client.user?.tag || "Not logged in",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Health check server running on port ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

async function deleteUserMessages(guild, userId, days) {
  // Discord only allows bulkDelete for messages < 14 days old, so
  // for messages older than that, we must delete individually.
  // But you want 31 days. We'll handle that by deleting individually for >14 days messages.

  const timeThreshold = Date.now() - days * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  for (const channel of guild.channels.cache.values()) {
    if (!channel.isTextBased()) continue;
    if (
      !channel.viewable ||
      !channel
        .permissionsFor(guild.members.me)
        .has(PermissionsBitField.Flags.ViewChannel)
    ) {
      // Bot cannot see this channel
      console.warn(`❌ #${channel.name} : access denied `);
      continue;
    }
    console.log(`🔄 #${channel.name} : checking...`);
    try {
      let lastMessageId = null;
      let fetchMore = true;

      while (fetchMore) {
        // Fetch messages in batches of 100
        const options = { limit: 100 };
        if (lastMessageId) options.before = lastMessageId;

        const messages = await channel.messages.fetch(options);
        if (messages.size === 0) break;

        // Filter user messages newer than threshold
        const userMessages = messages.filter(
          (m) => m.author.id === userId && m.createdTimestamp > timeThreshold
        );

        // Separate messages younger than 14 days and older
        const bulkDeleteMsgs = userMessages.filter(
          (m) => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000
        );
        const individualDeleteMsgs = userMessages.filter(
          (m) => Date.now() - m.createdTimestamp >= 14 * 24 * 60 * 60 * 1000
        );

        // Bulk delete young messages (max 100 at a time)
        if (bulkDeleteMsgs.size > 0) {
          await channel.bulkDelete(bulkDeleteMsgs, true).catch((e) => {
            // If any error, just log and continue
            console.error(`Bulk delete error in #${channel.name}:`, e.message);
          });
          deletedCount += bulkDeleteMsgs.size;
        }

        // Individually delete older messages (slow but necessary)
        for (const [id, msg] of individualDeleteMsgs) {
          try {
            await msg.delete();
            deletedCount++;
            // Avoid rate limit hit
            await new Promise((res) => setTimeout(res, 1000));
          } catch (e) {
            console.error(
              `Individual delete error in #${channel.name} message ${id}:`,
              e.message
            );
          }
        }

        // Prepare for next fetch
        lastMessageId = messages.last().id;

        // Stop if messages are older than threshold (no need to fetch further)
        if (messages.last().createdTimestamp < timeThreshold) break;
      }
      console.log(`✅ #${channel.name} : checked`);
    } catch (err) {
      if (err.code === 50001) {
        // Missing Access - skip this channel silently
        console.warn(`Missing Access to channel #${channel.name}, skipping.`);
      } else {
        console.error(`Error fetching messages in #${channel.name}:`, err);
      }
    }
  }
  console.log("😴 snydEX's Slave is now sleeping...");
  return deletedCount;
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === "ping_slave") {
    const latency = Date.now() - interaction.createdTimestamp;
    const shardId = interaction.guild?.shardId || 0;
    const clusterId = Math.floor(shardId / 10);

    await interaction.reply(
      `Pong!\nCluster ${clusterId}: ${latency.toFixed(
        2
      )}ms (avg)\nShard ${shardId}: ${latency.toFixed(2)}ms`
    );
  }

  if (commandName === "purgeall") {
    const member = interaction.member;
    if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return await interaction.reply({
        content: "You don't have permission to use this command.",
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser("target");
    let days = interaction.options.getInteger("days");

    if (!user || !days) {
      return await interaction.reply({
        content: "Please provide a user and number of days.",
        ephemeral: true,
      });
    }

    if (days > 31) {
      days = 31; // limit max days to 31
    }

    // Defer reply since it can take time
    await interaction.deferReply();
    // later, edit the reply with actual content
    await interaction.editReply(
      "snydEX's Slave is working his ass off to delete the messages..."
    );

    try {
      const deletedCount = await deleteUserMessages(
        interaction.guild,
        user.id,
        days
      );

      await interaction.editReply(
        `🧹 Deleted ${deletedCount} messages from ${user.tag} in the past ${days} day(s).`
      );
    } catch (err) {
      console.error("Error during purgeall command:", error);
      await interaction.editReply("An error occurred while deleting messages.");
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
