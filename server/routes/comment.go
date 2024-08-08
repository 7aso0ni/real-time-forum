package routes

import (
	"encoding/json"
	"log"
	"net/http"
)

func FetchCommentsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	postID := r.URL.Query().Get("post_id")
	rows, err := DB.Query(`
        SELECT c.id, c.post_id, c.content, c.created_at, u.nickname
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC
    `, postID)
	if err != nil {
		log.Printf("Error fetching comments: %v", err)
		http.Error(w, "Error fetching comments", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var comments []Comment
	for rows.Next() {
		var comment Comment
		if err := rows.Scan(&comment.ID, &comment.PostID, &comment.Content, &comment.CreatedAt, &comment.Nickname); err != nil {
			log.Printf("Error scanning comment: %v", err)
			http.Error(w, "Error scanning comment", http.StatusInternalServerError)
			return
		}
		comments = append(comments, comment)
	}

	if err := rows.Err(); err != nil {
		log.Printf("Error with rows: %v", err)
		http.Error(w, "Error with rows", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(comments); err != nil {
		log.Printf("Error encoding comments: %v", err)
		http.Error(w, "Error encoding comments", http.StatusInternalServerError)
	}
}
