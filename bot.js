require("dotenv").config();
const { Bot, webhookCallback, GrammyError, HttpError } = require("grammy");
const https = require("https");

// Bot

const bot = new Bot(process.env.BOT_TOKEN);

// Auth

const accessToken = process.env.ACCESS_TOKEN;

// Admin

const BOT_DEVELOPER = 0 | process.env.BOT_DEVELOPER;

bot.use(async (ctx, next) => {
  ctx.config = {
    botDeveloper: BOT_DEVELOPER,
    isDeveloper: ctx.from?.id === BOT_DEVELOPER,
  };
  await next();
});

// Commands

bot.command("start", async (ctx) => {
  if (ctx.chat.type === "private") {
    await ctx
      .reply(
        "*Welcome!* ✨\n_Send a message to push to Pushbullet._\n\n*Here's how to push with a title:*\n_Use /push in the following format:\n/push (title) <message>_",
        {
          parse_mode: "Markdown",
        }
      )
      .then(console.log("New user added:\n", ctx.from));
  } else {
    await ctx.reply("*Channels are not supported presently.*", {
      parse_mode: "Markdown",
    });
  }
});

bot.command("help", async (ctx) => {
  await ctx
    .reply(
      "*@anzubo Project.*\n\n_This is a bot to send push messages to your Pushbullet devices._",
      { parse_mode: "Markdown" }
    )
    .then(console.log("Help command sent to", ctx.chat.id));
});

// Push

bot.command("push", async (ctx) => {
  if (ctx.chat.type === "private") {
    // Logging

    const from = ctx.from;
    const name =
      from.last_name === undefined
        ? from.first_name
        : `${from.first_name} ${from.last_name}`;
    console.log(
      `From: ${name} (@${from.username}) ID: ${from.id}\nMessage: ${ctx.message.text}`
    );

    // Logic
    if (!ctx.config.isDeveloper) {
      await ctx.reply("*Apologies! This bot isn't open to users yet.*", {
        reply_to_message_id: ctx.message.message_id,
        parse_mode: "Markdown",
      });
    } else {
      try {
        const pattern = /^\/push\s*\(.+\)\s*.+$/;
        const isFormatCorrect = pattern.test(ctx.message.text);
        if (!isFormatCorrect) {
          await ctx.reply(
            "<b>Incorrect format.</b>\n<i>Make sure it's in the format:</i>\n<code>/push (title) message</code>",
            { parse_mode: "HTML" }
          );
        } else {
          const statusMessage = await ctx.reply(`*Pushing*`, {
            parse_mode: "Markdown",
          });
          async function deleteMessageWithDelay(fromId, messageId, delayMs) {
            return new Promise((resolve, reject) => {
              setTimeout(() => {
                bot.api
                  .deleteMessage(fromId, messageId)
                  .then(() => resolve())
                  .catch((error) => reject(error));
              }, delayMs);
            });
          }
          await deleteMessageWithDelay(
            ctx.chat.id,
            statusMessage.message_id,
            3000
          );
          const inputString = ctx.message.text;
          const pushIndex = inputString.indexOf("/push");
          const titleStartIndex = inputString.indexOf("(", pushIndex) + 1;
          const titleEndIndex = inputString.indexOf(")", titleStartIndex);
          const title = inputString.slice(titleStartIndex, titleEndIndex);
          const messageStartIndex = inputString.indexOf(" ", titleEndIndex + 1);
          const message = inputString.slice(messageStartIndex);
          await Promise.race([
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Function execution timed out.")),
                7000
              )
            ),
            new Promise(async (resolve) => {
              async function sendPushbulletMessage() {
                return new Promise((resolve, reject) => {
                  const options = {
                    hostname: "api.pushbullet.com",
                    port: 443,
                    path: "/v2/pushes",
                    method: "POST",
                    headers: {
                      "Access-Token": accessToken,
                      "Content-Type": "application/json",
                    },
                  };
                  const data = JSON.stringify({
                    type: "note",
                    title: title,
                    body: message,
                  });

                  const req = https.request(options, (res) => {
                    let body = "";
                    res.on("data", (chunk) => {
                      body += chunk;
                    });
                    res.on("end", () => {
                      resolve(JSON.parse(body));
                    });
                  });

                  req.on("error", (error) => {
                    reject(error);
                  });

                  req.write(data);
                  req.end();
                });
              }
              (async () => {
                try {
                  const response = await sendPushbulletMessage();
                  if (response.active) {
                    await ctx.reply("*Message pushed successfully!*", {
                      parse_mode: "Markdown",
                    });
                  } else {
                    await ctx.reply(
                      "*Push unsuccessful. There was an error.*",
                      {
                        parse_mode: "Markdown",
                      }
                    );
                  }
                } catch (error) {
                  console.error(error);
                }
              })().then(() =>
                console.log(
                  `Function executed successfully from ${ctx.chat.id}`
                )
              );
              resolve();
            }),
          ]);
        }
      } catch (error) {
        if (error instanceof GrammyError) {
          if (
            error.message.includes("Forbidden: bot was blocked by the user")
          ) {
            console.log("Bot was blocked by the user");
          } else if (error.message.includes("Call to 'sendMessage' failed!")) {
            console.log("Error sending message: ", error);
            await ctx.reply(`*Error contacting Telegram.*`, {
              parse_mode: "Markdown",
              reply_to_message_id: ctx.message.message_id,
            });
          } else {
            await ctx.reply(`*An error occurred: ${error.message}*`, {
              parse_mode: "Markdown",
              reply_to_message_id: ctx.message.message_id,
            });
          }
          console.log(`Error sending message: ${error.message}`);
          return;
        } else {
          console.log(`An error occured:`, error);
          await ctx.reply(`*An error occurred.*\n_Error: ${error.message}_`, {
            parse_mode: "Markdown",
            reply_to_message_id: ctx.message.message_id,
          });
          return;
        }
      }
    }
  } else {
    await ctx.reply("*Channels are not supported presently.*", {
      parse_mode: "Markdown",
    });
  }
});

