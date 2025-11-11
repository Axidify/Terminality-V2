import React, { useState } from 'react'
import './InstagramWebsite.css'

interface Post {
  id: number
  username: string
  userAvatar: string
  image: string
  caption: string
  likes: number
  comments: number
  time: string
}

const posts: Post[] = [
  {
    id: 1,
    username: 'terminal_aesthetics',
    userAvatar: '🎨',
    image: '[IMG: Retro CRT Monitor Setup]',
    caption: 'New battlestation setup complete! Love the amber glow 🧡 #RetroComputing #VintageVibes',
    likes: 2847,
    comments: 89,
    time: '2h ago'
  },
  {
    id: 2,
    username: 'codelife_daily',
    userAvatar: '💻',
    image: '📸 [Terminal Window with Code]',
    caption: 'Late night coding session 🌙 Working on something special... #CodingLife #TerminalLove',
    likes: 1923,
    comments: 56,
    time: '5h ago'
  },
  {
    id: 3,
    username: 'pixel_dreams',
    userAvatar: '✨',
    image: '🎭 [Vaporwave Aesthetic Desktop]',
    caption: 'A E S T H E T I C 💜💙 My custom theme for the week #Vaporwave #PixelArt',
    likes: 4521,
    comments: 142,
    time: '8h ago'
  },
  {
    id: 4,
    username: 'tech_nostalgia',
    userAvatar: '📼',
    image: '[IMG: Old Computer Collection]',
    caption: 'Found my dad\'s old computer from the 80s! Still works perfectly 🎉 #ThrowbackTech #Nostalgia',
    likes: 3156,
    comments: 98,
    time: '1d ago'
  },
  {
    id: 5,
    username: 'digital_artist',
    userAvatar: '🎨',
    image: '🎨 [Terminal Art ASCII]',
    caption: 'Created this ASCII art in the terminal! Took 3 hours but worth it 💪 #TerminalArt #ASCII',
    likes: 5834,
    comments: 203,
    time: '1d ago'
  }
]

const userProfile = {
  username: 'player',
  displayName: 'Player One',
  avatar: '👤',
  bio: 'Terminal enthusiast | Retro computing lover | Coffee addict ☕',
  posts: 42,
  followers: 1234,
  following: 567
}

const friends = [
  { username: 'terminal_aesthetics', avatar: '🎨' },
  { username: 'codelife_daily', avatar: '💻' },
  { username: 'pixel_dreams', avatar: '✨' },
  { username: 'tech_nostalgia', avatar: '📼' },
  { username: 'digital_artist', avatar: '🎨' }
]

