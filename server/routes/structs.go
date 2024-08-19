package routes

import (
	"database/sql"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var (
	DB             *sql.DB
	Upgrader       = websocket.Upgrader{}
	MU             sync.Mutex
	ConnectedUsers = make(map[string]*websocket.Conn)
	CurrentDate    = time.Now()
)

type User struct {
	ID        int    `json:"id"`
	Nickname  string `json:"nickname"`
	Age       int    `json:"age"`
	Gender    string `json:"gender"`
	FirstName string `json:"firstname"`
	LastName  string `json:"lastname"`
	Email     string `json:"email"`
	Password  string `json:"password"`
}

type Post struct {
	ID        int       `json:"id"`
	UserID    int       `json:"user_id"`
	Category  string    `json:"category"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	Nickname  string    `json:"nickname"`
}

type Comment struct {
	ID        int       `json:"id"`
	PostID    int       `json:"post_id"`
	UserID    int       `json:"user_id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	Nickname  string    `json:"nickname"`
}

type Message struct {
	Type      string    `json:"type"`
	Sender    string    `json:"sender"`
	Receiver  string    `json:"receiver"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	IsRead    string    `json:"is_read"`
}

type Result struct {
	Username string
	UserID   int
	Err      error
}

type LoginResponse struct {
	Username string `json:"username"`
}

type ErrorMessage struct {
	Error string `json:"error"`
}

type UserUpdate struct {
	Type     string `json:"type"`
	Status   string `json:"status"`
	Username string `json:"username"`
}
