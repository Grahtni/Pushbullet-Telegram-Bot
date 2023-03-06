require("dotenv").config();

const https = require("https");
const accessToken = process.env.ACCESS_TOKEN;

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
      title: "Test message",
      body: "This is a test message sent using the Pushbullet API",
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
    console.log(response.active);
  } catch (error) {
    console.error(error);
  }
})();
