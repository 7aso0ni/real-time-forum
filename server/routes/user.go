package routes

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

func FetchUsersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	var currentUser struct {
		Username string `json:"username"`
	}

	if err := json.NewDecoder(r.Body).Decode(&currentUser); err != nil {
		http.Error(w, "Error reading data", http.StatusInternalServerError)
		return
	}

	// SQL query to fetch users ordered by last message time and online status
	query := `
		SELECT u.nickname 
		FROM users u
		LEFT JOIN (
			SELECT 
				sender_id AS user_id, 
				MAX(created_at) AS last_message_time 
			FROM private_messages 
			GROUP BY sender_id
		) pm ON u.id = pm.user_id
		WHERE u.nickname != ?
		ORDER BY 
			COALESCE(pm.last_message_time, '1970-01-01 00:00:00') DESC, 
			CASE u.status 
				WHEN 'ONLINE' THEN 1 
				ELSE 2 
			END ASC;
	`

	rows, err := DB.Query(query, currentUser.Username)
	if err != nil {
		log.Printf("something went wrong: %v", err)
		http.Error(w, "Error fetching users", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []string
	for rows.Next() {
		var nickname string
		if err := rows.Scan(&nickname); err != nil {
			log.Printf("something went wrong during Scan: %v", err)
			http.Error(w, "Error fetching users", http.StatusInternalServerError)
			return
		}

		users = append(users, nickname)
	}

	// Check for any errors encountered during iteration
	if err = rows.Err(); err != nil {
		log.Printf("something went wrong: %v", err)
		http.Error(w, "Error fetching users", http.StatusInternalServerError)
		return
	}

	// Convert the users slice into JSON and send it as a response
	if err = json.NewEncoder(w).Encode(users); err != nil {
		log.Printf("error sending json: %v", err)
		http.Error(w, "something went wrong", http.StatusInternalServerError)
		return
	}
}

func FetchUserDetails(w http.ResponseWriter, r *http.Request) {
	// Upgrade the HTTP connection to a WebSocket connection
	conn, err := Upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, "Could not open websocket connection", http.StatusBadRequest)
		return
	}
	defer conn.Close()

	for {
		var message struct {
			Username string `json:"username"`
		}

		var receiverInfo struct {
			Username  string     `json:"username" DB:"nickname"`
			Status    string     `json:"status" DB:"status"`
			LastLogin *time.Time `json:"last_login" DB:"last_login"`
		}

		// Read message from WebSocket client
		if err := conn.ReadJSON(&message); err != nil {
			fmt.Println("Error reading json.", err)
			return
		}

		// Get the id from the username passed
		var userID int
		if err := DB.QueryRow("SELECT id FROM users WHERE nickname = ?", message.Username).Scan(&userID); err != nil {
			http.Error(w, "Error getting user data", http.StatusInternalServerError)
			return
		}

		// Get the important info of the selected user
		if err := DB.QueryRow("SELECT nickname, status, last_login FROM users WHERE id = ?", userID).Scan(&receiverInfo.Username, &receiverInfo.Status, &receiverInfo.LastLogin); err != nil {
			fmt.Println(err)
			http.Error(w, "Error getting receiver data", http.StatusInternalServerError)
			return
		}

		// Send the user details back to the WebSocket client
		if err := conn.WriteJSON(receiverInfo); err != nil {
			fmt.Println("Error sending json.", err)
			return
		}
	}
}

func GetUserId(username string, ch chan Result, wg *sync.WaitGroup) {
	defer wg.Done()

	var userID int
	err := DB.QueryRow("SELECT id FROM users WHERE nickname = ?", username).Scan(&userID)
	ch <- Result{Username: username, UserID: userID, Err: err}
}
