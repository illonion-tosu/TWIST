import { loadBeatmaps } from "../_shared/core/beatmaps.js"
import { createTosuWsSocket } from "../_shared/core/websocket.js"

// Round Name
const roundNameEl = document.getElementById("round-name")
let roundName

// Max HP
let maxHp
let playerData = {
    player1: {
        id: 123456,
        currentMaxHp: 300000,
        currentHp: 300000
    },
    player2: {
        id: 123456,
        currentMaxHp: 300000,
        currentHp: 300000
    },
    player3: {
        id: 123456,
        currentMaxHp: 300000,
        currentHp: 300000
    },
    player4: {
        id: 123456,
        currentMaxHp: 300000,
        currentHp: 300000
    },
    player5: {
        id: 123456,
        currentMaxHp: 300000,
        currentHp: 300000
    },
    player6: {
        id: 123456,
        currentMaxHp: 300000,
        currentHp: 300000
    },
}

loadBeatmaps().then(beatmaps => {
    // Set Round Name
    roundName = beatmaps.roundName
    roundNameEl.textContent = roundName

    // Set Max HP
    switch (roundName.toLowerCase()) {
        case "round of 16": case "ro16":
            maxHp = 300000
            break
        case "quarterfinals": case "quarter finals": case "qf":
            maxHp = 400000
            break
        case "semifinals": case "sf": case "semi finals":
            maxHp = 500000
            break
        case "finals": case "f": case "gf": case "grand finals":
            maxHp = 600000
            break
    }

    // Set all player's current max hp
    for (const key in playerData) {
        playerData[key].currentMaxHp = maxHp
        // playerData[key].currentHp = maxHp
    }
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
        maxHp: maxHp,
        playerData: playerData,
        roundName: roundName
    }

    localStorage.setItem("data", JSON.stringify(savedInfo))
}, 100)