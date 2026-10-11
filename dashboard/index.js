import { loadBeatmaps } from "../_shared/core/beatmaps.js"
import { findTeam, loadTeams } from "../_shared/core/teams.js"
import { createTosuWsSocket } from "../_shared/core/websocket.js"

// Round Name
const roundNameEl = document.getElementById("round-name")
let roundName

// Beatmaps
let allBeatmaps = []

// Select next picker
const autoPickButtonEl = document.getElementById("auto-pick-button")
const nextPickerEl = document.getElementById("next-picker")
const selectNextPickerButtonRedEl = document.getElementById("select-next-picker-button-red")
const selectNextPickerButtonBlueEl = document.getElementById("select-next-picker-button-blue")
const selectNextPickerButtonNoneEl = document.getElementById("select-next-picker-button-none")
let nextPicker = "red"

function setNextPicker(team) {
    nextPickerEl.textContent = `Current: ${team}`
    nextPicker = team.toLowerCase()
}

// current picker
const currentPickerEl = document.getElementById("current-picker")
const selectCurrentPickerButtonRedEl = document.getElementById("select-current-picker-button-red")
const selectCurrentPickerButtonBlueEl = document.getElementById("select-current-picker-button-blue")
const selectCurrentPickerButtonNoneEl = document.getElementById("select-current-picker-button-none")
let currentPicker = "blue"

function setCurrentPicker(team) {
    currentPickerEl.textContent = `Current: ${team}`
    currentPicker = team.toLowerCase()
}

// Toggle HP
const toggleHpEl = document.getElementById("toggle-hp-button")

// Auto OBS Button
const autoObsButtonEl = document.getElementById("auto-obs-button")

