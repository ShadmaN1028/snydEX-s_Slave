require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
} = require("discord.js");
const os = require("os");
const nodeName = os.hostname();

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

// SLASH COMMAND HANDLER
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
      )}ms (avg)\nShard ${shardId}: ${latency.toFixed(2)}ms\nNode: ${nodeName}`
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
    const days = interaction.options.getInteger("days");
    if (!user || !days) return;

    const timeThreshold = Date.now() - days * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const channel of interaction.guild.channels.cache.values()) {
      if (channel.isTextBased()) {
        try {
          const messages = await channel.messages.fetch({ limit: 100 });
          const userMessages = messages.filter(
            (m) => m.author.id === user.id && m.createdTimestamp > timeThreshold
          );

          if (userMessages.size > 0) {
            await channel.bulkDelete(userMessages);
            deletedCount += userMessages.size;
          }
        } catch (err) {
          console.error(`Error in ${channel.name}:`, err);
        }
      }
    }

    await interaction.reply(
      `🧹 Deleted ${deletedCount} messages from ${user.tag} in the past ${days} day(s).`
    );
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
