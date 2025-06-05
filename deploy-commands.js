require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("ping_slave")
    .setDescription("Replies with latency info."),

  new SlashCommandBuilder()
    .setName("purgeall")
    .setDescription("Delete messages from a specific user in the past X days.")
    .addUserOption((option) =>
      option.setName("target").setDescription("User to purge").setRequired(true)
    )
    .addIntegerOption((option) =>
      option.setName("days").setDescription("Number of days").setRequired(true)
    ),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(
  process.env.DISCORD_BOT_TOKEN
);

(async () => {
  try {
    console.log("Registering slash commands...");

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID), // Replace with your app ID
      { body: commands }
    );

    console.log("Slash commands registered successfully.");
  } catch (err) {
    console.error("Error registering commands:", err);
  }
})();
