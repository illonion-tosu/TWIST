import { constants } from "../js/constants.js"

// Log Tosu Socket Events
function registerSocketEventLoggers(socket) {
    socket.onopen = () => { console.log("Successfully Connected"); };
    socket.onclose = event => { console.log("Socket Closed Connection: ", event); };
    socket.onerror = error => { console.log("Socket Error: ", error); };
}

// Create Tosu Web Socket
export function createTosuWsSocket(path = constants.TOSU_WS_PATH) {
    const protocol = location.protocol === "https:" ? "wss://" : "ws://";
    const socket = new ReconnectingWebSocket(protocol + location.host + path);
    registerSocketEventLoggers(socket);
    return socket;
}
