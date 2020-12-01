// -----------------------------------------------------------
//               Requiring, Creating & Binding


const { Client } = require("discord.js"), // Require Client class from Discord.js;
  ytdl = require("ytdl-core"), // Require Ytdl-core and bind to ytdl
  prefix = require("./config.json").prefix, // Require prefix from our local config.json file
  client = new Client(); // Create a new Client and bind to client

require("ffmpeg-static"); // Required Node modules (npm i dotenv)
require("@discordjs/opus"); // Required Node modules (npm i dotenv)

const queue = new Map(); // Create a new Map and bind to queue

//
// -----------------------------------------------------------
//                       Dot Env set up
//
//                    TOKEN=yourBotToken
//
//                   

require("dotenv").config({
  // Require dotenv (npm i dotenv)
  path: __dirname + "/.env", // look for .env file in main directory
});

//
// -----------------------------------------------------------
//                       Bot Events
//

client.once("ready", () => {
  //Once bot is ready, execute code
  console.log(
    //Console log "Bot <name> is now online. Current time <curTime>";
    `Bot ${
      client.user.username
    } is now online. Current time: ${client.readyAt.toTimeString()}`
  );
});

client.on("message", async (message) => {
  //Every message, execute code
  if (message.author.bot) return; //If user is a bot, stop
  if (!message.content.startsWith(prefix)) return; //If user's messagee doesn't start with prefix, stop
  const serverQueue = queue.get(message.guild.id); //Get server with guildID from our queue map.
  var content = message.content.toLowerCase(); // Set to lowercase so commands get registered with any case (!plAy will work the same as !play)

  if (content.startsWith(`${prefix}play`) || content.startsWith(`${prefix}p`)) {
    //If message content starts with {prefix}play or {prefix}p execute code
    initiate(message, serverQueue); //Use custom function, pass message and serverQueue as parameters. Function finds song and starts it or puts it in the queue.
  } else if (content.startsWith(`${prefix}skip`)) {
    //If message content starts with {prefix}skip execute code
    skip(message, serverQueue); //Use custom function, pass message and serverQueue as parameters. Function skips current song and starts another in queue
  } else if (content.startsWith(`${prefix}stop`)) {
    //If message content starts with {prefix}stop execute code
    stop(message, serverQueue); //Use custom function, pass message and serverQueue as parameters. Function stops the song and disconnects client.
  } else if (content.startsWith(`${prefix}queue`)) {
    //If message content starts with {prefix}queue execute code
    getQueue(message, serverQueue); //Use custom function, pass message and serverQueue as parameters. Function gives back the current queue.
  } else {
    // If message content doesn't match any of the commands above, ignore message
    return;
  }
});

//
// -----------------------------------------------------------
//                     Custom Functions
//

async function initiate(message, serverQueue) {
  //asynchronous function initiate() with parameters message, serverQueue
  const args = message.content.trim().split(" "); //create args constant
  const voiceChannel = message.member.voice.channel; //get the voice chat of user
  if (!voiceChannel)
    //If user is not in a voice channel, send message
    return message.channel.send(
      "You need to be in a voice channel to jam out."
    );
  const permissions = voiceChannel.permissionsFor(message.client.user); //Get permissions of the voice channel the user is in
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    //If bot doesn't have permissions to connect or speak, send message
    return message.channel.send(
      "Give ya boy some damn permissions!"
    );
  }
  var songInfo = await ytdl.getInfo(args[1]); //Fetch song info with URL using YTDL

  const song = {
    //Object with song title and song url
    title: songInfo.videoDetails.title,
    url: songInfo.videoDetails.video_url,
  };

  if (!serverQueue) {
    //If there's no queue for the server
    const queueConstruct = {
      //Create a queue
      textChannel: message.channel,
      voiceChannel: voiceChannel,
      connection: null,
      songs: [],
      volume: 5,
      playing: true,
    };

    queue.set(message.guild.id, queueConstruct); //Push queue to our map object with the guildID

    queueConstruct.songs.push(song); //Push song information into the queue

    try {
      var connection = await voiceChannel.join(); //Promise voice channel connection
      queueConstruct.connection = connection; //Send data of connection promise to queue
      play(message.guild, queueConstruct.songs[0]); //Use custom function to play first song in queue
    } catch (err) {
      console.log(err); //Console log any errors
      queue.delete(message.guild.id); //Delete channel queue
      return message.channel.send(err); //Send error into channel
    }
  } else {
    //If there is a queue
    serverQueue.songs.push(song); //Push song information to the end of the queue
    return message.channel.send(`${song.title} has been added to the queue!`); //Send message to channel
  }
}

function skip(message, serverQueue) {
  //synchronous function skip() with parameters message, serverQueue
  if (!message.member.voice.channel)
    //If message author isn't in a voice channel, return error
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );
  if (!serverQueue)
    //If there's no server queue, send error
    return message.channel.send("Can't skip something that's not there!");
  serverQueue.connection.dispatcher.end(); //End connection, since there's no songs left
}

function stop(message, serverQueue) {
    if (!serverQueue) return message.channel.send("There bot is not playing."); //If queue doesn't exist, send error
  //synchronous function stop() with parameters message, serverQueue
  if (!message.member.voice.channel)
    //If message author isn't in a voice channel, return error
    return message.channel.send(
      "Gotta be in channel to do that boss."
    );
  serverQueue.songs = []; //Clear queue
  serverQueue.connection.dispatcher.end(); //End connection in voice chat (Disconnect)
}

function play(guild, song) {
  //synchronous function play() with parameters guild, song
  const serverQueue = queue.get(guild.id); //Get server queue
  if (!song) {
    //If there's no song left
    serverQueue.voiceChannel.leave(); //Leave voice channel
    queue.delete(guild.id); //Clear queue
    return;
  }

  const dispatcher = serverQueue.connection //use server queue's connection as a dispatcher constant
    .play(ytdl(song.url)) //Play song
    .on("finish", () => {
      //When song finishes
      serverQueue.songs.shift(); //Remove finished song from queue
      play(guild, serverQueue.songs[0]); //Play new song
    })
    .on("error", (error) => console.error(error)); //If there's an error reading the song, return an error
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5); //Set dispatcher volume
  serverQueue.textChannel.send(`Start playing: **${song.title}**`); //Send into the bound queue channel a notification of a new song playing
}

function getQueue(message, serverQueue) { //synchronous function getQueue() with parameters message and serverQueue
  if (!serverQueue) return message.channel.send("There's no queue."); //If queue doesn't exist, send error
  str = ""; //Initiate a string
  pos = 1; //Initiate a position
  serverQueue.songs.forEach((song) => { //For each song in the queue
    str += `**${pos}** - ` + song.title + "\n"; //Add position into string, add song title into string and break line
    pos++; //Increment position
  });
  message.channel.send(str); //Send string into channel
}

client.login(process.env.TOKEN);
