import React, { useState } from 'react'
import './RedditWebsite.css'

interface Post {
  id: number
  author: string
  subreddit: string
  title: string
  content: string
  upvotes: number
  comments: number
  time: string
}

const posts: Post[] = [
  {
    id: 1,
    author: 'TerminalMaster',
    subreddit: 'retro_computing',
    title: 'Just discovered this amazing terminal OS!',
    content: 'Been using Terminality OS for a week now and I\'m blown away. The retro aesthetic with modern functionality is exactly what I needed. Anyone else using this?',
    upvotes: 1247,
    comments: 89,
    time: '4h ago'
  },
  {
    id: 2,
    author: 'CyberNomad',
    subreddit: 'programming',
    title: 'Why terminal-based UIs are making a comeback',
    content: 'There\'s something special about the simplicity and efficiency of terminal interfaces. No bloat, no distractions, just pure productivity.',
    upvotes: 892,
    comments: 156,
    time: '8h ago'
  },
  {
    id: 3,
    author: 'RetroVibes',
    subreddit: 'vaporwave',
    title: 'This terminal aesthetic is *chef\'s kiss*',
    content: 'The green phosphor glow, the scanlines, the VT323 font... absolute perfection. 10/10 would compute again.',
    upvotes: 2134,
    comments: 203,
    time: '12h ago'
  },
  {
    id: 4,
    author: 'CodeWizard',
    subreddit: 'webdev',
    title: 'Built my portfolio site with terminal aesthetics',
    content: 'Just finished my new portfolio website with a terminal theme. The response has been incredible. Clients love the unique approach!',
    upvotes: 567,
    comments: 44,
    time: '1d ago'
  },
  {
    id: 5,
    author: 'PixelPusher',
    subreddit: 'nostalgia',
    title: 'Remember when all computers looked like this?',
    content: 'Growing up with CRT monitors and command-line interfaces. Those were the days. Anyone else miss the simplicity?',
    upvotes: 3421,
    comments: 412,
    time: '2d ago'
  }
]

export const RedditWebsite: React.FC = () => {
  const [votedPosts, setVotedPosts] = useState<{ [key: number]: 'up' | 'down' | null }>({})

  const handleVote = (postId: number, type: 'up' | 'down') => {
    setVotedPosts(prev => ({
      ...prev,
      [postId]: prev[postId] === type ? null : type
    }))
  }

  const getVoteCount = (post: Post) => {
    const vote = votedPosts[post.id]
    if (vote === 'up') return post.upvotes + 1
    if (vote === 'down') return post.upvotes - 1
    return post.upvotes
  }

  return (
    <div className="reddit-site">
      <header className="reddit-header">
        <div className="reddit-logo">
          <svg className="reddit-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
            <line x1="9" y1="9" x2="9.01" y2="9"/>
            <line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
          <span className="reddit-name">Threadit</span>
        </div>
        <div className="reddit-search">
          <input type="text" placeholder="Search Threadit..." />
        </div>
        <div className="reddit-actions">
          <button className="reddit-btn">Create Post</button>
          <button className="reddit-btn-primary">Log In</button>
        </div>
      </header>

      <div className="reddit-container">
        <aside className="reddit-sidebar">
          <div className="sidebar-section">
            <h3>Popular Communities</h3>
            <div className="community-list">
              <div className="community-item">
                <span className="community-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                </span>
                <span>r/retro_computing</span>
              </div>
              <div className="community-item">
                <span className="community-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 18l2-2 4 4M5 15l5-5 3 3 7-7"/>
                  </svg>
                </span>
                <span>r/programming</span>
              </div>
              <div className="community-item">
                <span className="community-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18V5l12-2v13M9 9l12-2"/>
                  </svg>
                </span>
                <span>r/vaporwave</span>
              </div>
              <div className="community-item">
                <span className="community-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                </span>
                <span>r/webdev</span>
              </div>
              <div className="community-item">
                <span className="community-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="6" width="20" height="12" rx="2" ry="2"/><circle cx="8" cy="12" r="2"/>
                  </svg>
                </span>
                <span>r/nostalgia</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="reddit-feed">
          <div className="feed-header">
            <button className="feed-tab active">Hot</button>
            <button className="feed-tab">New</button>
            <button className="feed-tab">Top</button>
          </div>

          <div className="posts-list">
            {posts.map(post => (
              <article key={post.id} className="post-card">
                <div className="post-votes">
                  <button
                    className={`vote-btn ${votedPosts[post.id] === 'up' ? 'voted' : ''}`}
                    onClick={() => handleVote(post.id, 'up')}
                  >
                    ▲
                  </button>
                  <span className="vote-count">{getVoteCount(post)}</span>
                  <button
                    className={`vote-btn ${votedPosts[post.id] === 'down' ? 'voted' : ''}`}
                    onClick={() => handleVote(post.id, 'down')}
                  >
                    ▼
                  </button>
                </div>

                <div className="post-content">
                  <div className="post-meta">
                    <span className="post-subreddit">r/{post.subreddit}</span>
                    <span className="post-separator">•</span>
                    <span className="post-author">Posted by u/{post.author}</span>
                    <span className="post-separator">•</span>
                    <span className="post-time">{post.time}</span>
                  </div>

                  <h2 className="post-title">{post.title}</h2>
                  <p className="post-text">{post.content}</p>

                  <div className="post-actions">
                    <button className="action-btn">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      {post.comments} Comments
                    </button>
                    <button className="action-btn">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                      Share
                    </button>
                    <button className="action-btn">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                      </svg>
                      Save
                    </button>
                    <button className="action-btn">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
