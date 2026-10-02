import { loadBeatmaps } from "../_shared/core/beatmaps.js"
import { createTosuWsSocket } from "../_shared/core/websocket.js"

// Round Name
const roundNameEl = document.getElementById("round-name")
let roundName

loadBeatmaps().then(beatmaps => {
    roundName = beatmaps.roundName
    roundNameEl.textContent = roundName
})

const socket = createTosuWsSocket()
let socketData
socket.onmessage = event => {
    socketData = JSON.parse(event.data)
    console.log(socketData)
}

setInterval(() => {
    // Save information
    const savedInfo = {
        tosuData: socketData,
        roundName: roundName
    }

    localStorage.setItem("data", JSON.stringify(savedInfo))
}, 100)