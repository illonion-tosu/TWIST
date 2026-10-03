// Log Tosu Socket Events
function registerSocketEventLoggers(socket) {
    socket.onopen = () => { console.log("Successfully Connected"); };
    socket.onclose = event => { console.log("Socket Closed Connection: ", event); socket.send("Client Closed!"); };
    socket.onerror = error => { console.log("Socket Error: ", error); };
}

// Create Tosu Web Socket
export function createTosuWsSocket(path = "/websocket/v2") {
    let socket = new ReconnectingWebSocket("ws://" + location.host + path);
    registerSocketEventLoggers(socket);
    return socket;
}