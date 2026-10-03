export function updateChat(chatLen, chatData, chatContainerEl) {
    // This is also mostly taken from Victim Crasher: https://github.com/VictimCrasher/static/tree/master/WaveTournament
    if (chatLen !== chatData.length) {
        if (!chatLen || chatLen > chatData.length) {
            chatContainerEl.innerHTML = ""
            chatLen = 0
        }

        const fragment = document.createDocumentFragment()

        for (let i = chatLen; i < chatData.length; i++) {
            const chatColour = chatData[i].team

            // Chat message container
            const chatMessageContainer = document.createElement("div")
            chatMessageContainer.classList.add("chatbox-message")

            // Name
            const chatboxName = document.createElement("div")
            chatboxName.classList.add("chatbox-name")
            chatboxName.classList.add(chatColour)
            chatboxName.innerText = chatData[i].name + ": ";

            // Message
            const chatboxMessage = document.createElement("div")
            chatboxMessage.classList.add("chatbox-content")
            chatboxMessage.innerText = chatData[i].message

            chatMessageContainer.append(chatboxName, chatboxMessage)
            fragment.append(chatMessageContainer)
        }

        chatContainerEl.append(fragment)
        chatLen = chatData.length
        chatContainerEl.scrollTop = chatContainerEl.scrollHeight
    }

    return chatLen
}