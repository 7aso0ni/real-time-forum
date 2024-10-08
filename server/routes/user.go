package routes

import (
	"encoding/json"
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

		http.Error(w, "Error fetching users", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []string
	for rows.Next() {
		var nickname string
		if err := rows.Scan(&nickname); err != nil {
			http.Error(w, "Error fetching users", http.StatusInternalServerError)
			return
		}

		users = append(users, nickname)
	}

	// Check for any errors encountered during iteration
	if err = rows.Err(); err != nil {
		http.Error(w, "Error fetching users", http.StatusInternalServerError)
		return
	}

	// Convert the users slice into JSON and send it as a response
	if err = json.NewEncoder(w).Encode(users); err != nil {
		http.Error(w, "something went wrong", http.StatusInternalServerError)
		return
	}
}

func FetchUserDetails(w http.ResponseWriter, r *http.Request) {
    // Ensure it's a POST request
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    // Parse the JSON body to extract the username
    var message struct {
        Username string `json:"username"`
    }

    if err := json.NewDecoder(r.Body).Decode(&message); err != nil {
        http.Error(w, "Invalid request payload", http.StatusBadRequest)
        return
    }

    var receiverInfo struct {
        Username  string     `json:"username" DB:"nickname"`
        Status    string     `json:"status" DB:"status"`
        LastLogin *time.Time `json:"last_login" DB:"last_login"`
    }

    // Get the important info of the selected user
    if err := DB.QueryRow("SELECT nickname, status, last_login FROM users WHERE nickname = ?", message.Username).Scan(&receiverInfo.Username, &receiverInfo.Status, &receiverInfo.LastLogin); err != nil {
        http.Error(w, "Error getting receiver data", http.StatusInternalServerError)
        return
    }

    // Set the content type to JSON
    w.Header().Set("Content-Type", "application/json")

    // Send the user details back as JSON
    if err := json.NewEncoder(w).Encode(receiverInfo); err != nil {
        http.Error(w, "Error sending data", http.StatusInternalServerError)
        return
    }
}

func GetUserId(username string, ch chan Result, wg *sync.WaitGroup) {
	defer wg.Done()

	var userID int
	err := DB.QueryRow("SELECT id FROM users WHERE nickname = ?", username).Scan(&userID)
	ch <- Result{Username: username, UserID: userID, Err: err}
}
