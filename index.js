// Fortnite Custom Match Scheduler + AI Ping Support + Render Server Control
require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const schedule = require('node-schedule');

const app = express();
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const ANNOUNCE_CHANNEL_ID = process.env.ANNOUNCE_CHANNEL_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RENDER_SERVICE_ID = process.env.RENDER_SERVICE_ID;
const RENDER_CONTROL_CHANNEL_ID = process.env.RENDER_CONTROL_CHANNEL_ID;

const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

// Fortnite /custommatch command
const customCommand = new SlashCommandBuilder()
  .setName('createcustom')
  .setDescription('Schedule a Fortnite custom match')
  .addStringOption(option =>
    option.setName('time').setDescription('Start time (e.g. 15:00)').setRequired(true))
  .addStringOption(option =>
    option.setName('day').setDescription('Day of the week (e.g. Monday)').setRequired(true))
  .addStringOption(option =>
    option.setName('mode').setDescription('Game mode (e.g. Solos, Duos)').setRequired(true));

// Register slash commands
(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: [customCommand.toJSON()]
  });
})();

const dayMap = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'createcustom') {
      const time = interaction.options.getString('time');
      const day = interaction.options.getString('day').toLowerCase();
      const mode = interaction.options.getString('mode');

      const acceptedTimes = [
        '10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00'
      ];

      if (!acceptedTimes.includes(time)) {
        return interaction.reply({ content: `❌ Invalid time. Accepted times: ${acceptedTimes.join(', ')}`, ephemeral: true });
      }

      if (!(day in dayMap)) {
        return interaction.reply({ content: `❌ Invalid day. Please use full day names like Monday, Tuesday, etc.`, ephemeral: true });
      }

      const now = new Date();
      let scheduledDate = new Date();
      const targetDay = dayMap[day];
      const daysUntil = (targetDay + 7 - now.getDay()) % 7 || 7;
      scheduledDate.setDate(now.getDate() + daysUntil);

      const [hour, minute] = time.split(':').map(Number);
      scheduledDate.setUTCHours(hour - 1, minute, 0, 0); // UK time (BST = UTC+1)

      if (scheduledDate - now < 86400000) {
        return interaction.reply({ content: '❌ You must schedule at least 24 hours in advance.', ephemeral: true });
      }

      const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID);

      schedule.scheduleJob(scheduledDate, async () => {
        if (channel?.type === ChannelType.GuildText) {
          await channel.send({ content: 
            `📢 **Scheduled Fortnite Custom Match!**
👤 Host: <@${interaction.user.id}>
🕒 Time: **${time} UK** on **${day.charAt(0).toUpperCase() + day.slice(1)}**
🎮 Mode: **${mode}**

Please be ready in-game before the start time!` });
        }
      });

      return interaction.reply({ content: `✅ Your match is scheduled for **${time} UK** on **${day.charAt(0).toUpperCase() + day.slice(1)}**.`, ephemeral: true });
    }
  }

  // Handle button interactions for Render server controls
  if (interaction.isButton()) {
    if (!interaction.channel || interaction.channel.id !== RENDER_CONTROL_CHANNEL_ID) {
      return interaction.reply({ content: '❌ This button is not usable in this channel.', ephemeral: true });
    }

    const action = interaction.customId; // 'start', 'stop', or 'restart'
    const baseURL = 'https://api.render.com/v1';
    const headers = {
      Authorization: `Bearer ${RENDER_API_KEY}`,
      Accept: 'application/json',
    };

    try {
      if (action === 'stop') {
        await axios.put(`${baseURL}/services/${RENDER_SERVICE_ID}/suspend`, null, { headers });
        await interaction.reply({ content: '🛑 Server stopped (suspended).', ephemeral: true });
      } else if (action === 'start') {
        await axios.put(`${baseURL}/services/${RENDER_SERVICE_ID}/resume`, null, { headers });
        await interaction.reply({ content: '▶️ Server started (resumed).', ephemeral: true });
      } else if (action === 'restart') {
        await axios.post(`${baseURL}/services/${RENDER_SERVICE_ID}/restart`, null, { headers });
        await interaction.reply({ content: '🔄 Server restarted.', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Unknown action.', ephemeral: true });
      }
    } catch (err) {
      console.error('❌ Render API Error:', err.response?.status, err.response?.data || err.message);
      await interaction.reply({ content: '❌ Failed to process your request with Render API.', ephemeral: true });
    }
  }
});

// On ready, send control panel message with buttons to specified channel
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(RENDER_CONTROL_CHANNEL_ID);
    if (!channel || channel.type !== ChannelType.GuildText) {
      console.error('❌ Render control channel not found or not a text channel.');
      return;
    }

    // Create buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('stop')
          .setLabel('Stop')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('start')
          .setLabel('Start')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('restart')
          .setLabel('Restart')
          .setStyle(ButtonStyle.Primary),
      );

    // Send or fetch previous message? Here we just send a new one each time bot starts
    await channel.send({ content: '🖥️ **Render Server Control Panel**', components: [row] });
  } catch (error) {
    console.error('❌ Failed to send Render control panel:', error);
  }
});

// AI mention reply
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (message.mentions.has(client.user)) {
    const prompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`), '').trim();
    if (!prompt) return message.reply('❌ You must say something.');
    try {
      const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }]
      }, {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      const reply = res.data.choices[0]?.message?.content || '⚠️ No response.';
      return message.reply(reply);
    } catch (err) {
      console.error('❌ AI Error:', err);
      return message.reply('❌ Failed to contact AI.');
    }
  }
});

client.login(DISCORD_BOT_TOKEN);
