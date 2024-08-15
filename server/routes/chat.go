package routes

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"
)

func ChatHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := Upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	var username string

	// close and remove the connections after existing the function
	defer func() {
		conn.Close()
		MU.Lock()
		delete(ConnectedUsers, username)
		MU.Unlock()
	}()

	for {
		var msg Message
		err := conn.ReadJSON(&msg)
		if err != nil {
			break
		}

		// check if the type of connection is init
		if msg.Type == "init" || msg.Type == "login" || msg.Type == "register" {
			username = msg.Sender

			// check if the username is provided with the request
			if username == "" {
				conn.WriteJSON(ErrorMessage{Error: "Username not provided"})
				continue
			}

			// Store the the connection in the map
			MU.Lock()
			ConnectedUsers[username] = conn
			MU.Unlock()

			// send a status update to the front-end
			BroadcastUserUpdate("chat", username, "ONLINE")
			continue
		} else if msg.Type == "logout" {
			MU.Lock()
			delete(ConnectedUsers, username)
			MU.Unlock()

			// send a signal to the front-end that the user exited
			BroadcastUserUpdate("chat", username, "OFFLINE")

			// stop the loop after broadcasting
			break
		}

		// check if the username is provided with the request after initializing
		if username == "" {
			conn.WriteJSON(ErrorMessage{Error: "Username not initialized"})
			continue
		}

		ch := make(chan Result, 2)
		var wg sync.WaitGroup
		wg.Add(2)

		go GetUserId(msg.Sender, ch, &wg)
		go GetUserId(msg.Receiver, ch, &wg)

		go func() {
			wg.Wait()
			close(ch)
		}()

		var senderID, receiverID int
		for result := range ch {
			if result.Err != nil {
				conn.WriteJSON(ErrorMessage{Error: result.Err.Error()})
				return
			}

			if result.Username == msg.Sender {
				senderID = result.UserID
			} else if result.Username == msg.Receiver {
				receiverID = result.UserID
			}
		}

		// after removing all spaces check if the message is empty
		if strings.TrimSpace(msg.Content) == "" {
			conn.WriteJSON(ErrorMessage{Error: "Message can't be empty"})
			continue
		}

		// set the data provided to the database
		_, err = DB.Exec("INSERT INTO private_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)", senderID, receiverID, msg.Content)
		if err != nil {
			conn.WriteJSON(ErrorMessage{Error: "Error inserting message"})
			break
		}

		// create the time of the message creation
		msg.CreatedAt = time.Now()
		MU.Lock()
		receiverConn, isOnline := ConnectedUsers[msg.Receiver]
		MU.Unlock()

		err = conn.WriteJSON(msg)
		if err != nil {
			break
		}
		// check if the user exist in the map
		if isOnline {
			// send the message contents to the specified user
			err = receiverConn.WriteJSON(msg)
			if err != nil {
				break
			}
		}
	}
}

func GetMessages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Get the sender and receiver usernames from the front-end
	var contacts struct {
		Sender   string `json:"sender"`
		Receiver string `json:"receiver"`
	}
	if err := json.NewDecoder(r.Body).Decode(&contacts); err != nil {
		http.Error(w, "Error reading value", http.StatusInternalServerError)
		return
	}

	ch := make(chan Result, 2)
	var wg sync.WaitGroup
	wg.Add(2)

	// Get the IDs of both the sender and the receiver
	go GetUserId(contacts.Sender, ch, &wg)
	go GetUserId(contacts.Receiver, ch, &wg)

	go func() {
		wg.Wait()
		close(ch)
	}()

	var senderID, receiverID int

	// keep track of which username is connected to which id
	usernameToID := make(map[int]string)

	// Loop through the result channel
	for result := range ch {
		if result.Err != nil {
			http.Error(w, "Something went wrong", http.StatusInternalServerError)
			return
		}

		// Map the username to the corresponding ID
		if result.Username == contacts.Sender {
			senderID = result.UserID
		} else if result.Username == contacts.Receiver {
			receiverID = result.UserID
		}

		usernameToID[result.UserID] = result.Username
	}

	// Filter messages to get only those of the sender and receiver
	rows, err := DB.Query(`SELECT sender_id, receiver_id, content, created_at FROM private_messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) ORDER BY created_at ASC`, senderID, receiverID, receiverID, senderID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "No messages found", http.StatusNotFound)
			return
		}
		http.Error(w, "Something went wrong", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var messages []*Message

	for rows.Next() {
		var currentMessage Message
		var senderID, receiverID int
		var timeInStr string

		// scan the values into the declared variables
		err := rows.Scan(&senderID, &receiverID, &currentMessage.Content, &timeInStr)
		if err != nil {
			http.Error(w, "Couldn't retrieve messages", http.StatusInternalServerError)
			return
		}

		currentMessage.CreatedAt, err = time.Parse(time.RFC3339, timeInStr)
		if err != nil {
			http.Error(w, "Error parsing time", http.StatusInternalServerError)
			return
		}

		// Map IDs back to usernames to send the username instead of the id
		currentMessage.Sender = usernameToID[senderID]
		currentMessage.Receiver = usernameToID[receiverID]

		messages = append(messages, &currentMessage)
	}

	if err = rows.Err(); err != nil {
		http.Error(w, "Couldn't retrieve messages", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(messages); err != nil {
		http.Error(w, "Something went wrong with sending the data", http.StatusInternalServerError)
	}
}

func GetLastUserMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	var user struct {
		Username string `json:"username"`
	}

	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		http.Error(w, "Error reading json data", http.StatusInternalServerError)
		return
	}

	// Get the id from the username passed
	var userID int
	if err := DB.QueryRow("SELECT id FROM users WHERE nickname = ?", user.Username).Scan(&userID); err != nil {
		http.Error(w, "Error getting user data", http.StatusInternalServerError)
		return
	}


	var lastMessage Message

	// Query to get the most recent message sent by the user
	query := `
		SELECT content, created_at 
		FROM private_messages 
		WHERE sender_id = ?OR receiver_id = ? 
		ORDER BY created_at DESC 
		LIMIT 1`

	err := DB.QueryRow(query, userID, userID).Scan(
		&lastMessage.Content,
		&lastMessage.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "No messages found", http.StatusNotFound)
		} else {
			http.Error(w, "Error fetching last message", http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(lastMessage); err != nil {
		http.Error(w, "Error encoding response", http.StatusInternalServerError)
	}
}
