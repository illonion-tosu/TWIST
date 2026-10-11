function setPlayerName(playerNumber, name) {
    const text = document.getElementById(`player-${playerNumber}-name`)

    const maxWidth = 340
    const words = name.split(" ")
    const lines = []
    let currentLine = ""

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

    text.textContent = ""

    const lineYs = {
        1: [285],
        2: [235, 285],
        3: [185, 235, 285],
    }

    lines.forEach((line, index) => {
        const tspan = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "tspan"
        )

        tspan.setAttribute("x", "183")
        tspan.setAttribute("y", lineYs[lines.length][index])
        tspan.textContent = line

        text.appendChild(tspan)
    })
}

setPlayerName(1, "KIM BRAD CHILL")
setPlayerName(2, "KIM BRAD CHILL")
setPlayerName(3, "KIM BRAD CHILL")