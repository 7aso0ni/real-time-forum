package routes

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}
	var user *User

	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		fmt.Println(err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}

	result, err := DB.Exec("INSERT INTO users (nickname, age, gender, first_name, last_name, email, password, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		user.Nickname, user.Age, user.Gender, user.FirstName, user.LastName, user.Email, hashedPassword, CurrentDate)
	if err != nil {
		http.Error(w, "Error registering user", http.StatusInternalServerError)
		return
	}

	// get the last inserted id from the database
	userID, err := result.LastInsertId()
	if err != nil {
		http.Error(w, "Error registering user", http.StatusInternalServerError)
		return
	}

	sessionToken := uuid.New().String()
	_, err = DB.Exec("INSERT INTO sessions (user_id, token) VALUES (?, ?)", userID, sessionToken)
	if err != nil {
		http.Error(w, "Error creating session", http.StatusInternalServerError)
		return
	}

	if _, err = DB.Exec("UPDATE users SET status = 'ONLINE' WHERE id = ?", userID); err != nil {
		http.Error(w, "Something went wrong with changing status", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    sessionToken,
		Path:     "/",
		HttpOnly: true,
		MaxAge:   int(24 * time.Hour / time.Second), // max age will be 24 hours for the cookie
	})

	response := LoginResponse{
		Username: user.Nickname,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, "Error encoding response", http.StatusInternalServerError)
		return
	}
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	var user struct {
		Identifier string `json:"identifier"`
		Password   string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		fmt.Println(err)
		http.Error(w, "Error reading data", http.StatusInternalServerError)
		return
	}


	var hashedPassword, username string
	var userID int
	err := DB.QueryRow("SELECT id, password, nickname FROM users WHERE nickname = ? OR email = ?", user.Identifier, user.Identifier).Scan(&userID, &hashedPassword, &username)
	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	err = bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(user.Password))
	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	sessionToken := uuid.New().String()
	_, err = DB.Exec("INSERT INTO sessions (user_id, token) VALUES (?, ?)", userID, sessionToken)
	if err != nil {
		http.Error(w, "Error creating session", http.StatusInternalServerError)
		return
	}

	if _, err = DB.Exec("UPDATE users SET status = 'ONLINE', last_login = ? WHERE id = ?", CurrentDate, userID); err != nil {
		http.Error(w, "Something went wrong with changing status", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    sessionToken,
		Path:     "/",
		HttpOnly: true,
		MaxAge:   int(24 * time.Hour / time.Second), // max age will be 24 hours for the cookie
	})

	response := LoginResponse{
		Username: username,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, "Error encoding response", http.StatusInternalServerError)
		return
	}
}

func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session_token")
	if err != nil {
		if err == http.ErrNoCookie {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	sessionToken := cookie.Value

	// get the user id from the cookies saved
	var userID int
	err = DB.QueryRow("SELECT user_id FROM sessions WHERE token = ?", sessionToken).Scan(&userID)
	if err != nil {
		http.Error(w, "Error removing session", http.StatusInternalServerError)
		return
	}

	_, err = DB.Exec("DELETE FROM sessions WHERE token = ?", sessionToken)
	if err != nil {
		http.Error(w, "Error deleting session", http.StatusInternalServerError)
		return
	}

	var username string
	err = DB.QueryRow("SELECT nickname FROM users WHERE id = ?", userID).Scan(&username)
	if err != nil {
		http.Error(w, "Error getting username", http.StatusInternalServerError)
		return
	}

	if _, err = DB.Exec("UPDATE users SET status = 'OFFLINE' WHERE id = ?", userID); err != nil {
		http.Error(w, "Error, something went wrong with status change", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:   "session_token",
		Value:  "",
		Path:   "/",
		MaxAge: -1,
	})

	log.Println("User logged out successfully")
	w.WriteHeader(http.StatusOK)
}

func GetUserIDFromSession(w http.ResponseWriter, r *http.Request) int {
	cookie, err := r.Cookie("session_token")
	if err != nil {
		if err == http.ErrNoCookie {
			w.WriteHeader(http.StatusUnauthorized)
			return -1
		}
		w.WriteHeader(http.StatusBadRequest)
		return -1
	}

	sessionToken := cookie.Value
	var userID int
	err = DB.QueryRow("SELECT user_id FROM sessions WHERE token = ?", sessionToken).Scan(&userID)
	if err != nil {
		if err == sql.ErrNoRows {
			w.WriteHeader(http.StatusUnauthorized)
			return -1
		}
		w.WriteHeader(http.StatusInternalServerError)
		return -1
	}

	return userID
}

func IsUserLoggedInHandler(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session_token")
	if err != nil {
		if err == http.ErrNoCookie {
			http.Error(w, "User is unauthorized", http.StatusUnauthorized)
			return
		}

		http.Error(w, "Error retrieving token", http.StatusBadRequest)
		return
	}

	sessionToken := cookie.Value
	var token string
	// check if the token exists on the database
	err = DB.QueryRow("SELECT token FROM sessions WHERE token = ?", sessionToken).Scan(&token)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Unauthorized user", http.StatusUnauthorized)
			return
		}
		http.Error(w, "Something went wrong", http.StatusInternalServerError)
		return
	}

	// user is authorized
	w.WriteHeader(http.StatusOK)
}