// Messages

bot.on("message", async (ctx) => {
  // Logging

  const from = ctx.from;
  const name =
    from.last_name === undefined
      ? from.first_name
      : `${from.first_name} ${from.last_name}`;
  console.log(
    `From: ${name} (@${from.username}) ID: ${from.id}\nMessage: ${ctx.message.text}`
  );

  // Logic
  if (!ctx.config.isDeveloper) {
    await ctx.reply("*Apologies! This bot isn't open to users yet.*", {
      reply_to_message_id: ctx.message.message_id,
      parse_mode: "Markdown",
    });
  } else {
    try {
      const statusMessage = await ctx.reply(`*Pushing*`, {
        parse_mode: "Markdown",
      });
      async function deleteMessageWithDelay(fromId, messageId, delayMs) {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            bot.api
              .deleteMessage(fromId, messageId)
              .then(() => resolve())
              .catch((error) => reject(error));
          }, delayMs);
        });
      }
      await deleteMessageWithDelay(ctx.chat.id, statusMessage.message_id, 3000);
      await Promise.race([
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Function execution timed out.")),
            7000
          )
        ),
        new Promise(async (resolve) => {
          async function sendPushbulletMessage() {
            return new Promise((resolve, reject) => {
              const options = {
                hostname: "api.pushbullet.com",
                port: 443,
                path: "/v2/pushes",
                method: "POST",
                headers: {
                  "Access-Token": accessToken,
                  "Content-Type": "application/json",
                },
              };
              const data = JSON.stringify({
                type: "note",
                title: "Message from Telegram",
                body: ctx.message.text,
              });

              const req = https.request(options, (res) => {
                let body = "";
                res.on("data", (chunk) => {
                  body += chunk;
                });
                res.on("end", () => {
                  resolve(JSON.parse(body));
                });
              });

              req.on("error", (error) => {
                reject(error);
              });

              req.write(data);
              req.end();
            });
          }
          (async () => {
            try {
              const response = await sendPushbulletMessage();
              if (response.active) {
                await ctx.reply("*Message pushed successfully!*", {
                  parse_mode: "Markdown",
                });
              } else {
                await ctx.reply("*Push unsuccessful. There was an error.*", {
                  parse_mode: "Markdown",
                });
              }
            } catch (error) {
              console.error(error);
            }
          })().then(() =>
            console.log(`Function executed successfully from ${ctx.chat.id}`)
          );
          resolve();
        }),
      ]);
    } catch (error) {
      if (error instanceof GrammyError) {
        if (error.message.includes("Forbidden: bot was blocked by the user")) {
          console.log("Bot was blocked by the user");
        } else if (error.message.includes("Call to 'sendMessage' failed!")) {
          console.log("Error sending message: ", error);
          await ctx.reply(`*Error contacting Telegram.*`, {
            parse_mode: "Markdown",
            reply_to_message_id: ctx.message.message_id,
          });
        } else {
          await ctx.reply(`*An error occurred: ${error.message}*`, {
            parse_mode: "Markdown",
            reply_to_message_id: ctx.message.message_id,
          });
        }
        console.log(`Error sending message: ${error.message}`);
        return;
      } else {
        console.log(`An error occured:`, error);
        await ctx.reply(`*An error occurred.*\n_Error: ${error.message}_`, {
          parse_mode: "Markdown",
          reply_to_message_id: ctx.message.message_id,
        });
        return;
      }
    }
  }
});

// Error

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(
    "Error while handling update",
    ctx.update.update_id,
    "\nQuery:",
    ctx.message.text
  );
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);
    if (e.description === "Forbidden: bot was blocked by the user") {
      console.log("Bot was blocked by the user");
    } else {
      ctx.reply("An error occurred");
    }
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
});

// Run

bot.start();