// Max HP
let maxHp
let playerData = {
    player1: {
        id: 123456,
        playerName: "",
        currentMaxHp: 300000,
        currentScore: 0,
        currentTarget: 6,
        currentScoreAgainst: 0,
        currentDeadRounds: 0,
    },
    player2: {
        id: 123456,
        playerName: "",
        currentMaxHp: 300000,
        currentScore: 0,
        currentTarget: 5,
        currentScoreAgainst: 0,
        currentDeadRounds: 0,
    },
    player3: {
        id: 123456,
        playerName: "",
        currentMaxHp: 300000,
        currentScore: 0,
        currentTarget: 4,
        currentScoreAgainst: 0,
        currentDeadRounds: 0,
    },
    player4: {
        id: 123456,
        playerName: "",
        currentMaxHp: 300000,
        currentScore: 0,
        currentTarget: 3,
        currentScoreAgainst: 0,
        currentDeadRounds: 0,
    },
    player5: {
        id: 123456,
        playerName: "",
        currentMaxHp: 300000,
        currentScore: 0,
        currentTarget: 2,
        currentScoreAgainst: 0,
        currentDeadRounds: 0,
    },
    player6: {
        id: 123456,
        playerName: "",
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

    // Set all input values to max hp
    for (let i = 0; i < teamHpIOnputNumberElements.length; i++) {
        teamHpIOnputNumberElements[i].value = maxHp
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
        currentPicker = team
    }
    if (team === "blue" && action === "ban") {
        blueBan.push(this.getAttribute("id"))
        this.classList.add("mappool-select-button-blue-ban")
    }
    if (team === "blue" && action === "pick") {
        bluePick.push(this.getAttribute("id"))
        this.classList.add("mappool-select-button-blue-pick")
        currentPicker = team
    }
}

// Class abilities
const teamClass = { red: "", blue: "" }
const abilities = {
    human: {
        red: { lucky: false, poolSize: 0 },
        blue: { lucky: false, poolSize: 0 },
    },
    demigod: null,    // { player, mode, target }, cleared after every map
    soulweaver: null, // { challenger, challenged }, cleared after every map
}

const DEMIGOD_MULTIPLIERS = { 3: 4, 2: 3, 1: 2 } // keyed by opponents alive
const SOULWEAVER_CHALLENGED_MULTIPLIER = 1.4

const classPanelsEl = document.getElementById("class-panels")

const sideOf = playerNumber => playerNumber <= 3 ? "red" : "blue"

function buildClassPanel(side) {
    const colour = `team-${side}-colour`
    const select = (id, scope) =>
        `<select class="class-player-select" id="${id}" data-side="${side}" data-scope="${scope}"></select>`
    const row = (label, control) => `
        <div class="team-hp-container">
            <div class="team-hp ${colour}">${label}</div>
            ${control}
        </div>`
    const checkbox = (id, label, perMap = false) => `
        <label class="auto-labels">
            <input type="checkbox" id="${id}" class="${perMap ? "per-map-ability" : ""}">
            <span>${label}</span>
        </label>`

    return `
        <div class="class-panel">
            <div class="class-panel-title ${colour}" id="class-title-${side}"></div>

            <div class="team-hp-wrapper" id="class-wrapper-${side}" hidden>
                <div class="team-hp-wrapper-left">
                    <div class="class-controls" id="class-controls-${side}-human" hidden>
                        ${checkbox(`human-${side}-lucky`, "Lucky!")}
                        ${row("Maps before Lucky!:", `<input type="number" id="human-${side}-pool" min="0" value="0">`)}
                    </div>

                    <div class="class-controls" id="class-controls-${side}-demigod" hidden>
                        ${checkbox(`demigod-${side}-active`, "Go solo this map", true)}
                        ${row("Demigod:", select(`demigod-${side}-player`, "own"))}
                        ${row("Mode:", `<select id="demigod-${side}-mode"><option value="split">Split</option><option value="target">Target</option></select>`)}
                        ${row("Target:", select(`demigod-${side}-target`, "opp"))}
                    </div>

                    <div class="class-controls" id="class-controls-${side}-soulweaver" hidden>
                        ${checkbox(`soulweaver-${side}-active`, "Duel this map", true)}
                        ${row("Challenger:", select(`soulweaver-${side}-challenger`, "own"))}
                        ${row("Challenged:", select(`soulweaver-${side}-challenged`, "opp"))}
                    </div>
                </div>
                <button class="team-hp-button class-submit-button" id="class-activation-button-${side}">
                    Submit
                </button>
            </div>
        </div>`
}

classPanelsEl.innerHTML = ["red", "blue"].map(buildClassPanel).join("")

// Fill every player select (value = player number 1-6, text = player name)
function refreshClassSelects() {
    document.querySelectorAll(".class-player-select").forEach(select => {
        const side = select.dataset.side
        const teamSide = select.dataset.scope === "own" ? side : (side === "red" ? "blue" : "red")
        const offset = teamSide === "red" ? 0 : 3
        const previous = select.value

        select.innerHTML = ""
        for (let i = 1; i <= 3; i++) {
            const option = document.createElement("option")
            option.value = offset + i
            option.textContent = playerData[`player${offset + i}`].playerName || `Player ${offset + i}`
            select.append(option)
        }
        if (previous) select.value = previous
    })
}
refreshClassSelects()

// Show only the controls for this team's class
function updateClassPanel(side, className) {
    teamClass[side] = className.toLowerCase()
    document.getElementById(`${side}-class`).textContent = className
    document.getElementById(`class-title-${side}`).textContent =
        `${side === "red" ? "Red" : "Blue"}: ${className}`

    for (const type of ["human", "demigod", "soulweaver"]) {
        document.getElementById(`class-controls-${side}-${type}`).hidden = teamClass[side] !== type
    }
}

// Read the controls into `abilities`
function setClassButton() {
    abilities.demigod = null
    abilities.soulweaver = null

    for (const side of ["red", "blue"]) {
        const className = teamClass[side]
        const value = id => document.getElementById(id).value
        const checked = id => document.getElementById(id).checked

        if (className === "human") {
            const mapsBefore = Math.max(0, Number(value(`human-${side}-pool`)) || 0)
            abilities.human[side] = {
                lucky: checked(`human-${side}-lucky`),
                poolSize: mapsBefore + 1,
            }
        }

        if (className === "demigod" && checked(`demigod-${side}-active`)) {
            abilities.demigod = {
                player: Number(value(`demigod-${side}-player`)),
                mode: value(`demigod-${side}-mode`),
                target: Number(value(`demigod-${side}-target`)),
            }
        }

        if (className === "soulweaver" && checked(`soulweaver-${side}-active`)) {
            abilities.soulweaver = {
                challenger: Number(value(`soulweaver-${side}-challenger`)),
                challenged: Number(value(`soulweaver-${side}-challenged`)),
            }
        }
    }
}

// Demigod / Soulweaver only last one map. Human's Lucky! stays.
function resetMapAbilities() {
    abilities.demigod = null
    abilities.soulweaver = null
    document.querySelectorAll(".per-map-ability").forEach(el => { el.checked = false })
}

// Lucky! bonus: 1 number = 77.7%, -7% per extra number, floor 7.7%
function getLuckyBonus(poolSize) {
    return Math.max(7.7, 77.7 - 7 * (Math.max(1, poolSize) - 1)) / 100
}

function countAlive(side) {
    const numbers = side === "red" ? [1, 2, 3] : [4, 5, 6]
    return numbers.filter(n => playerData[`player${n}`].currentMaxHp > 0).length
}

function getScoreMultiplier(playerNumber) {
    const side = sideOf(playerNumber)
    let multiplier = 1

    // Human: permanent bonus for the whole team once Lucky!
    if (teamClass[side] === "human" && abilities.human[side].lucky) {
        multiplier *= 1 + getLuckyBonus(abilities.human[side].poolSize)
    }

    // Soulweaver: challenged player gets 1.4x
    if (abilities.soulweaver?.challenged === playerNumber) {
        multiplier *= SOULWEAVER_CHALLENGED_MULTIPLIER
    }

    // Demigod: multiplier depends on opponents alive
    if (abilities.demigod?.player === playerNumber) {
        const opponentSide = side === "red" ? "blue" : "red"
        multiplier *= DEMIGOD_MULTIPLIERS[countAlive(opponentSide)] ?? 1
    }

    return multiplier
}

// Lower effective score loses. Tie = nobody loses.
function getDuelLoser() {
    const duel = abilities.soulweaver
    if (!duel) return null

    const challengerScore = playerData[`player${duel.challenger}`].effectiveScore
    const challengedScore = playerData[`player${duel.challenged}`].effectiveScore
    if (challengerScore === challengedScore) return null

    return challengerScore > challengedScore
        ? `player${duel.challenged}`
        : `player${duel.challenger}`
}

// Load Teams
let allTeams = []
loadTeams().then(teams => { allTeams = teams })

// Change Teams
function changeTeams(teamName, side) {
    // Find team
    const currentTeam = findTeam(teamName)
    if (!currentTeam) return

    // Class panel + reset Human state for this side
    updateClassPanel(side, currentTeam.class ?? "")
    abilities.human[side] = { lucky: false, poolSize: 0 }
    document.getElementById(`human-${side}-lucky`).checked = false
    document.getElementById(`human-${side}-pool`).value = 0

    // Set up arrays
    let currentPlayers = []
    let teamHpPlayerElements = []
    let teamMapTargetSelectionPlayerElements = []
    let teamMapTargetSelectionPlayerSelectElements = []
    if (side === "red") {
        currentPlayers.push(playerData.player1, playerData.player2, playerData.player3)
        teamHpPlayerElements.push(
            document.getElementById("team-hp-player-1"),
            document.getElementById("team-hp-player-2"),
            document.getElementById("team-hp-player-3")
        )
        teamMapTargetSelectionPlayerElements.push(
            document.getElementById("map-target-selection-player-1"),
            document.getElementById("map-target-selection-player-2"),
            document.getElementById("map-target-selection-player-3")
        )
        teamMapTargetSelectionPlayerSelectElements.push(
            document.getElementById("map-target-selection-player-4-select"),
            document.getElementById("map-target-selection-player-5-select"),
            document.getElementById("map-target-selection-player-6-select")
        )
    } else {
        currentPlayers.push(playerData.player4, playerData.player5, playerData.player6)
        teamHpPlayerElements.push(
            document.getElementById("team-hp-player-4"),
            document.getElementById("team-hp-player-5"),
            document.getElementById("team-hp-player-6")
        )
        teamMapTargetSelectionPlayerElements.push(
            document.getElementById("map-target-selection-player-4"),
            document.getElementById("map-target-selection-player-5"),
            document.getElementById("map-target-selection-player-6")
        )
        teamMapTargetSelectionPlayerSelectElements.push(
            document.getElementById("map-target-selection-player-1-select"),
            document.getElementById("map-target-selection-player-2-select"),
            document.getElementById("map-target-selection-player-3-select")
        )
    }

    // Set playersx
    for (let i = 0; i < currentPlayers.length; i++) {
        const currentPlayer = currentTeam[`player${i + 1}`]
        const currentPlayerId = currentPlayer.id
        const currentPlayerName = currentPlayer.playerName
        currentPlayers[i].id = currentPlayerId
        currentPlayers[i].playerName = currentPlayerName

        teamHpPlayerElements[i].textContent = currentPlayerName
        teamMapTargetSelectionPlayerElements[i].textContent = currentPlayerName

        // Fill each select's options with the matching team player
        // Value = player number (1-6), since that's what currentTarget uses
        const playerNumberOffset = side === "red" ? 0 : 3
        const options = teamMapTargetSelectionPlayerSelectElements[i].children
        for (let j = 0; j < options.length; j++) {
            const optionPlayer = currentTeam[`player${j + 1}`]
            if (!optionPlayer) continue
            options[j].textContent = optionPlayer.playerName
            options[j].value = playerNumberOffset + j + 1
        }
    }

    refreshClassSelects()
    syncTargetSelects()
}

// Team HP Button
const teamHpButtonEl = document.getElementById("team-hp-button")
const teamHpIOnputNumberElements = [
    document.getElementById("team-hp-input-number-player-1"),
    document.getElementById("team-hp-input-number-player-2"),
    document.getElementById("team-hp-input-number-player-3"),
    document.getElementById("team-hp-input-number-player-4"),
    document.getElementById("team-hp-input-number-player-5"),
    document.getElementById("team-hp-input-number-player-6")
]

function setHpButton() {
    for (let i = 0; i < teamHpIOnputNumberElements.length; i++) {
        playerData[`player${i + 1}`].currentMaxHp = Number(teamHpIOnputNumberElements[i].value)
    }
}

// Map Target Button
const mapTargetButtonEl = document.getElementById("map-target-button")
const targetSelectElements = [1, 2, 3, 4, 5, 6].map(i =>
    document.getElementById(`map-target-selection-player-${i}-select`)
)

function setTargetButton() {
    targetSelectElements.forEach((el, i) => {
        const value = Number(el.value)
        // Ignore placeholder options that haven't been filled with a player yet
        if (Number.isNaN(value)) return
        playerData[`player${i + 1}`].currentTarget = value
    })
}

// Make dropdowns reflect what's actually in playerData
function syncTargetSelects() {
    targetSelectElements.forEach((el, i) => {
        const target = String(playerData[`player${i + 1}`].currentTarget)
        if ([...el.options].some(option => option.value === target)) {
            el.value = target
        }
    })
}

// IPC State
let previousIpcState, currentIpcState
let checkedWinner = false

// Mappool Map Found
let currentId, currentChecksum
let mappoolMapFound = false
let mappoolMapModId
let currentBeatmap

// Team Names
const teamRedNameEl = document.getElementById("team-red-name")
const teamBlueNameEl = document.getElementById("team-blue-name")
let redTeamName, blueTeamName

// Current map info
const currentMapEl = document.getElementById("current-map")
const currentModIdEl = document.getElementById("current-mod-id")

// Socket
const socket = createTosuWsSocket()
let socketData
socket.onmessage = event => {
    socketData = JSON.parse(event.data)

    // Team Names
    const teamNames = socketData.tourney.team
    if (allTeams &&
        (redTeamName !== teamNames.left ||
        blueTeamName !== teamNames.right
    )) {
        if (redTeamName !== teamNames.left) {
            redTeamName = teamNames.left
            changeTeams(redTeamName, "red")
        }

        if (blueTeamName !== teamNames.right) {
            blueTeamName = teamNames.right
            changeTeams(blueTeamName, "blue")
        }
    }

    // Set score against information
    if (currentIpcState !== socketData.tourney.ipcState) {
        previousIpcState = currentIpcState
        currentIpcState = socketData.tourney.ipcState
        
        // Calculate scores
        if ((currentIpcState === 2 || currentIpcState === 3 || currentIpcState === 4) && toggleHpEl.checked) {
            checkedWinner = false
            updatePlayerData(playerData, socketData)

            if (autoObsButtonEl.checked) {
                changeScene("Gameplay")
            }
        }

        // Reset information
        if (currentIpcState === 1 && previousIpcState === 4 && !checkedWinner) {
            checkedWinner = true
        
            if (toggleHpEl.checked) {
                applyDamage(playerData)
            
                if (autoObsButtonEl.checked) {
                    changeScene("Mappool")
                }
            }
        }
    }

    // Keep scores updating live while the map is being played
    if ((currentIpcState === 2 || currentIpcState === 3 || currentIpcState === 4) && toggleHpEl.checked) {
        updatePlayerData(playerData, socketData)
    }


    if ((currentId !== socketData.beatmap.id || currentChecksum !== socketData.beatmap.checksum) && allBeatmaps) {
        currentId = socketData.beatmap.id
        currentChecksum = socketData.beatmap.checksum

        currentBeatmap = allBeatmaps.find(beatmap => Number(beatmap.beatmap_id) === Number(socketData.beatmap.id))
        currentMapEl.textContent = `${socketData.beatmap.artist} - ${socketData.beatmap.title}`

        // Autopicking
        if (currentBeatmap && autoPickButtonEl.checked && currentPicker !== "none") {
            const targetElement = document.getElementById(`${currentId}`)
            const event = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window,
                button: nextPicker === "red" ? 0 : 2
            })
            targetElement.dispatchEvent(event)
            setCurrentPicker(nextPicker)
            setNextPicker(nextPicker === "red" ? 'Blue' : 'Red')
        }

        // Mappool map found
        if (currentBeatmap) {
            mappoolMapFound = true
            mappoolMapModId = `${currentBeatmap.mod.toUpperCase()}${currentBeatmap.order}`
            currentModIdEl.textContent = mappoolMapModId
        } else {
            currentModIdEl.textContent = ""
        }
    }
}

