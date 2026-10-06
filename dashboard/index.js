import { loadBeatmaps } from "../_shared/core/beatmaps.js"
import { createTosuWsSocket } from "../_shared/core/websocket.js"

// Round Name
const roundNameEl = document.getElementById("round-name")
let roundName

// Beatmaps
let allBeatmaps = []

// Current picker
let currentPicker = "red"

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

// Mappool Select Container
const mappoolSelectContainerEl = document.getElementById("mappool-select-container")

loadBeatmaps().then(beatmaps => {
    // Set Round Name
    roundName = beatmaps.roundName
    roundNameEl.textContent = roundName
    allBeatmaps = beatmaps.beatmaps

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

    mappoolSelectContainerEl.innerHTML = ""
    allBeatmaps.map(beatmap => {
        const button = document.createElement("button")
        button.classList.add("mappool-select-button")
        button.textContent = `${beatmap.mod}${beatmap.order}`
        button.setAttribute("id", beatmap.beatmap_id)
        button.addEventListener("mousedown", mapClickEvent)
        button.addEventListener("contextmenu", event => event.preventDefault())
        mappoolSelectContainerEl.append(button)
    })
})

// Map Click Event
let redBan = []
let redPick = []
let blueBan = []
let bluePick = []
function mapClickEvent(event) {
    // Team
    let team
    if (event.button === 0) team = "red"
    else if (event.button === 2) team = "blue"
    if (!team) return

    // Action
    let action = "pick"
    if (event.ctrlKey) action = "ban"
    if (event.shiftKey) action = "clear"

    // Filter it out of everything first
    redBan = redBan.filter(id => id !== this.getAttribute("id"))
    redPick = redPick.filter(id => id !== this.getAttribute("id"))
    blueBan = blueBan.filter(id => id !== this.getAttribute("id"))
    bluePick = bluePick.filter(id => id !== this.getAttribute("id"))

    // Remove all related classes to it
    this.classList.remove("mappool-select-button-red-ban")
    this.classList.remove("mappool-select-button-blue-ban")
    this.classList.remove("mappool-select-button-red-pick")
    this.classList.remove("mappool-select-button-blue-pick")

    // Add elements + classes
    if (team === "red" && action === "ban") {
        redBan.push(this.getAttribute("id"))
        this.classList.add("mappool-select-button-red-ban")
    }
    if (team === "red" && action === "pick") {
        redPick.push(this.getAttribute("id"))
        this.classList.add("mappool-select-button-red-pick")
    }
    if (team === "blue" && action === "ban") {
        blueBan.push(this.getAttribute("id"))
        this.classList.add("mappool-select-button-blue-ban")
    }
    if (team === "blue" && action === "pick") {
        bluePick.push(this.getAttribute("id"))
        this.classList.add("mappool-select-button-blue-pick")
    }
}

// IPC State
let previousIpcState, currentIpcState
let checkedWinner = false

// Mappool Map Found
let mappoolMapFound = false
let mappoolMapModId
let currentBeatmap

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

    // Mappool Map Found
    currentBeatmap = allBeatmaps.find(beatmap => Number(beatmap.beatmap_id) === Number(socketData.beatmap.id))
    if (currentBeatmap) {
        mappoolMapFound = true
        mappoolMapModId = `${currentBeatmap.mod.toUpperCase()}${currentBeatmap.order}`
    }

    console.log(socketData)
}

setInterval(() => {
    // Save information
    const savedInfo = {
        tosuData: socketData,
        maxHp: maxHp,
        playerData: playerData,
        roundName: roundName,
        mappoolInfo: {
            mappoolMapFound: mappoolMapFound,
            mappoolMapModId: mappoolMapModId,
            currentPicker: currentPicker,
            currentBeatmap: currentBeatmap
        },
        allBeatmaps: allBeatmaps,
        pickBanInfo: {
            redBan: redBan,
            redPick: redPick,
            blueBan: blueBan,
            bluePick: bluePick
        }
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