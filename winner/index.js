import { readSavedData, startPolling } from "../_shared/core/utils.js"

// Winner
let currentWinnerSide, previousWinnerSide

// Round Name
const roundNameEl = document.getElementById("round-name-WINNER")
let currentRoundName

// Winner Name
const winnerNameEl = document.getElementById("winner-name")
let currentRedTeamName, currentBlueTeamName, teamsChanged = false

// Chibis
const PLACEHOLDER_CHIBI = "static/placeholder chibi.png"
const chibiWrapperEl = document.getElementById("chibi-wrapper")

// Player Names
const MAX_NAME_LINES = 2

// Chibis are static/chibis/<osu id>.png. Not everyone has one, so fall back to the placeholder instead of a broken image.
function setChibi(imageEl, playerId) {
    imageEl.onerror = () => {
        imageEl.onerror = null
        imageEl.setAttribute("src", PLACEHOLDER_CHIBI)
    }
    imageEl.setAttribute("src", `static/chibis/${playerId}.png`)
}

function getData() {
    const data = readSavedData()

    // The dashboard hasn't saved anything yet
    if (!data || !data.playerData || !data.teamName) return

    // Round Name (the "ROUND NAME WINNER" placeholder was never replaced before)
    if (currentRoundName !== data.roundName) {
        currentRoundName = data.roundName
        roundNameEl.textContent = currentRoundName ? `${currentRoundName} WINNER` : ""
    }

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

    // Set and compare winner sides. On an exact tie keep whoever was showing, so the page doesn't flip around.
    if (currentRedMaxHp === currentBlueMaxHp) {
        currentWinnerSide = previousWinnerSide ?? "red"
    } else {
        currentWinnerSide = currentRedMaxHp > currentBlueMaxHp ? "red" : "blue"
    }

    if (previousWinnerSide !== currentWinnerSide || teamsChanged) {
        previousWinnerSide = currentWinnerSide

        // Set Team Name
        winnerNameEl.textContent = (currentWinnerSide === "red" ? currentRedTeamName : currentBlueTeamName) ?? ""

        // Set information on winning team
        const players = currentWinnerSide === "red" ? [playerData.player1, playerData.player2, playerData.player3] : [playerData.player4, playerData.player5, playerData.player6]

        // Chibi Wrapper
        for (let i = 0; i < players.length; i++) {
            setChibi(chibiWrapperEl.children[i].children[0], players[i].id)
            setPlayerName(i + 1, players[i].playerName ?? "")
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
                }
                chunk = char
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

    // Only 1 and 2 line layouts exist (a 3rd line used to throw because lineYs[3] is undefined)
    const lineYs = {
        1: [260],
        2: [235, 285]
    }

    const visibleLines = lines.slice(0, MAX_NAME_LINES)
    if (!visibleLines.length) return

    // Names that need more lines are cut off with "..."
    if (lines.length > MAX_NAME_LINES) {
        let last = visibleLines[MAX_NAME_LINES - 1]
        while (last.length > 0 && !fits(`${last}...`)) last = last.slice(0, -1)
        visibleLines[MAX_NAME_LINES - 1] = `${last.trimEnd()}...`
        text.textContent = ""
    }

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

startPolling(getData, 100)