// Apply damage
function applyDamage(playerData) {
    // Decide the duel from final scores before anything is reset
    const duelLoser = getDuelLoser()

    Object.entries(playerData).forEach(([playerKey, player], i) => {
        const wasAlive = player.currentMaxHp > 0

        player.currentMaxHp = Math.max(0, Math.round(player.currentMaxHp - player.currentScoreAgainst))

        if (wasAlive && playerKey === duelLoser) {
            // Lost the duel: dies, returns at 50% of round max HP
            // (checked first so a duel loser who also hits 0 from damage still gets 50%)
            player.currentMaxHp = 0
            player.currentDeadRounds = 2
            player.reviveHp = Math.round(maxHp * 0.5)
        } else if (wasAlive && player.currentMaxHp === 0) {
            // Died to damage: returns at 30% of round max HP
            player.currentDeadRounds = 2
            player.reviveHp = null
        } else if (player.currentDeadRounds > 0) {
            player.currentDeadRounds--

            if (player.currentDeadRounds === 0) {
                // Duel losers return at 50%, everyone else at 30% of round max HP
                player.currentMaxHp = player.reviveHp ?? Math.round(maxHp * 0.3)
                player.reviveHp = null
            }
        }

        // Damage is committed, so clear it
        player.currentScore = 0
        player.effectiveScore = 0
        player.currentScoreAgainst = 0

        teamHpIOnputNumberElements[i].value = player.currentMaxHp
    })

    resetMapAbilities()
}

