package routes

import (
	"encoding/json"
	"log"
	"net/http"
)

func CreatePostHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	userID := GetUserIDFromSession(w, r)
	if userID == -1 {
		log.Println("User not authenticated")
		return
	}

	category := r.FormValue("category")
	content := r.FormValue("content")

	_, err := DB.Exec("INSERT INTO posts (user_id, category, content) VALUES (?, ?, ?)", userID, category, content)
	if err != nil {
		log.Printf("Error creating post: %v", err)
		http.Error(w, "Error creating post", http.StatusInternalServerError)
		return
	}

	log.Println("Post created successfully by user:", userID)
	w.WriteHeader(http.StatusCreated)
}

func CommentPostHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	userID := GetUserIDFromSession(w, r)
	if userID == -1 {
		log.Println("User not authenticated")
		return
	}

	postID := r.FormValue("post_id")
	content := r.FormValue("content")

	_, err := DB.Exec("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)", postID, userID, content)
	if err != nil {
		log.Printf("Error commenting post: %v", err)
		http.Error(w, "Error commenting post", http.StatusInternalServerError)
		return
	}

	log.Println("Comment created successfully by user:", userID)
	w.WriteHeader(http.StatusCreated)
}

func FetchPostsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	rows, err := DB.Query(`
        SELECT p.id, p.category, p.content, p.created_at, u.nickname
        FROM posts p
        JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
    `)
	if err != nil {
		log.Printf("Error fetching posts: %v", err)
		http.Error(w, "Error fetching posts", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var posts []Post
	for rows.Next() {
		var post Post
		if err := rows.Scan(&post.ID, &post.Category, &post.Content, &post.CreatedAt, &post.Nickname); err != nil {
			log.Printf("Error scanning post: %v", err)
			http.Error(w, "Error scanning post", http.StatusInternalServerError)
			return
		}
		posts = append(posts, post)
	}

	if err := rows.Err(); err != nil {
		log.Printf("Error with rows: %v", err)
		http.Error(w, "Error with rows", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(posts); err != nil {
		log.Printf("Error encoding posts: %v", err)
		http.Error(w, "Error encoding posts", http.StatusInternalServerError)
	}
}
