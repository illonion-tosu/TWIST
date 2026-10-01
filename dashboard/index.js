import { createTosuWsSocket } from "../_shared/core/websocket.js"

// Team Points
const teamRedPointsEl = document.getElementById("team-red-points")
const teamBluePointsEl = document.getElementById("team-blue-points")
let teamRedPoints = 0, teamBluePoints = 0

const socket = createTosuWsSocket()
socket.onmessage = event => {
    const data = JSON.parse(event.data)
    console.log(data)

    // Save information
    const savedInfo = {
        tosuData: data,
        points: {
            red: teamRedPoints,
            blue: teamBluePoints
        }
    }
}