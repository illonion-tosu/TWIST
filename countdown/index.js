import { constants } from "../_shared/js/constants.js"
import { deepEqual, getModDetails, readSavedData, startPolling } from "../_shared/core/utils.js"


// DOM Elements
const elements = {
    countdown: {
        minutes: document.getElementById("minutes-number"),
        seconds: document.getElementById("seconds-number"),
        errorMessage: document.getElementById("timer1-error-message"),
    },
    utc: {
        hours: document.getElementById("hours-number-utc"),
        minutes: document.getElementById("minutes-number-utc"),
        errorMessage: document.getElementById("timer2-error-message"),
    },
    display: {
        minutes: document.querySelectorAll(".timer-minutes"),
        seconds: document.querySelectorAll(".timer-seconds"),
    },
}

/**
 * Updates the SVG timer display.
 *
 * @param {number} totalSeconds - Total number of seconds
 */
function updateDisplay(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const minuteText = hours >= 1
        ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
        : String(minutes).padStart(2, "0")

    const secondText = String(seconds).padStart(2, "0")

    elements.display.minutes.forEach((element) => {
        element.textContent = minuteText
    })

    elements.display.seconds.forEach((element) => {
        element.textContent = secondText
    })
}

/**
 * Shows one timer's error message and hides the other.
 * Call with no argument to hide both.
 *
 * @param {HTMLElement} [errorEl] - The error element to display.
 */
function showError(errorEl) {
    elements.countdown.errorMessage.style.display = errorEl === elements.countdown.errorMessage ? "block" : "none"
    elements.utc.errorMessage.style.display = errorEl === elements.utc.errorMessage ? "block" : "none"
}

const hideErrors = () => showError()

// Countdown Timer
class CountdownTimer {
    constructor() {
        this.active = false
        this.remainingSeconds = 0
    }

    /**
     * Sets the countdown time from inputs and immediately starts the timer.
     */
    setAndStart() {
        this.setTime()
        this.start()
    }

    /**
     * Reads the countdown inputs and updates the remaining time
     *
     * Supports decimal minute input
     * Updates the timer display immediately
     */
    setTime() {
        const minutesValue = Number(elements.countdown.minutes.value)
        const minutesNumber = Math.floor(minutesValue)
        const secondsValue = Number(elements.countdown.seconds.value)

        this.remainingSeconds =
            Math.round(secondsValue) +
            minutesNumber * 60 +
            Math.round((minutesValue - minutesNumber) * 60)

        if (this.remainingSeconds < 0) {
            showError(elements.countdown.errorMessage)
            return
        }

        hideErrors()
        updateDisplay(this.remainingSeconds)
        this.stop()
    }

    /**
     * Starts the countdown timer if time remains.
     */
    start() {
        this.stop()
        if (this.remainingSeconds > 0) this.active = true
    }

    /**
     * Stops the countdown timer.
     */
    stop() {
        this.active = false
    }

    /**
     * Resets the timer state and display.
     */
    reset() {
        this.stop()
        this.remainingSeconds = 0
        updateDisplay(0)
    }

    /**
     * Advances the timer by one second.
     *
     * Stops automatically when the timer reaches zero.
     */
    tick() {
        if (!this.active) return
        this.remainingSeconds--
        updateDisplay(this.remainingSeconds)
        if (this.remainingSeconds <= 0) this.stop()
    }
}

// UTC Timer
class UTCTimer {
    constructor() {
        this.active = false
        this.targetTime = null
    }

    /**
     * Starts the UTC countdown timer using the provided UTC hour and minute.
     */
    start() {
        this.stop()

        const hours = Number(elements.utc.hours.value) || 0
        const minutes = Number(elements.utc.minutes.value) || 0

        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            showError(elements.utc.errorMessage)
            return
        }

        const utcTime = new Date()
        utcTime.setUTCHours(hours, minutes, 0, 0)
        this.targetTime = utcTime.getTime()

        // Already past today: count down to the same time tomorrow
        if (this.targetTime <= Date.now()) this.targetTime += constants.MS_PER_DAY

        hideErrors()
        this.active = true
        this.tick()
    }

    /**
     * Stops the UTC timer and clears the target time.
     */
    stop() {
        this.active = false
        this.targetTime = null
    }

    /**
     * Updates the display based on the remaining time until the target UTC time.
     *
     * Stops at zero.
     */
    tick() {
        if (!this.active) return

        const timeDiff = this.targetTime - Date.now()
        if (timeDiff <= 0) {
            updateDisplay(0)
            this.stop()
            return
        }

        updateDisplay(Math.ceil(timeDiff / 1000))
    }
}

// Create timer instances
const countdownTimer = new CountdownTimer()
const utcTimer = new UTCTimer()

// Global functions for HTML buttons
window.setAndStartTimer = () => {
    countdownTimer.setAndStart()
    utcTimer.stop()
}
window.setMinuteSecondTimer = () => countdownTimer.setTime()
window.startTimer = () => countdownTimer.start()
window.stopTimer = () => {
    countdownTimer.stop()
    utcTimer.stop()
}
window.resetTimer = () => countdownTimer.reset()
window.startUTCTimer = () => {
    countdownTimer.reset()
    utcTimer.start()
}

// Timer tick
setInterval(() => {
    countdownTimer.tick()
    utcTimer.tick()
}, constants.COUNTDOWN_TICK_MS)

// Twitch chat
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
        r + g + b >= constants.STARTING_SOON_CHAT_COLOUR_MIN_BRIGHTNESS &&
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

// Marquee
function setupMarquee(container) {
    const track = container.querySelector(".marquee-track")
    const original = track.querySelector(".marquee-item:not([data-clone])")

    // remove old clones before re-measuring
    track.querySelectorAll("[data-clone]").forEach(el => el.remove())

    const itemWidth = original.getBoundingClientRect().width
    if (!itemWidth) return

    // enough copies to cover the container, plus one extra so the loop never shows a gap
    const copies = Math.ceil(container.clientWidth / itemWidth) + 1
    for (let i = 0; i < copies; i++) {
        const clone = original.cloneNode(true)
        clone.dataset.clone = ""
        clone.setAttribute("aria-hidden", "true")
        track.appendChild(clone)
    }

    // scroll exactly one item-width per cycle -> seamless loop
    track.style.setProperty("--shift", `${itemWidth}px`)
    track.style.setProperty("--duration", `${itemWidth / constants.NP_PIXELS_PER_SECOND}s`)
}

const container = document.querySelector(".now-playing-container")
setupMarquee(container)
new ResizeObserver(() => setupMarquee(container)).observe(container)

// To change the text later:
const nowPlayingTextEl = document.getElementById("now-playing-text")
function setNowPlaying(artist, title) {
    nowPlayingTextEl.textContent = `${artist} - ${title}`
    setupMarquee(container)
}

// Now Playing
const nowPlayingContainerEl = document.getElementById("now-playing-container")
let currentId, currentChecksum

// Get Data
function getData() {
    const data = readSavedData()

    // The dashboard hasn't saved anything (or hasn't heard from tosu) yet
    if (!data || !data.tosuData) return

    console.log(data)

    // Now playing
    const beatmapData = data.tosuData.beatmap
    if (beatmapData && (currentId !== beatmapData.id || currentChecksum !== beatmapData.checksum)) {
        currentId = beatmapData.id
        currentChecksum = beatmapData.checksum

        setNowPlaying(beatmapData.artist, beatmapData.title)
        nowPlayingContainerEl.style.backgroundImage = `url("https://assets.ppy.sh/beatmaps/${beatmapData.set}/covers/cover.jpg")`
    }
}

startPolling(getData)