setInterval(() => {
    teamRedNameEl.textContent = redTeamName
    teamBlueNameEl.textContent = blueTeamName

    // Save information
    const savedInfo = {
        tosuData: socketData,
        maxHp: maxHp,
        playerData: playerData,
        roundName: roundName,
        teamName: {
            redTeamName: redTeamName,
            blueTeamName: blueTeamName
        },
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
        },
        toggleHp: toggleHpEl.checked
    }

    localStorage.setItem("data", JSON.stringify(savedInfo))
}, 100)


function updatePlayerData(playerData, data) {
    // Raw scores
    Object.values(playerData).forEach(player => {
        const client = data.tourney.clients.find(
            client => client.user.id === player.id
        )

        player.currentScore = client?.play.score ?? 0
    })

    // Effective scores (class bonuses applied, Demigod's teammates sit out)
    Object.entries(playerData).forEach(([playerKey, player]) => {
        const playerNumber = Number(playerKey.replace("player", ""))
        const demigod = abilities.demigod
        const satOut = demigod
            && sideOf(playerNumber) === sideOf(demigod.player)
            && playerNumber !== demigod.player

        player.effectiveScore = satOut ? 0 : player.currentScore * getScoreMultiplier(playerNumber)
    })

    // Reset damage, then build it up
    Object.values(playerData).forEach(player => { player.currentScoreAgainst = 0 })

    if (abilities.demigod) {
        setDemigodDamage()
    } else {
        setStandardDamage()
    }
}

