package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"

	rtf "rtf/server/routes"

	_ "github.com/mattn/go-sqlite3"
)

func main() {
	var err error
	rtf.DB, err = sql.Open("sqlite3", "./forum.DB")
	if err != nil {
		log.Fatal(err)
	}
	defer rtf.DB.Close()
	http.Handle("/", http.FileServer(http.Dir("./static")))

	http.HandleFunc("/register", rtf.RegisterHandler)
	http.HandleFunc("/login", rtf.LoginHandler)
	http.HandleFunc("/logout", rtf.LogoutHandler)
	http.HandleFunc("/create_post", rtf.CreatePostHandler)
	http.HandleFunc("/comment_post", rtf.CommentPostHandler)
	http.HandleFunc("/fetch_posts", rtf.FetchPostsHandler)
	http.HandleFunc("/fetch_comments", rtf.FetchCommentsHandler)
	http.HandleFunc("/is_logged_in", rtf.IsUserLoggedInHandler)
	http.HandleFunc("/fetch_users", rtf.FetchUsersHandler)
	http.HandleFunc("/fetch_user_data", rtf.FetchUserDetails)
	http.HandleFunc("/get_messages", rtf.GetMessages)
	http.HandleFunc("/chat", rtf.ChatHandler)
	http.HandleFunc("/ws", rtf.WsHandler)

	fmt.Println("Server started at :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