export const InstagramWebsite: React.FC = () => {
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set())
  const [view, setView] = useState<'feed' | 'profile'>('feed')

  const toggleLike = (postId: number) => {
    setLikedPosts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(postId)) {
        newSet.delete(postId)
      } else {
        newSet.add(postId)
      }
      return newSet
    })
  }

  const getLikeCount = (post: Post) => {
    return likedPosts.has(post.id) ? post.likes + 1 : post.likes
  }

  return (
    <div className="instagram-site">
      <header className="instagram-header">
        <div className="instagram-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
          <span className="instagram-name">Pictogram</span>
        </div>
        <div className="instagram-search">
          <input type="text" placeholder="Search..." />
        </div>
        <div className="instagram-nav">
          <button className="nav-icon" onClick={() => setView('feed')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </button>
          <button className="nav-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
          <button className="nav-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>
          <button className="nav-icon" onClick={() => setView('profile')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </button>
        </div>
      </header>

      <div className="instagram-container">
        {view === 'feed' ? (
          <>
            <main className="instagram-feed">
              <div className="stories-bar">
                <div className="story">
                  <div className="story-avatar you">{userProfile.avatar}</div>
                  <span className="story-name">Your Story</span>
                </div>
                {friends.map(friend => (
                  <div key={friend.username} className="story">
                    <div className="story-avatar">{friend.avatar}</div>
                    <span className="story-name">{friend.username}</span>
                  </div>
                ))}
              </div>

              <div className="posts-feed">
                {posts.map(post => (
                  <article key={post.id} className="instagram-post">
                    <div className="post-header">
                      <div className="post-user">
                        <div className="user-avatar">{post.userAvatar}</div>
                        <span className="username">{post.username}</span>
                      </div>
                      <button className="post-menu">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="1"/>
                          <circle cx="19" cy="12" r="1"/>
                          <circle cx="5" cy="12" r="1"/>
                        </svg>
                      </button>
                    </div>

                    <div className="post-image">
                      <div className="placeholder-image">{post.image}</div>
                    </div>

                    <div className="post-actions">
                      <div className="action-buttons">
                        <button
                          className={`action-icon ${likedPosts.has(post.id) ? 'liked' : ''}`}
                          onClick={() => toggleLike(post.id)}
                        >
                          {likedPosts.has(post.id) ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                            </svg>
                          ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                            </svg>
                          )}
                        </button>
                        <button className="action-icon">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                          </svg>
                        </button>
                        <button className="action-icon">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="22" y1="2" x2="11" y2="13"/>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                          </svg>
                        </button>
                      </div>
                      <button className="action-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                        </svg>
                      </button>
                    </div>

                    <div className="post-info">
                      <div className="likes-count">{getLikeCount(post).toLocaleString()} likes</div>
                      <div className="caption">
                        <span className="caption-user">{post.username}</span> {post.caption}
                      </div>
                      <button className="view-comments">View all {post.comments} comments</button>
                      <div className="post-time">{post.time}</div>
                    </div>
                  </article>
                ))}
              </div>
            </main>

            <aside className="instagram-sidebar">
              <div className="sidebar-profile">
                <div className="profile-avatar">{userProfile.avatar}</div>
                <div className="profile-info">
                  <div className="profile-username">{userProfile.username}</div>
                  <div className="profile-name">{userProfile.displayName}</div>
                </div>
                <button className="switch-btn">Switch</button>
              </div>

              <div className="suggestions">
                <div className="suggestions-header">
                  <span>Suggestions For You</span>
                  <button className="see-all">See All</button>
                </div>
                {friends.map(friend => (
                  <div key={friend.username} className="suggestion-item">
                    <div className="suggestion-avatar">{friend.avatar}</div>
                    <div className="suggestion-info">
                      <div className="suggestion-username">{friend.username}</div>
                      <div className="suggestion-desc">Followed by 3 others</div>
                    </div>
                    <button className="follow-btn">Follow</button>
                  </div>
                ))}
              </div>
            </aside>
          </>
        ) : (
          <div className="profile-view">
            <div className="profile-header">
              <div className="profile-avatar-large">{userProfile.avatar}</div>
              <div className="profile-details">
                <div className="profile-username-row">
                  <h1>{userProfile.username}</h1>
                  <button className="edit-profile-btn">Edit Profile</button>
                  <button className="nav-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="1"/>
                      <circle cx="19" cy="12" r="1"/>
                      <circle cx="5" cy="12" r="1"/>
                    </svg>
                  </button>
                </div>
                <div className="profile-stats">
                  <span><strong>{userProfile.posts}</strong> posts</span>
                  <span><strong>{userProfile.followers}</strong> followers</span>
                  <span><strong>{userProfile.following}</strong> following</span>
                </div>
                <div className="profile-bio">
                  <div className="profile-display-name">{userProfile.displayName}</div>
                  <div>{userProfile.bio}</div>
                </div>
              </div>
            </div>

            <div className="profile-tabs">
              <button className="profile-tab active">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
                POSTS
              </button>
              <button className="profile-tab">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                  <line x1="7" y1="2" x2="7" y2="22"/>
                  <line x1="17" y1="2" x2="17" y2="22"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <line x1="2" y1="7" x2="7" y2="7"/>
                  <line x1="2" y1="17" x2="7" y2="17"/>
                  <line x1="17" y1="17" x2="22" y2="17"/>
                  <line x1="17" y1="7" x2="22" y2="7"/>
                </svg>
                REELS
              </button>
              <button className="profile-tab">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
                SAVED
              </button>
              <button className="profile-tab">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                TAGGED
              </button>
            </div>

            <div className="profile-grid">
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i} className="grid-item">
                  <div className="grid-placeholder">📸</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
