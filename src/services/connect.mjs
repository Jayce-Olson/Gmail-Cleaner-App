import { EventEmitter } from "events";
import { sendAuth } from "../auth/authenticate.mjs";
import urlData from "../data/urlData.mjs";
// export const eventBus = reactive({
//   listeners: {},
//   on(event, callback) {
//     if (!this.listeners[event]) {
//       this.listeners[event] = [];
//     }
//     this.listeners[event].push(callback);
//   },
//   emit(event, data) {
//     if (this.listeners[event]) {
//       this.listeners[event].forEach((callback) => callback(data));
//     }
//   },
// });

let socket;
let eventBus;

/* I need to refine this file much more in the future, currently I have the webInit function that starts the connection and it seems the start
    message is sent to the server through the socket that is created here. It also seems that this is what listens for data about gmails being
    sent. 

    There is another function though, the other function is used specifically for exchanging the authorization code. I am  not sure why I
    orignally did this, I will probably change it in the future. For right now I am going to leave it and try to possibly improve its security
    with some encryption.

*/

const bus = () => {
  eventBus = new EventEmitter();
};

function webInit(code) {
  // This is the function that starts the connection between the frontend and the backend, this connection deals with non-authorization communication
  socket = new WebSocket(urlData.wssServer); // Replace url with ip address/domain of backend
  // Below will allow me to send data to be updated on the homepage,
  // after gaining experience with angular and react I imagine vue has some sort of hook for this but this works for now

  socket.onopen = () => {
    socket.send(JSON.stringify({ type: "exchangeAuthCode", code }));
  };

  socket.onmessage = async function (event) {
    console.log("Socket Message recieved: ", event.data);
    let message = event.data;
    try {
      // Try to parse and read data
      try {
        message = JSON.parse(message); // Try to parse message
      } catch (err) {
        console.error("Failed to parse message as JSON");
      }
      if (message.data) {
        // Set the local preview to the email value recieved
        localStorage.setItem("localPreview", JSON.stringify(message.data)); // First time using any framework so rather than look into potential hooks for vue (there may not be idk) I set the localStorage.
        // console.log(localStorage.getItem("localPreview"));
        eventBus.emit("updateData", message + "/n"); // Emit the message. I not sure why I originally did this, I would like to mess around with this alter as it seems I allready use local storage
        console.log(socket.inProcess);
        if (socket.inProcess) {
          // if inProcess is true
          socket.send("Recieved");
        }
      } else if (message.request == true) {
        // request new authorization id
        console.log(`Type request recieved!: ${message}`);
        await sendAuth();
      }
    } catch (err) {
      console.log(err);
    }
  };
  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
    console.error("Error details:", {
      type: error.type,
      target: error.target,
      readyState: error.target.readyState,
      timeStamp: error.timeStamp,
    });
  };
}

function getPreview() {
  return JSON.parse(localStorage.getItem("localPreview"));
}

export { webInit, socket, getPreview, eventBus, bus };
