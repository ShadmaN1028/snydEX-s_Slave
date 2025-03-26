require("dotenv").config(); // Load environment variables
const { Client, GatewayIntentBits } = require("discord.js");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Privileged intent
  ],
});

const TOKEN = process.env.DISCORD_BOT_TOKEN; // Use environment variable for the token

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.content.startsWith("!purgeall")) {
    // Check if the user has permission to manage messages
    if (!message.member.permissions.has("MANAGE_MESSAGES")) {
      return message.reply("You don't have permission to use this command.");
    }

    // Split the command into parts
    const args = message.content.split(" ");
    if (args.length < 3) {
      return message.reply("Usage: `!purgeall @Username <days>`");
    }

    // Get the mentioned user
    const user = message.mentions.users.first();
    if (!user) return message.reply("Mention a user to delete their messages.");

    // Get the number of days from the command
    const days = parseInt(args[2]);
    if (isNaN(days) || days < 1) {
      return message.reply(
        "Please provide a valid number of days (e.g., `!purgeall @Username 7`)."
      );
    }

    let deletedCount = 0;
    const timeThreshold = Date.now() - days * 24 * 60 * 60 * 1000; // Calculate timestamp for X days ago

    // Loop through all channels in the server
    for (const channel of message.guild.channels.cache.values()) {
      if (channel.isTextBased()) {
        try {
          // Fetch messages in the channel (up to 100 at a time)
          const messages = await channel.messages.fetch({ limit: 100 });
          const userMessages = messages.filter(
            (m) => m.author.id === user.id && m.createdTimestamp > timeThreshold
          );

          // Delete the user's messages within the specified time frame
          if (userMessages.size > 0) {
            await channel.bulkDelete(userMessages);
            deletedCount += userMessages.size;
          }
        } catch (error) {
          console.error(`Error in ${channel.name}: ${error}`);
        }
      }
    }

    // Send a confirmation message
    message.channel.send(
      `Deleted ${deletedCount} messages from ${user.tag} in the past ${days} day(s).`
    );
  }
});

client.login(TOKEN);
