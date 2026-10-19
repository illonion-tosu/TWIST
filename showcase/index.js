import { constants } from "../_shared/js/constants.js"
import { findShowcaseBeatmap, loadShowcaseBeatmaps } from "../_shared/core/beatmaps.js"
import { delay, getModColourVar } from "../_shared/core/utils.js"
import { createTosuWsSocket } from "../_shared/core/websocket.js"
import {
    getNowPlayingElements,
    setNowPlayingMetadata,
    setNowPlayingStatsFromTosu,
} from "../_shared/core/overlay.js"

// ─────────────────────────────────────────────────────────────
// Round name
// ─────────────────────────────────────────────────────────────

// Wrap the round name over (at most) 2 lines of the SVG <text>
function setRoundName(name) {
    const text = document.getElementById("round-name")

    const words = String(name ?? "").split(" ").filter(Boolean)
    const lines = []
    let currentLine = ""

    // Temporarily put text on the SVG so getComputedTextLength() works.
    text.textContent = ""

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        text.textContent = testLine

        if (text.getComputedTextLength() <= constants.SHOWCASE_ROUND_NAME_MAX_WIDTH) {
            currentLine = testLine
        } else {
            if (currentLine) lines.push(currentLine)
            currentLine = word
        }
    }
    if (currentLine) lines.push(currentLine)

    // Rebuild the text using tspans. Only 1 and 2 line layouts exist, so anything longer is cut off.
    text.textContent = ""

    const lineYs = constants.SHOWCASE_ROUND_NAME_LINE_YS
    const maxLines = Object.keys(lineYs).length
    const visibleLines = lines.slice(0, maxLines)
    if (lines.length > maxLines) {
        visibleLines[maxLines - 1] = visibleLines[maxLines - 1].replace(/\s*$/, "") + "..."
    }

    visibleLines.forEach((line, index) => {
        const tspan = document.createElementNS(constants.SVG_NS, "tspan")
        tspan.setAttribute("x", constants.SHOWCASE_ROUND_NAME_X)
        tspan.setAttribute("y", lineYs[visibleLines.length][index])
        tspan.textContent = line
        text.appendChild(tspan)
    })
}

loadShowcaseBeatmaps()
    .then(beatmaps => setRoundName(beatmaps.roundName))
    .catch(error => console.error("Could not load showcase beatmaps:", error))

// ─────────────────────────────────────────────────────────────
// Twitch chat
// ─────────────────────────────────────────────────────────────
const twitchChatContainer = document.getElementById("chatbox-container")
const chatColours = {}

// Random colour per user: not too bright and not too green
function getChatColour(username) {
    if (chatColours[username]) return chatColours[username]

    let r, g, b
    do {
        r = Math.floor(Math.random() * 256)
        g = Math.floor(Math.random() * 256)
        b = Math.floor(Math.random() * 256)
    } while (!(
        r + g + b <= constants.CHAT_COLOUR_MAX_BRIGHTNESS &&
        g <= (r + b) * constants.CHAT_COLOUR_MAX_GREEN_RATIO
    ))

    chatColours[username] = `rgb(${r}, ${g}, ${b})`
    return chatColours[username]
}

function deleteAllMessagesFromUser(twitchId) {
    for (const message of twitchChatContainer.querySelectorAll(".chatbox-message")) {
        if (message.dataset.twitchId === String(twitchId)) message.remove()
    }
}

ComfyJS.Init(constants.TWITCH_CHANNEL, null, constants.TWITCH_CHANNEL)

ComfyJS.onChat = (user, message, flags, self, extra) => {
    // Get rid of bot messages
    if (constants.TWITCH_IGNORED_USERS.includes(user.toLowerCase())) return

    // Message container
    const messageContainer = document.createElement("div")
    messageContainer.classList.add("chatbox-message")
    messageContainer.setAttribute("id", extra.id)
    messageContainer.setAttribute("data-twitch-id", extra.userId)

    // Message user
    const messageUser = document.createElement("div")
    messageUser.classList.add("chatbox-name")
    messageUser.innerText = `${user}:`
    messageUser.style.color = getChatColour(user)

    // Message
    const chatMessage = document.createElement("div")
    chatMessage.classList.add("chatbox-content")
    chatMessage.innerText = message

    messageContainer.append(messageUser, chatMessage)
    twitchChatContainer.append(messageContainer)

    // Don't let the overlay grow forever during a long stream
    while (twitchChatContainer.children.length > constants.MAX_CHAT_MESSAGES) {
        twitchChatContainer.firstElementChild.remove()
    }
    twitchChatContainer.scrollTop = twitchChatContainer.scrollHeight
}

ComfyJS.onMessageDeleted = id => document.getElementById(id)?.remove()
ComfyJS.onTimeout = extra => deleteAllMessagesFromUser(extra.timedOutUserId)
ComfyJS.onBan = extra => deleteAllMessagesFromUser(extra.bannedUserId)

// ─────────────────────────────────────────────────────────────
// Now playing (straight from tosu)
// ─────────────────────────────────────────────────────────────
const nowPlayingEls = getNowPlayingElements()
let currentId, currentChecksum
let updateStats = false

const socket = createTosuWsSocket()
socket.onmessage = async event => {
    const data = JSON.parse(event.data)

    const beatmapData = data.beatmap
    if (beatmapData && (currentId !== beatmapData.id || currentChecksum !== beatmapData.checksum)) {
        currentId = beatmapData.id
        currentChecksum = beatmapData.checksum

        setNowPlayingMetadata(nowPlayingEls, beatmapData, data.directPath)

        // Mod info
        const showcaseBeatmap = findShowcaseBeatmap(beatmapData.title, beatmapData.version, beatmapData.mapper, beatmapData.id)
        if (showcaseBeatmap) {
            const label = showcaseBeatmap.label ?? showcaseBeatmap.modId ?? ""
            const mod = showcaseBeatmap.mod ?? label.replace(/\d+$/, "")
            nowPlayingEls.mod.style.backgroundColor = getModColourVar(showcaseBeatmap.isTiebreaker ? "TB" : mod)
            nowPlayingEls.mod.textContent = label
        } else {
            nowPlayingEls.mod.style.backgroundColor = "gray"
            nowPlayingEls.mod.textContent = ""
        }

        await delay(constants.STATS_DELAY_MS)
        updateStats = true
    }

    // Stats from tosu
    if (updateStats && data.beatmap?.stats) {
        updateStats = false
        setNowPlayingStatsFromTosu(nowPlayingEls, data.beatmap.stats)
    }
}