function setStandardDamage() {
    Object.entries(playerData).forEach(([playerKey, player]) => {
        const playerNumber = Number(playerKey.replace("player", ""))

        const teamKeys = playerNumber <= 3
            ? ["player1", "player2", "player3"]
            : ["player4", "player5", "player6"]

        const alivePlayers = teamKeys.filter(key => playerData[key].currentMaxHp > 0)
        const isLastAlive = alivePlayers.length === 1 && player.currentMaxHp > 0

        // Alive players targeting this player
        const attackers = Object.values(playerData).filter(
            other => other.currentTarget === playerNumber && other.currentMaxHp > 0
        )
        if (!attackers.length) return

        const totalScore = attackers.reduce((sum, attacker) => sum + attacker.effectiveScore, 0)

        // Last alive on their team: cumulative
        if (isLastAlive) {
            player.currentScoreAgainst += totalScore
            return
        }

        const averageScore = totalScore / attackers.length
        const ownScore = player.effectiveScore

        if (averageScore > ownScore) {
            // Attackers out-score the target: target takes the difference
            player.currentScoreAgainst += averageScore - ownScore
        } else if (ownScore > averageScore && attackers.length >= 2) {
            // Target out-scores the attackers: only hits one of its own attackers (head-on)
            const targetPlayer = playerData[`player${player.currentTarget}`]
            if (attackers.includes(targetPlayer)) {
                targetPlayer.currentScoreAgainst += ownScore - averageScore
            }
        }
    })
}

