import express from "express";
import { WebSocketServer } from "ws";
import fs from "fs";
import fetch from "node-fetch";
import { fork } from "child_process";
import https from "https";
import urlData from "./data/urlData.mjs";

/* I am returning to this codebase after a while of not using it so I am about to comment it like crazy */

const app = express();
let connections = new Map();

app.use(express.json());

const servConfig = async () => {
  const certs = await fs.promises.readFile("./certs/certsPath.json", "utf8");
  const data = JSON.parse(certs);
  return {
    cert: fs.readFileSync(data.cert),
    key: fs.readFileSync(data.key),
  };
};

async function readFromFile(filePath) {
  try {
    const tokenJson = await fs.promises.readFile(filePath, "utf8");
    const token = JSON.parse(tokenJson);
    return token;
  } catch (error) {
    console.error("Error reading token from file:", error);
  }
}

async function saveTokenToFile(token, filePath) {
  try {
    // Convert the token object to a JSON string
    const tokenJson = JSON.stringify(token, null, 2); // Pretty-print with 2 spaces

    // Write the JSON string to the file
    await fs.promises.writeFile(filePath, tokenJson, "utf8");

    console.log("Token saved successfully to", filePath);
  } catch (error) {
    console.error("Error saving token to file:", error);
  }
}

const startServ = async () => {
  /* This is somewhat my first time messing with an https server. What I will say next is quite basic but I am writing just to learn/remember.
   the function below is to create the server, when the server is created, "response" sends a response to the client. "200" is a code for "Ok" and 
   'Hello HTTPS!' is just sending a string. I am mainly writing this to remember that "response" basically means respond to the client.
   response.end signals the end of the response so that the client is no longer awaiting a response.
  */
  let httpsServer;
  try {
    httpsServer = https.createServer(
      await servConfig(),
      (request, response) => {
        console.log("Server is starting...");
        response.writeHead(200);
        response.end("Hello HTTPS!");
      }
    );

    httpsServer.listen(3001, async () => {
      console.log("Server is listening on port 3001");
    });
  } catch (error) {
    console.error("Error starting server:", error);
  }

  const wss = new WebSocketServer({ server: httpsServer });

  wss.on("connection", (ws) => {
    // ws is the connection to the server, currently the frontend has a connection for authorization and for cleaning
    console.log(`new connection made from ${ws}!`);
    // Below, initilize the child process that will run clean.mjs
    let childProcesses = new Map();
    let counter = 0;
    //
    ws.on("message", async (message) => {
      // Below I try to unpack message as a Buffer to a string
      console.log("Message recieved: " + message + "\n");

      // Check if the message is a recieved message, I should look into how a break; or continue would effect ws.on.
      if (message == "Recieved") {
        console.log("reset success");
        counter = 0;
      }
      try {
        // I should make all of the message formats the same in the future, ideally with encryption
        message = message.toString("utf-8"); // Convert Buffer to UTF-8 string
      } catch (err) {
        console.log("Message is not in buffer format");
      }
      // If above fails I try to parse it as a json message
      try {
        message = JSON.parse(message);
      } catch (err) {
        console.log("Message is not in json format");
      }
      //
      try {
        // Try statement for determing what command/information the message inludes
        //
        if (message.proccess == "stop") {
          // Below, If the message is to stop the process then a message is sent to child to stop and a message is sent back to the client for conformation
          const childProcess = childProcesses.get(ws);
          try {
            childProcess.send({ command: "stop" }); // if the child proccess is allready stopped this for some reason crashes the server. add try statement after debugging ------!!!!!!!!!!!!!!!! CRASHES SERVER !!!!!!!!!!!!!
          } catch (err) {
            // Most likely because process was allready stopped, usually only comes up in development/debugging
            console.log(
              "Child process error while sending stop command: " + err
            );
          }
          ws.send(JSON.stringify({ data: "Proccess Stopped" }));
          console.log("Cancel Success");
          //
        } else if (message.type === "exchangeAuthCode") {
          // If the message if an authorazation code from google (I need to encrypt this in the future) then the code below will
          // proceed to read my credentials from the gCloudCreds.json I have
          console.log("Authorization message recieved");
          const { code } = message; // This is equivilent to const code = message.code

          const cloudCreds = await readFromFile("./data/gCloudCreds.json"); // this will be in .gitingore. This is reading my google console creds. It is very important they stay hidden
          const redirectUri = urlData.redirectUrl; // Google needs this for authentication. I will need to change this when I am no longer local

          const tokenUrl = "https://oauth2.googleapis.com/token"; // This is the Url used to get tokens from google

          // console.log(code);
          // console.log(ws);

          try {
            // This is the try statement for fetching the auth token from google, if the auth code sent from the client earlier is bad, this will fail
            const response = await fetch(tokenUrl, {
              /* This is the json structure needed for requesting a token, this is called when initilized. Later await is used befor response.json() because
            the .json method is supposedly asynchronous, not because it is waiting on on fetch/an http request. The fetch is ran on initilization */
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                code, // code sent from the client
                client_id: cloudCreds.client_id, // This is my personal google cloud id
                client_secret: cloudCreds.client_secret, // This is my personal client secret, it is VERY important I keep this secret
                redirect_uri: redirectUri, // google requires a redirectUri even though this is a backend server
                grant_type: "authorization_code",
                scope: [
                  "https://www.googleapis.com/auth/gmail.readonly", // I am requesting readonly and modify
                  "https://www.googleapis.com/auth/gmail.modify",
                ].join(" "),
              }),
            });
            // Below, is referencing response and using the .json() method to access and return the body as JSON,
            // suposedly it needs await because .json() is asynchronous (due to parsing taking time)
            const auth = await response.json();
            //
            if (!auth.error) {
              // Check the token for an error. If the token is good then the token is saved for when user starts cleaning -----(May want to change befor production)------

              // await saveTokenToFile(auth, "./data/token.json");
              connections.set(ws, auth);
            } else {
              /* If the token is bad, a message will be sent back to the client. 
            On the clients side the page will refresh the browser for a new code and send it back to the server */
              console.log(
                `\nSending a request back to the client\n ${auth.error}`
              );
              ws.send(JSON.stringify({ request: true })); // It may be worth removing potentially redundent "true"
            }
          } catch (error) {
            // If there was an error during this proccess, ideally there never will be
            console.error("Error exchanging code for tokens:", error);
          }
          //
        } else if (message.user) {
          // If the message contains the user parameter then that means it is sending over data for beginning clean ------ Make this more direct in the future ------
          // If the message contains the user parameter, basically checking if it contains the parameters for the "clean" child proccess
          //
          const { date, emails, unread, important } = message; // Before production I will probably wnat to make some way to verify the client is really who they say they are
          //
          // if (fs.existsSync("./data/token.json")) {
          if (connections.has(ws)) {
            // Above will cause errors later if the token connected to the ws is expired
            // check if the users authentication token was saved or ever recieved
            //
            const params = [date, emails, unread, important]; // unpack info for what to clean

            /* 
            Below, fork is used to create a child process so that the server can continue to send and recieve messages while the child process cleans the
            gmail. The fork function takes the script/proccess that will be run as a parameter and params.map((param) => JSON.stringify(param)) uses .map
            on params to go through params and apply the function to each parameter (JSON.stringify). This will create an aray of parameters in string form.
            The reason for this is that fork requires any arguments that are passed to be in string format and JSON.stringify makes the arguments easy to 
            unpack for the child process.
          */
            const child = fork("./Services/clean.mjs", [
              ...params.map((param) => JSON.stringify(param)), // fun use of ... to make sure .map makes element part of surrounding array and doesn't create a nested array
              JSON.stringify(connections.get(ws)),
            ]);

            childProcesses.set(ws, child);

            child.on("message", (childMessage) => {
              // Listen for "message" from child proccess
              // When the child process responds with an update, that update will be sent to the frontend
              // console.log("Message from child:", childMessage);
              ws.send(JSON.stringify({ data: childMessage }));
              if (counter == 5) {
                child.send({ command: "stop" }); // I need to make this better in the future by confirming that the child process got the message.
              }
              counter += 1;
              /* I am going to make it so when the front end hears from the backend, it sends back a recieved message, if the backend misses X "recieved"
               messages in a row then the child proccess will terminate. On the front end the logic will be like if(message && cleanGmail){send recieved}
               I am doing this in the case that the user stops the proccess but the stop message falls through
              */
            });
          } else {
            // logic for new token.
            /* This is the logic for getting the a new token if the current one doesn't exist
            as you can see, this code does not exist yet... */
          }
        }
      } catch (err) {
        console.error(`Unable to determine message: ${err}`);
      }
    });
  });
  // Log server errors/attempted conction errors
  wss.on("error", (err) => {
    console.log(`Reported error: ${err}`);
  });
};

startServ();
