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
        currentScore: 0,
        currentTarget: 6,
        currentScoreAgainst: 0,
        currentDeadRounds: 0,
    },
    player2: {
        id: 123456,
        currentMaxHp: 300000,
        currentScore: 0,
        currentTarget: 5,
        currentScoreAgainst: 0,
        currentDeadRounds: 0,
    },
    player3: {
        id: 123456,
        currentMaxHp: 300000,
        currentScore: 0,
        currentTarget: 4,
        currentScoreAgainst: 0,
        currentDeadRounds: 0,
    },
    player4: {
        id: 123456,
        currentMaxHp: 300000,
        currentScore: 0,
        currentTarget: 3,
        currentScoreAgainst: 0,
        currentDeadRounds: 0,
    },
    player5: {
        id: 123456,
        currentMaxHp: 300000,
        currentScore: 0,
        currentTarget: 2,
        currentScoreAgainst: 0,
        currentDeadRounds: 0,
    },
    player6: {
        id: 123456,
        currentMaxHp: 300000,
        currentScore: 0,
        currentTarget: 1,
        currentScoreAgainst: 0,
        currentDeadRounds: 0,
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
    }
})

// IPC State
let previousIpcState, currentIpcState
let checkedWinner = false

// Socket
const socket = createTosuWsSocket()
let socketData
socket.onmessage = event => {
    socketData = JSON.parse(event.data)

    // Set score against information
    if (currentIpcState !== socketData.tourney.ipcState) {
        previousIpcState = currentIpcState
        currentIpcState = socketData.tourney.ipcState
        
        // Calculate scores
        if (currentIpcState === 2 || currentIpcState === 3 || currentIpcState === 4) {
            checkedWinner = false
            updatePlayerData(playerData, socketData)
        }

        // Reset information
        if (currentIpcState === 1 && previousIpcState === 4 && !checkedWinner) {
            checkedWinner === true
        }
    }
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


function updatePlayerData(playerData, data) {
    // Update currentScore
    Object.values(playerData).forEach(player => {
        const client = data.tourney.clients.find(
            client => client.user.id === player.id
        )

        player.currentScore = client?.play.score ?? 0
    })

    // Update currentScoreAgainst
    Object.entries(playerData).forEach(([playerKey, player]) => {
        const playerNumber = Number(playerKey.replace("player", ""))

        const targeters = Object.values(playerData).filter(
            otherPlayer => otherPlayer.currentTarget === playerNumber
        )

        player.currentScoreAgainst = targeters.length
            ? targeters.reduce(
                (sum, targeter) => sum + targeter.currentScore,
                0
            ) / targeters.length
            : 0
    })
}