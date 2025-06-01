// Fortnite Custom Match Scheduler with Free-Form Time and AI @mention Triggering
require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
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

const customSessions = new Map();

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();
  const now = new Date();

  // AI reply on mention of the bot name
  if (message.content.includes('<@' + client.user.id + '>')) {
    const prompt = message.content.replace(/<@!?\d+>/, '').trim();
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

  // Start custom session when "create custom" appears in chat
  if (content.includes('create custom')) {
    await message.reply(
      `📅 Let’s get your Fortnite custom match set up!
You must schedule it **at least 24 hours in advance** and **between 11am–10pm UK time**.
What time should the match start? (e.g. \`15:00\`)`
    );
    customSessions.set(message.author.id, { step: 'time' });
    return;
  }

  if (!customSessions.has(message.author.id)) return;

  const session = customSessions.get(message.author.id);

  if (session.step === 'time') {
    const acceptedTimes = [
      '10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00'
    ];
    if (!acceptedTimes.includes(message.content.trim())) {
      return message.reply(`❌ Invalid time. Accepted times: ${acceptedTimes.join(', ')}`);
    }
    session.time = message.content.trim();
    session.step = 'day';
    return message.reply('📆 Great! What day should the custom run? (e.g. `2025-06-03`)');

  } else if (session.step === 'day') {
    const customDate = new Date(`${message.content}T${session.time}:00+01:00`);
    const delayMs = customDate - now;

    if (isNaN(customDate) || delayMs < 86400000) {
      return message.reply('❌ Date must be **at least 24 hours from now** and **between 11am–10pm UK time**.');
    }

    const hour = customDate.getUTCHours();
    if (hour < 10 || hour > 21) {
      return message.reply('❌ Time must be between **11am and 10pm UK time**.');
    }

    session.day = message.content.trim();
    session.step = 'mode';
    return message.reply('🎮 Almost done! What gamemode? (e.g. `Solos`, `Duos`, `Trios`, `Squads`)');

  } else if (session.step === 'mode') {
    session.mode = message.content.trim();
    session.step = 'done';
    customSessions.delete(message.author.id);

    const postTime = new Date(`${session.day}T${session.time}:00+01:00`);
    const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID);

    schedule.scheduleJob(postTime, async () => {
      if (channel?.type === ChannelType.GuildText) {
        await channel.send({ content: 
          `📢 **Scheduled Fortnite Custom Match!**
👤 Host: <@${message.author.id}>
🕒 Time: **${session.time} UK** on **${session.day}**
🎮 Mode: **${session.mode}**

Please be ready in-game before the start time!` });
      }
    });

    return message.reply(`✅ Your custom match has been scheduled for **${session.time} UK** on **${session.day}**! We’ll remind everyone then.`);
  }
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(DISCORD_BOT_TOKEN);
