const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

/////////////////////
// Config & Setup
/////////////////////

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const SERVER_URL = 'https://ogscustomaibot.onrender.com'; // Your external API

/////////////////////
// Discord Bot Setup
/////////////////////

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

async function sendServerCommand(command) {
  try {
    const res = await fetch(`${SERVER_URL}/${command}`, { method: 'POST' });
    return res.ok;
  } catch (error) {
    console.error(`[Bot] Error sending ${command} command:`, error);
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
    return existing;
  } else {
    return await channel.send({
      content: '🤖 **Bot Controls**',
      components: [row],
    });
  }
}

client.once('ready', async () => {
  console.log(`[Bot] Logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel) {
    console.error('[Bot] Could not find the specified channel.');
    return;
  }

  await createOrUpdateBotControls(channel);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.channelId !== CHANNEL_ID) {
    return interaction.reply({
      content: 'This control panel only works in the designated channel.',
      ephemeral: true
    });
  }

  const command = interaction.customId; // 'restart', 'pause', 'resume'
  const success = await sendServerCommand(command);

  await interaction.reply({
    content: success
      ? `✅ Successfully sent \`${command}\` command.`
      : `❌ Failed to send \`${command}\` command.`,
    ephemeral: true
  });
});

client.login(DISCORD_TOKEN);
