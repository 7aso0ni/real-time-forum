export async function createPost() {
  const data = new FormData(document.getElementById("post-form"));

  try {
    const response = await fetch("/create_post", {
      method: "POST",
      body: data,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    alert("Post created successfully!");
    fetchPosts(); // Refresh posts
  } catch (error) {
    console.log(`Post creation failed: ${error}`);
  }
}

export async function fetchPosts() {
  try {
    const response = await fetch("/fetch_posts", {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch posts");
    }

    const posts = await response.json();
    displayPosts(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
  }
}

export async function createComment(postId) {
  const data = new FormData(document.getElementById(`comment-form-${postId}`));
  data.append("post_id", postId);

  try {
    const response = await fetch("/comment_post", {
      method: "POST",
      body: data,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    fetchComments(postId); // Refresh comments
  } catch (error) {
    console.log(`Comment creation failed: ${error}`);
  }
}

export async function fetchComments(postId) {
  try {
    const response = await fetch(`/fetch_comments?post_id=${postId}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch comments");
    }

    const comments = await response.json();
    displayComments(postId, comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
  }
}

export function displayPosts(posts) {
  const postsContainer = document.getElementById("posts");
  postsContainer.innerHTML = "";

  posts.forEach((post) => {
    const postElement = document.createElement("div");
    postElement.className = "post";
    postElement.innerHTML = `
              <h3>${post.category}</h3>
              <p>${post.content}</p>
              <p><small>Posted by ${post.nickname} on ${new Date(
      post.created_at
    ).toLocaleString()}</small></p>
              <button class="main-button" onclick="toggleComments(${
                post.id
              })">View Comments</button>
              <div id="comments-section-${
                post.id
              }" class="comments-section" style="display: none;">
                <form id="comment-form-${post.id}">
                  <textarea name="content" placeholder="Add a comment" required></textarea>
                  <button class="main-button" type="submit">Post Comment</button>
                </form>
                <div id="comments-${post.id}" class="comments-container"></div>
              </div>
          `;
    postsContainer.appendChild(postElement);

    document
      .getElementById(`comment-form-${post.id}`)
      .addEventListener("submit", (e) => {
        e.preventDefault();
        createComment(post.id);
      });
  });
}

export function displayComments(postId, comments) {
  const commentsContainer = document.getElementById(`comments-${postId}`);
  commentsContainer.innerHTML = "";

  comments.forEach((comment) => {
    const commentElement = document.createElement("div");
    commentElement.className = "comment";
    commentElement.innerHTML = `
              <p>${comment.content}</p>
              <p><small>Commented by ${comment.nickname} on ${new Date(
      comment.created_at
    ).toLocaleString()}</small></p>
          `;
    commentsContainer.appendChild(commentElement);
  });
}

window.toggleComments = function (postId) {
  const commentsSection = document.getElementById(`comments-section-${postId}`);
  const postsContainer = document.getElementById("posts");
  const toggleButton = postsContainer.querySelector(`.main-button[onclick="toggleComments(${postId})"]`);

  if (commentsSection.style.display === "none") {
    // Hide all posts except the one clicked
    Array.from(postsContainer.children).forEach(post => {
      if (!post.contains(commentsSection)) {
        post.style.display = "none";
      }
    });

    // Show the comments section
    commentsSection.style.display = "block";
    fetchComments(postId); // Fetch comments when the section is expanded

    // Change button text to "Hide Comments"
    if (toggleButton) {
      toggleButton.textContent = "Hide Comments";
    }
  } else {
    // Show all posts when comments are hidden
    Array.from(postsContainer.children).forEach(post => {
      post.style.display = "block";
    });

    // Hide the comments section
    commentsSection.style.display = "none";

    // Change button text back to "View Comments"
    if (toggleButton) {
      toggleButton.textContent = "View Comments";
    }
  }
};

