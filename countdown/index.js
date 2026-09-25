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
 * Displays the specified error message and hides the other.
 *
 * @param {HTMLElement} errorEl - The error element to display.
 */
function showError(errorEl) {
    elements.countdown.errorMessage.style.display = errorEl === elements.countdown.errorMessage ? "block" : "none"
    elements.utc.errorMessage.style.display = errorEl === elements.utc.errorMessage ? "block" : "none"
}

/**
 * Hides all timer error messages.
 */
function hideErrors() {
    elements.countdown.errorMessage.style.display = "none"
    elements.utc.errorMessage.style.display = "none"
}

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

        if (hours < 0 || minutes < 0) {
            showError(elements.utc.errorMessage)
            return
        }

        const utcTime = new Date()
        utcTime.setUTCHours(hours, minutes, 0, 0)
        this.targetTime = utcTime.getTime()

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
     * Automatically rolls over to the next day if the target time has passed.
     */
    tick() {
        if (!this.active) return

        let timeDiff = this.targetTime - Date.now()
        if (timeDiff < 0) {
            this.targetTime += 24 * 60 * 60 * 1000
            timeDiff = this.targetTime - Date.now()
        }

        updateDisplay(Math.floor(timeDiff / 1000))
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
}, 1000)