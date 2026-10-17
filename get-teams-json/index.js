const textareaEl = document.getElementById("textarea")
const buttonEl = document.getElementById("button")
let teams = []
async function submit() {
    const textareaElValue = textareaEl.value
    const textAreaElValueSplit = textareaElValue.split("\n")
    for (let i = 1; i < textAreaElValueSplit.length; i++) {
        const textAreaElValueSplitSplit = textAreaElValueSplit[i].split("\t")
        const teamStat = {
            "teamName": textAreaElValueSplitSplit[0],
            "player1": {
                "id": Number(textAreaElValueSplitSplit[1]),
                "playerName": textAreaElValueSplitSplit[2],
                "class": textAreaElValueSplitSplit[3]
            },
            "player2": {
                "id": Number(textAreaElValueSplitSplit[4]),
                "playerName": textAreaElValueSplitSplit[5],
                "class": textAreaElValueSplitSplit[6]
            },
            "player3": {
                "id": Number(textAreaElValueSplitSplit[7]),
                "playerName": textAreaElValueSplitSplit[8],
                "class": textAreaElValueSplitSplit[9]
            }
            
        }
        teams.push(teamStat)
    }

    const jsonString = JSON.stringify(teams, null, 4)
    const blob = new Blob([jsonString], { type: "application/json" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "teams.json"
    link.click()
}

window.onload = () => {
    buttonEl.addEventListener("click", submit)
}