function setDemigodDamage() {
    const { player: demigodNumber, mode, target } = abilities.demigod
    const opponentNumbers = sideOf(demigodNumber) === "red" ? [4, 5, 6] : [1, 2, 3]

    const demigodScore = playerData[`player${demigodNumber}`].effectiveScore
    const opponentTotal = opponentNumbers.reduce(
        (sum, n) => sum + playerData[`player${n}`].effectiveScore, 0
    )

    if (demigodScore > opponentTotal) {
        // Demigod wins: opponents take the difference
        const difference = demigodScore - opponentTotal

        if (mode === "target") {
            playerData[`player${target}`].currentScoreAgainst = difference
        } else {
            const alive = opponentNumbers.filter(n => playerData[`player${n}`].currentMaxHp > 0)
            alive.forEach(n => {
                playerData[`player${n}`].currentScoreAgainst = difference / alive.length
            })
        }
    } else if (opponentTotal > demigodScore) {
        // Opponents win: the Demigod takes the difference
        playerData[`player${demigodNumber}`].currentScoreAgainst = opponentTotal - demigodScore
    }
}

document.addEventListener("DOMContentLoaded", () => {
    selectNextPickerButtonRedEl.addEventListener("click", () => setNextPicker("Red"))
    selectNextPickerButtonBlueEl.addEventListener("click", () => setNextPicker("Blue"))
    selectNextPickerButtonNoneEl.addEventListener("click", () => setNextPicker("None"))
    selectCurrentPickerButtonRedEl.addEventListener("click", () => setCurrentPicker("Red"))
    selectCurrentPickerButtonBlueEl.addEventListener("click", () => setCurrentPicker("Blue"))
    selectCurrentPickerButtonNoneEl.addEventListener("click", () => setCurrentPicker("None"))
    teamHpButtonEl.addEventListener("click", () => setHpButton())
    mapTargetButtonEl.addEventListener("click", () => setTargetButton())
    document.getElementById("class-activation-button-red").addEventListener("click", () => setClassButton("red"))
    document.getElementById("class-activation-button-blue").addEventListener("click", () => setClassButton("blue"))
})

