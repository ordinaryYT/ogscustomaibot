const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');
require('dotenv').config();

/////////////////////
// Config & Setup
/////////////////////

const app = express();
const PORT = process.env.API_PORT || 5000;

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const SERVER_URL = `http://localhost:${PORT}`; // the API is hosted here

// Server state simulation
let isPaused = false;

/////////////////////
// Render Server API (hidden details)
/////////////////////

app.post('/restart', (req, res) => {
  console.log('[API] Restart command received.');
  // Your actual restart logic here
  res.sendStatus(200);
});

app.post('/pause', (req, res) => {
  console.log('[API] Pause command received.');
  isPaused = true;
  // Your actual pause logic here
  res.sendStatus(200);
});

app.post('/resume', (req, res) => {
  console.log('[API] Resume command received.');
  isPaused = false;
  // Your actual resume logic here
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`[API] Control server listening on port ${PORT}`);
});

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
    if (res.ok) return true;
    else {
      console.error(`[Bot] Server responded with status ${res.status} for command ${command}`);
      return false;
    }
  } catch (error) {
    console.error(`[Bot] Error sending ${command} command:`, error);
    return false;
  }
}

client.once('ready', () => {
  console.log(`[Bot] Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.channel.id !== CHANNEL_ID) return; // only in specific channel
  if (message.author.bot) return; // ignore bots

  const content = message.content.toLowerCase();

  if (content === '!overlay') {
    try {
      await message.channel.send({
        content: 'Overlay activated.',
        files: ['./overlay.png'], // Make sure this file exists
      });
    } catch (err) {
      console.error('[Bot] Error sending overlay:', err);
      message.reply('Failed to send image.');
    }
  } else if (content === '!restart') {
    const success = await sendServerCommand('restart');
    if (success) message.reply('Process restarted successfully.');
    else message.reply('Failed to restart the process.');
  } else if (content === '!pause') {
    const success = await sendServerCommand('pause');
    if (success) message.reply('Process paused.');
    else message.reply('Failed to pause the process.');
  } else if (content === '!resume') {
    const success = await sendServerCommand('resume');
    if (success) message.reply('Process resumed.');
    else message.reply('Failed to resume the process.');
  }
});

client.login(DISCORD_TOKEN);
