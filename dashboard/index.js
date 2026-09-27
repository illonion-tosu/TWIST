import { createTosuWsSocket } from "../_shared/core/websocket.js"

const socket = createTosuWsSocket()
socket.onmessage = event => {
    const data = JSON.parse(event.data)
    console.log(data)
}