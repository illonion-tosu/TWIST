import { createTosuWsSocket } from "../_shared/core/websocket.js"

// Team Hp
const teamRedHpEl = document.getElementById("team-red-hp")
const teamBlueHpEl = document.getElementById("team-blue-hp")
let teamRedStartingHp = 0, teamBlueStartingHp = 0

const socket = createTosuWsSocket()
socket.onmessage = event => {
    const data = JSON.parse(event.data)
    console.log(data)

    // Save information
    const savedInfo = {
        tosuData: data,
        hp: {
            red: teamRedStartingHp,
            blue: teamBlueStartingHp
        }
    }
}