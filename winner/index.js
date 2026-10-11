function schedule() {
    const now = Date.now()
    const delay = 100 - (now % 100)

    setTimeout(() => {
        getData()
        schedule()
    }, delay)
}

schedule()

// Max HP Variables
let currentWinnerSide, previousWinnerSide

// Winner Name
const winnerNameEl = document.getElementById("winner-name")
let currentRedTeamName, currentBlueTeamName, teamsChanged = false

// Chibis
const chibiWrapperEl = document.getElementById("chibi-wrapper")

// Player Names
const playerNameEls = [
    document.getElementById("player-1-name"),
    document.getElementById("player-2-name"),
    document.getElementById("player-3-name")
]

async function getData() {
    const data = JSON.parse(localStorage.getItem("data"))
    console.log(data)
    teamsChanged = false

    // Compare team names
    const teamNames = data.teamName
    if (currentRedTeamName !== teamNames.redTeamName) {
        currentRedTeamName = teamNames.redTeamName
        teamsChanged = true
    }
    if (currentBlueTeamName !== teamNames.blueTeamName) {
        currentBlueTeamName = teamNames.blueTeamName
        teamsChanged = true
    }

    // Set current max HP for both teams
    const playerData = data.playerData
    const currentRedMaxHp = playerData.player1.currentMaxHp + playerData.player2.currentMaxHp + playerData.player3.currentMaxHp
    const currentBlueMaxHp = playerData.player4.currentMaxHp + playerData.player5.currentMaxHp + playerData.player6.currentMaxHp

    // Set and compare winner sides
    currentWinnerSide = currentRedMaxHp > currentBlueMaxHp ? "red" : "blue"
    if (previousWinnerSide !== currentWinnerSide || teamsChanged) {
        previousWinnerSide = currentWinnerSide

        // Set Team Name
        winnerNameEl.textContent = currentWinnerSide === "red" ? currentRedTeamName : currentBlueTeamName

        // Set information on winning team
        const players = currentWinnerSide === "red" ? [playerData.player1, playerData.player2, playerData.player3] : [playerData.player4, playerData.player5, playerData.player6]

        // Chibi Wrapper
        for (let i = 0; i < players.length; i++) {
            chibiWrapperEl.children[i].children[0].setAttribute("src", `static/chibis/${players[i].id}.png`)
            playerNameEls[i].textContent = players[i].playerName
            setPlayerName(i + 1, players[i].playerName)
        }
    }
}

function setPlayerName(playerNumber, name) {
    const text = document.getElementById(`player-${playerNumber}-name`)

    const maxWidth = 330
    const lines = []
    let currentLine = ""

    const fits = (str) => {
        text.textContent = str
        return text.getComputedTextLength() <= maxWidth
    }

    // Splits a too-long word into chunks that each fit on a line.
    // Returns the leftover chunk (which becomes the new current line).
    const breakWord = (word) => {
        let chunk = ""

        for (const char of word) { // for...of handles emoji/surrogate pairs
            if (fits(chunk + char)) {
                chunk += char
            } else {
                // Guard: if even a single char doesn't fit, still place it
                // to avoid an infinite loop / empty lines
                if (chunk) {
                    lines.push(chunk)
                    chunk = char
                } else {
                    chunk = char
                }
            }
        }

        return chunk
    }

    const words = name.split(" ").filter(Boolean)

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word

        if (fits(testLine)) {
            currentLine = testLine
            continue
        }

        // Doesn't fit on the current line: push it and start fresh
        if (currentLine) {
            lines.push(currentLine)
            currentLine = ""
        }

        if (fits(word)) {
            currentLine = word
        } else {
            // Word alone is too wide: break it mid-word
            currentLine = breakWord(word)
        }
    }

    if (currentLine) {
        lines.push(currentLine)
    }

    text.textContent = ""

    const lineYs = {
        1: [260],
        2: [235, 285]
    }

    // Only 3 positions are defined, so keep the last 3 lines at most
    const visibleLines = lines.slice(0, 3)

    visibleLines.forEach((line, index) => {
        const tspan = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "tspan"
        )

        tspan.setAttribute("x", "183")
        tspan.setAttribute("y", lineYs[visibleLines.length][index])
        tspan.textContent = line

        text.appendChild(tspan)
    })
}