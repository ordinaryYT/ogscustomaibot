const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require('discord.js');

const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

require('dotenv').config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const SERVER_URL = 'https://ogscustomaibot.onrender.com'; // External server URL

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

async function sendServerCommand(command) {
  try {
    const response = await fetch(`${SERVER_URL}/${command}`, {
      method: 'POST'
    });
    return response.ok;
  } catch (error) {
    console.error(`[Bot] API request error for '${command}':`, error.message);
    return false;
  }
}

async function createOrUpdateBotControls(channel) {
  const messages = await channel.messages.fetch({ limit: 20 });
  const existing = messages.find(
    (msg) =>
      msg.author.id === client.user.id &&
      msg.content === '🤖 **Bot Controls**'
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('restart')
      .setLabel('Restart')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('pause')
      .setLabel('Pause')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('resume')
      .setLabel('Resume')
      .setStyle(ButtonStyle.Success)
  );

  if (existing) {
    await existing.edit({ content: '🤖 **Bot Controls**', components: [row] });
  } else {
    await channel.send({
      content: '🤖 **Bot Controls**',
      components: [row]
    });
  }
}

client.once('ready', async () => {
  console.log(`[Bot] Logged in as ${client.user.tag}`);
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error('[Bot] Could not find the specified channel.');
      return;
    }
    await createOrUpdateBotControls(channel);
  } catch (err) {
    console.error('[Bot] Error during startup:', err.message);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.channelId !== CHANNEL_ID) return;

  const command = interaction.customId;

  try {
    await interaction.deferReply({ ephemeral: true });

    const success = await sendServerCommand(command);

    await interaction.editReply({
      content: success
        ? `✅ Command \`${command}\` executed successfully.`
        : `❌ Failed to execute \`${command}\`.`
    });
  } catch (error) {
    console.error(`[Bot] Failed to process interaction:`, error.message);
    if (!interaction.replied) {
      await interaction.editReply({
        content: `❌ An unexpected error occurred while handling your request.`
      });
    }
  }
});

client.login(DISCORD_TOKEN);
