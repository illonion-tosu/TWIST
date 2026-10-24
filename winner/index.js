import { constants } from "../_shared/js/constants.js"
import { fitSVGText, readSavedData, startPolling } from "../_shared/core/utils.js"
import { isPresent, playersOf } from "../_shared/core/match.js"

// Winner
let currentWinnerSide, previousWinnerSide

// Round name
const roundNameEl = document.getElementById("round-name-WINNER")
let currentRoundName

// Winner name
const winnerNameEl = document.getElementById("winner-name")
const currentTeamNames = { red: undefined, blue: undefined }

// Chibis
const chibiWrapperEl = document.getElementById("chibi-wrapper")

// Chibis are static/chibis/<osu id>.png. Not everyone has one, so fall back to the placeholder instead of a broken image.
function setChibi(imageEl, playerId) {
    imageEl.onerror = () => {
        imageEl.onerror = null
        imageEl.setAttribute("src", constants.PLACEHOLDER_CHIBI)
    }
    imageEl.setAttribute("src", `${constants.CHIBI_FOLDER}/${playerId}.png`)
}

// Total max HP of a side
const getSideMaxHp = (playerData, side) =>
    playersOf(side).reduce((total, n) => total + playerData[`player${n}`].currentMaxHp, 0)

function getData() {
    const data = readSavedData()

    // The dashboard hasn't saved anything yet
    if (!data || !data.playerData || !data.teamName) return

    // Round name
    if (currentRoundName !== data.roundName) {
        currentRoundName = data.roundName
        roundNameEl.textContent = currentRoundName ? `${currentRoundName} WINNER` : ""
    }

    // Compare team names
    let teamsChanged = false
    const teamNames = { red: data.teamName.redTeamName, blue: data.teamName.blueTeamName }
    for (const side of constants.SIDES) {
        if (currentTeamNames[side] !== teamNames[side]) {
            currentTeamNames[side] = teamNames[side]
            teamsChanged = true
        }
    }

    // Winner = side with the most HP left. On an exact tie keep whoever was showing, so the page doesn't flip around.
    const playerData = data.playerData
    const redMaxHp = getSideMaxHp(playerData, "red")
    const blueMaxHp = getSideMaxHp(playerData, "blue")

    if (data.api?.winner === "red" || data.api?.winner === "blue") {
        // The API says who won
        currentWinnerSide = data.api.winner
    } else if (redMaxHp === blueMaxHp) {
        currentWinnerSide = previousWinnerSide ?? "red"
    } else {
        currentWinnerSide = redMaxHp > blueMaxHp ? "red" : "blue"
    }

    if (previousWinnerSide === currentWinnerSide && !teamsChanged) return
    previousWinnerSide = currentWinnerSide

    // Team name
    winnerNameEl.textContent = currentTeamNames[currentWinnerSide] ?? ""
    fitSVGText(winnerNameEl, constants.WINNER_TEAM_NAME_MAX_WIDTH)

    // Chibis + player names of the winning team
    const winners = playersOf(currentWinnerSide).map(n => playerData[`player${n}`])
    winners.forEach((player, i) => {
        // A 2-player team only shows 2 chibis
        const present = isPresent(player)
        chibiWrapperEl.children[i].style.display = present ? "" : "none"
        document.getElementById(`player-${i + 1}-name`).closest("svg").style.display = present ? "" : "none"
        if (!present) {
            setPlayerName(i + 1, "")
            return
        }
        setChibi(chibiWrapperEl.children[i].children[0], player.id)
        setPlayerName(i + 1, player.playerName ?? "")
    })
}

// Wrap a player name over (at most) 2 lines of the SVG <text>
function setPlayerName(playerNumber, name) {
    const text = document.getElementById(`player-${playerNumber}-name`)

    const lines = []
    let currentLine = ""

    const fits = str => {
        text.textContent = str
        return text.getComputedTextLength() <= constants.WINNER_NAME_MAX_WIDTH
    }

    // Splits a too-long word into chunks that each fit on a line.
    // Returns the leftover chunk (which becomes the new current line).
    const breakWord = word => {
        let chunk = ""

        for (const char of word) { // for...of handles emoji/surrogate pairs
            if (fits(chunk + char)) {
                chunk += char
            } else {
                // If even a single char doesn't fit, still place it to avoid empty lines
                if (chunk) lines.push(chunk)
                chunk = char
            }
        }

        return chunk
    }

    for (const word of name.split(" ").filter(Boolean)) {
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

        // Word alone is too wide: break it mid-word
        currentLine = fits(word) ? word : breakWord(word)
    }

    if (currentLine) lines.push(currentLine)

    text.textContent = ""

    // Only 1 and 2 line layouts exist
    const maxLines = constants.WINNER_NAME_MAX_LINES
    const visibleLines = lines.slice(0, maxLines)
    if (!visibleLines.length) return

    // Names that need more lines are cut off with "..."
    if (lines.length > maxLines) {
        let last = visibleLines[maxLines - 1]
        while (last.length > 0 && !fits(`${last}...`)) last = last.slice(0, -1)
        visibleLines[maxLines - 1] = `${last.trimEnd()}...`
        text.textContent = ""
    }

    visibleLines.forEach((line, index) => {
        const tspan = document.createElementNS(constants.SVG_NS, "tspan")
        tspan.setAttribute("x", constants.WINNER_NAME_X)
        tspan.setAttribute("y", constants.WINNER_NAME_LINE_YS[visibleLines.length][index])
        tspan.textContent = line
        text.appendChild(tspan)
    })
}

startPolling(getData)
