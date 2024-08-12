package routes

import (
	"fmt"
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

		if msg.Type == "register" || msg.Type == "login" {
			// append the connection to the map
			MU.Lock()
			ConnectedUsers[msg.Sender] = conn
			MU.Unlock()

			BroadcastUserUpdate(msg.Type, msg.Sender, "ONLINE")
		} else if msg.Type == "logout" {
			// if the type is logout remove the connection from the map
			delete(ConnectedUsers, msg.Sender)
			BroadcastUserUpdate(msg.Type, msg.Sender, "OFFLINE")
		}
	}
}

func BroadcastUserUpdate(updateType, username string, newStatus string) {
	MU.Lock()
	defer MU.Unlock()

	userUpdate := UserUpdate{
		Type:     updateType,
		Username: username,
		Status:   newStatus,
	}

	fmt.Println(ConnectedUsers)

	for _, conn := range ConnectedUsers {
		// check if an error occurred during the sending of the message
		err := conn.WriteJSON(userUpdate)
		if err != nil {
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
