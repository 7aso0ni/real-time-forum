package routes

import (
	"log"
	"net/http"
)

func WsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := Upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, "Could not open websocket connection", http.StatusBadRequest)
		return
	}
	defer conn.Close()

	for {
		var msg Message
		err := conn.ReadJSON(&msg)
		if err != nil {
			log.Println("Read:", err)
			break
		}

		if msg.Type == "register" || msg.Type == "login" || msg.Type == "logout" {
			BroadcastUserUpdate(msg.Type, msg.Sender)
		}
	}
}

func BroadcastUserUpdate(updateType, username string) {
	MU.Lock()
	defer MU.Unlock()

	update := UserUpdate{
		Type:     updateType,
		Username: username,
	}

	for _, conn := range ConnectedUsers {
		if err := conn.WriteJSON(update); err != nil {
			log.Println("Broadcast error:", err)
			conn.Close()
			// Remove disconnected user
			for uname, userConn := range ConnectedUsers {
				if userConn == conn {
					delete(ConnectedUsers, uname)
					break
				}
			}
		}
	}
}