// OBS stuff
const obs = new OBSWebSocket()
const OBS_ADDRESS = 'ws://127.0.0.1:4455'
const sceneButtonsEl = document.getElementById('scene-buttons')

// Connect to OBS WebSocket
obs.connect(OBS_ADDRESS)
    .then(() => {
        refreshScenes()
        setupListeners()
    })
    .catch(err => {
        console.error('Connection failed:', err)
    })

// Fetch scenes and populate buttons
async function refreshScenes() {
    try {
        // Request the full scene list from OBS
        const response = await obs.call('GetSceneList')
        const scenes = response.scenes
        const currentProgramScene = response.currentProgramSceneName

        // Clear any existing buttons
        sceneButtonsEl.innerHTML = ''

        // Generate a button for each scene (reversing order if you want it to match OBS layout top-to-bottom)
        scenes.reverse().forEach(scene => {
            const btn = document.createElement('button')
            btn.className = 'team-hp-button'
            btn.innerText = scene.sceneName
                    
            // Highlight the currently active scene
            if (scene.sceneName === currentProgramScene) {
                btn.classList.add('active-hp-button')
            }

            // Click event to switch scene
            btn.addEventListener("click", () => changeScene(scene.sceneName))
            sceneButtonsEl.appendChild(btn)
        })
    } catch (error) {
        console.error('Failed to grab scene list:', error)
    }
}

// Send command to switch scene
async function changeScene(sceneName) {
    try {
        await obs.call('SetCurrentProgramScene', { sceneName: sceneName })
    } catch (error) {
        console.error('Failed to change scene:', error)
    }
}

// Listen for live events so the dock updates if things change inside OBS
function setupListeners() {
    // Update active button color when scene changes
    obs.on('CurrentProgramSceneChanged', (data) => {
        document.querySelectorAll('#scene-buttons .team-hp-button').forEach(btn => {
            btn.classList.toggle('active-hp-button', btn.innerText === data.sceneName)
        })
    })

    // Rebuild the buttons entirely if a scene is added, removed, or collection changes
    obs.on('SceneListChanged', refreshScenes)
}