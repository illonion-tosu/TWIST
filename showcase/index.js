import { loadShowcaseBeatmaps } from "../_shared/core/beatmaps.js"

function setRoundName(name) {
    const text = document.getElementById("round-name")

    const maxWidth = 350
    const words = name.split(" ")
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

    // Rebuild the text using tspans.
    text.textContent = ""

    const lineYs = {
        1: [62.5],
        2: [45, 80],
    }

    lines.forEach((line, index) => {
        const tspan = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "tspan"
        )

        tspan.setAttribute("x", "210")
        tspan.setAttribute("y", lineYs[lines.length][index])
        tspan.textContent = line

        text.appendChild(tspan)
    })
}

// Load beatmaps
let allBeatmaps = []
loadShowcaseBeatmaps().then(beatmaps => {
    setRoundName(beatmaps.roundName)
})

ComfyJS.Init( "osuANZT", null, "osuANZT" )

// Twitch Chat
const twitchChatContainer = document.getElementById("chatbox-container")
ComfyJS.onChat = ( user, message, flags, self, extra ) => {

    // Get rid of nightbot messages
    if (user === "Nightbot") return

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
    twitchChatContainer.scrollTop = twitchChatContainer.scrollHeight
}

// Delete message
ComfyJS.onMessageDeleted = (id, extra) => document.getElementById(id).remove()

// Timeout
ComfyJS.onTimeout = ( timedOutUsername, durationInSeconds, extra ) => deleteAllMessagesFromUser(extra.timedOutUserId)

// Ban
ComfyJS.onBan = (bannedUsername, extra) => deleteAllMessagesFromUser(extra.bannedUserId)

// Delete all messages from user
function deleteAllMessagesFromUser(twitchId) {
    const allTwitchChatMessages = Array.from(document.getElementsByClassName("twitchChatMessage"))
    allTwitchChatMessages.forEach((message) => {
        if (message.dataset.twitchId === twitchId) {
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

        // Guard clauses
        if (r + g + b <= 384) validColour = true
        if (g > (r + b) * 0.8) continue
    }

    chatColours[username] = {"r": r, "g": g, "b": b}
}