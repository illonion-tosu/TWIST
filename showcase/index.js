import { findShowcaseBeatmap, loadShowcaseBeatmaps } from "../_shared/core/beatmaps.js"
import { delay } from "../_shared/core/utils.js"
import { createTosuWsSocket } from "../_shared/core/websocket.js"

function setRoundName(name) {
    const text = document.getElementById("round-name")

    const maxWidth = 350
    const words = String(name ?? "").split(" ").filter(Boolean)
    const lines = []
    let currentLine = ""

    // Temporarily put text on the SVG so getComputedTextLength() works.
    text.textContent = ""

    for (const word of words) {
        const testLine = currentLine
            ? `${currentLine} ${word}`
            : word

        text.textContent = testLine

        if (text.getComputedTextLength() <= maxWidth) {
            currentLine = testLine
        } else {
            if (currentLine) {
                lines.push(currentLine)
            }

            currentLine = word
        }
    }

    if (currentLine) {
        lines.push(currentLine)
    }

    // Rebuild the text using tspans. Only 1 and 2 line layouts exist, so anything longer is cut off.
    text.textContent = ""

    const lineYs = {
        1: [62.5],
        2: [45, 80],
    }

    const visibleLines = lines.slice(0, 2)
    if (lines.length > 2) {
        visibleLines[1] = visibleLines[1].replace(/\s*$/, "") + "..."
    }

    visibleLines.forEach((line, index) => {
        const tspan = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "tspan"
        )

        tspan.setAttribute("x", "210")
        tspan.setAttribute("y", lineYs[visibleLines.length][index])
        tspan.textContent = line

        text.appendChild(tspan)
    })
}

// Load beatmaps
loadShowcaseBeatmaps().then(beatmaps => {
    setRoundName(beatmaps.roundName)
}).catch(error => console.error("Could not load showcase beatmaps:", error))

ComfyJS.Init( "purlstournaments", null, "purlstournaments" )

// Twitch Chat
const twitchChatContainer = document.getElementById("chatbox-container")
const MAX_CHAT_MESSAGES = 100
ComfyJS.onChat = ( user, message, flags, self, extra ) => {

    // Get rid of nightbot messages
    if (user.toLowerCase() === "nightbot") return

    // Set up message container
    const twitchChatMessageContainer = document.createElement("div")
    twitchChatMessageContainer.classList.add("chatbox-message")
    twitchChatMessageContainer.setAttribute("id", extra.id)
    twitchChatMessageContainer.setAttribute("data-twitch-id", extra.userId)

    // Message user
    const messageUser = document.createElement("div")
    messageUser.classList.add("chatbox-name")
    messageUser.innerText = `${user}:`

    if (!chatColours[user]) generateChatColour(user)
    let chatColour = chatColours[user]
    messageUser.style.color = `rgb(${chatColour.r}, ${chatColour.g}, ${chatColour.b})`

    // Message
    const chatMessage = document.createElement("div")
    chatMessage.classList.add("chatbox-content")
    chatMessage.innerText = message

    // Append everything together
    twitchChatMessageContainer.append(messageUser, chatMessage)
    twitchChatContainer.append(twitchChatMessageContainer)

    // Don't let the overlay grow forever during a long stream
    while (twitchChatContainer.children.length > MAX_CHAT_MESSAGES) {
        twitchChatContainer.firstElementChild.remove()
    }
    twitchChatContainer.scrollTop = twitchChatContainer.scrollHeight
}

// Delete message
ComfyJS.onMessageDeleted = (id) => document.getElementById(id)?.remove()

// Timeout
ComfyJS.onTimeout = (extra) => deleteAllMessagesFromUser(extra.timedOutUserId)

// Ban
ComfyJS.onBan = (extra) => deleteAllMessagesFromUser(extra.bannedUserId)

// Delete all messages from user
function deleteAllMessagesFromUser(twitchId) {
    const allTwitchChatMessages = Array.from(twitchChatContainer.getElementsByClassName("chatbox-message"))
    allTwitchChatMessages.forEach((message) => {
        if (message.dataset.twitchId === String(twitchId)) {
            message.remove()
        }
    })
}

// Generate Colour
let chatColours = {}
function generateChatColour(username) {
    let r, g, b
    let validColour = false

    while (!validColour) {
        r = Math.floor(Math.random() * 256)
        g = Math.floor(Math.random() * 256)
        b = Math.floor(Math.random() * 256)

        // Not too bright and not too green
        validColour = r + g + b <= 384 && g <= (r + b) * 0.8
    }

    chatColours[username] = {"r": r, "g": g, "b": b}
}

// Now Playing Info
const nowPlayingBackgroundEl = document.getElementById("now-playing-background")
const nowPlayingModEl = document.getElementById("now-playing-mod")
const nowPlayingArtistTitleEl = document.getElementById("now-playing-artist-title")
const nowPlayingVersionEl = document.getElementById("now-playing-version")
const nowPlayingStatsCsEl = document.getElementById("now-playing-stats-cs")
const nowPlayingStatsArEl = document.getElementById("now-playing-stats-ar")
const nowPlayingStatsOdEl = document.getElementById("now-playing-stats-od")
const nowPlayingStatsSrEl = document.getElementById("now-playing-stats-sr")
let currentId, currentChecksum, updateStats = false

// Socket
const socket = createTosuWsSocket()
socket.onmessage = async event => {
    const data = JSON.parse(event.data)

    // Now Playing Information
    const beatmapData = data.beatmap
    if (beatmapData && (currentId !== beatmapData.id || currentChecksum !== beatmapData.checksum)) {
        currentId = beatmapData.id
        currentChecksum = beatmapData.checksum

        // Metadata
        const background = data.directPath?.beatmapBackground
        if (background) {
            const url = `${window.location.origin}/Songs/${background}`
            const fixedUrl = encodeURI(url.replaceAll("\\", "/"))
            nowPlayingBackgroundEl.style.backgroundImage = `url("${fixedUrl}")`
        } else {
            nowPlayingBackgroundEl.style.backgroundImage = "none"
        }
        nowPlayingArtistTitleEl.textContent = `${beatmapData.artist} - ${beatmapData.title}`
        nowPlayingVersionEl.textContent = `[${beatmapData.version}]`

        // Mod info
        const showcaseBeatmap = findShowcaseBeatmap(beatmapData.title, beatmapData.version, beatmapData.mapper)
        if (showcaseBeatmap) {
            nowPlayingModEl.style.backgroundColor = `var(--${showcaseBeatmap.modId.replace(/\d+$/, '').toLowerCase()}-colour)`
            nowPlayingModEl.textContent = showcaseBeatmap.modId
        } else {
            nowPlayingModEl.style.backgroundColor = `gray`
            nowPlayingModEl.textContent = ""
        }

        await delay(250)
        updateStats = true
    }

    // Update Stats
    if (updateStats && data.beatmap?.stats) {
        const tosuStats = data.beatmap.stats
        updateStats = false
        nowPlayingStatsCsEl.textContent = `CS: ${Number(tosuStats.cs.converted).toFixed(1)}`
        nowPlayingStatsArEl.textContent = `AR: ${Number(tosuStats.ar.converted).toFixed(1)}`
        nowPlayingStatsOdEl.textContent = `OD: ${Number(tosuStats.od.converted).toFixed(1)}`
        nowPlayingStatsSrEl.textContent = `SR: ${Number(tosuStats.stars.total).toFixed(2)}`
    }
}