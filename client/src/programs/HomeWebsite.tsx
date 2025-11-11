import React, { useState, useEffect } from 'react'
import './HomeWebsite.css'

interface HomeWebsiteProps {
  onNavigate?: (url: string) => void
}

type ViewType = 'home' | 'article' | 'category'

export const HomeWebsite: React.FC<HomeWebsiteProps> = ({ onNavigate: _onNavigate }) => {
  const [currentView, setCurrentView] = useState<ViewType>('home')
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('home')

  // Scroll to top when view changes
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [currentView, selectedArticleId, selectedCategory])
  const newsArticles = [
    {
      id: 1,
      category: 'tech',
      categoryLabel: 'Technology',
      title: 'Quantum Computing Breakthrough: New Algorithm Achieves 1000x Speed',
      excerpt: 'Researchers at AXI Labs have developed a revolutionary quantum algorithm that promises to transform encryption and data processing.',
      fullContent: `In a groundbreaking development, researchers at AXI Laboratories have successfully developed a quantum algorithm that demonstrates performance improvements of up to 1000x over classical computing methods in specific cryptographic applications.

      The new algorithm, dubbed "QuantumShift-X," leverages quantum entanglement and superposition principles to solve complex mathematical problems that would take traditional computers years to process. Lead researcher Dr. Sarah Chen announced the breakthrough at the Global Tech Summit earlier today.

      "This represents a fundamental shift in how we approach computational problems," Dr. Chen explained. "What makes QuantumShift-X revolutionary is its ability to maintain quantum coherence for extended periods, allowing us to perform calculations that were previously thought impossible."

      The algorithm has immediate applications in several fields including cryptography, drug discovery, and climate modeling. Several tech giants have already expressed interest in licensing the technology for their quantum computing platforms.

      However, experts warn that this advancement also poses significant challenges to current encryption standards. "We need to start preparing for a post-quantum cryptography era," noted cybersecurity expert Dr. Marcus Liu. "Organizations should begin evaluating their security infrastructure now."

      The research team plans to publish their full findings in the upcoming issue of Nature Quantum Computing, with the algorithm's source code being released under an open-source license to accelerate further research and development.`,
      time: '2 hours ago',
      author: 'Dr. Sarah Chen',
      image: <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6"/><circle cx="12" cy="12" r="10"/></svg>
    },
    {
      id: 2,
      category: 'world',
      categoryLabel: 'World',
      title: 'Major Data Breach Affects 10 Million Users Worldwide',
      excerpt: 'Security experts warn users to change passwords immediately after hackers exploited zero-day vulnerability in popular social platform.',
      fullContent: `A massive data breach has compromised the personal information of approximately 10 million users across multiple platforms, security researchers confirmed today. The attack exploited a previously unknown zero-day vulnerability in a widely-used authentication system.

      The breach, discovered by the cybersecurity firm SecureWatch, exposes user credentials, email addresses, and in some cases, payment information. Affected platforms include several major social networks, gaming services, and e-commerce sites that rely on the compromised authentication service.

      "This is one of the most significant security incidents we've seen this year," said SecureWatch CEO Jennifer Martinez. "The attackers gained access through a vulnerability in the OAuth implementation that had existed undetected for nearly 18 months."

      Users are strongly urged to change their passwords immediately and enable two-factor authentication on all accounts. Security experts recommend using unique passwords for each service and considering a password manager for enhanced security.

      The attack appears to be the work of a sophisticated cybercriminal group known as "ShadowNet," which has been linked to several high-profile breaches over the past two years. Law enforcement agencies across multiple countries are coordinating their investigation.

      Affected companies have begun notifying users and have implemented emergency security patches. Several have also offered free credit monitoring services to impacted users as a precautionary measure.`,
      time: '4 hours ago',
      author: 'Jennifer Martinez',
      image: <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    },
    {
      id: 3,
      category: 'business',
      categoryLabel: 'Business',
      title: 'Tech Giants Announce New AI Partnership Initiative',
      excerpt: 'Leading technology companies join forces to establish ethical guidelines and safety standards for artificial intelligence development.',
      fullContent: `In an unprecedented move, five of the world's largest technology companies have announced the formation of the "Responsible AI Alliance," a coalition dedicated to establishing industry-wide ethical guidelines and safety standards for artificial intelligence development.

      The alliance, which includes major players from the software, hardware, and cloud computing sectors, represents a combined market value of over $5 trillion. Members have committed to sharing research, coordinating on safety protocols, and developing standardized testing frameworks for AI systems.

      "We're at a critical juncture in AI development," explained Alliance spokesperson Dr. Robert Chang. "By working together, we can ensure that AI technologies are developed responsibly and benefit all of humanity, not just the companies creating them."

      Key initiatives include:
      - Development of universal AI safety testing protocols
      - Creation of an AI ethics review board with independent oversight
      - Establishment of data privacy standards for AI training
      - Collaborative research on AI alignment and control mechanisms
      - Public disclosure requirements for large-scale AI deployments

      The announcement comes amid growing concerns about AI safety, with governments worldwide considering new regulations for AI development. The alliance aims to proactively address these concerns through self-regulation and transparency.

      Critics, however, question whether tech companies can effectively regulate themselves. "While this is a positive step, we still need strong governmental oversight," argued technology policy expert Dr. Amanda Foster. "History has shown that industry self-regulation often falls short when profit motives are involved."

      The alliance plans to publish its first set of guidelines within six months and will hold quarterly public forums to gather community feedback.`,
      time: '6 hours ago',
      author: 'Dr. Robert Chang',
      image: <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87m-4-12a4 4 0 0 1 0 7.75"/></svg>
    },
    {
      id: 4,
      category: 'gaming',
      categoryLabel: 'Gaming',
      title: 'Next-Gen Graphics Cards Hit Record Performance Benchmarks',
      excerpt: 'Latest GPU releases shatter expectations with real-time ray tracing capabilities and unprecedented rendering speeds.',
      fullContent: `The gaming industry witnessed a major milestone today as newly released graphics cards from leading manufacturers achieved unprecedented performance benchmarks, setting new standards for real-time ray tracing and AI-enhanced rendering.

      The latest generation GPUs, featuring revolutionary architecture and advanced cooling systems, deliver performance improvements of up to 300% over their predecessors in ray tracing workloads. These cards represent the culmination of years of research into specialized hardware acceleration for photorealistic rendering.

      "What we're seeing is nothing short of remarkable," said gaming technology analyst Kevin Morrison. "These cards can render complex scenes with full path tracing at playable frame rates, something that seemed impossible just a few years ago."

      Key features of the new GPU generation include:
      - 3rd generation ray tracing cores with enhanced efficiency
      - AI-powered frame generation technology
      - GDDR7 memory with bandwidth exceeding 1TB/s
      - Advanced power management for improved efficiency
      - Native support for 8K gaming at high refresh rates

      Early adopters report smooth gameplay experiences in the most demanding titles, with frame rates remaining consistently high even with all visual effects maxed out. Virtual reality applications have also seen dramatic improvements in both visual quality and performance.

      The new cards utilize a revolutionary chiplet architecture, allowing for better yields and more efficient manufacturing. This has enabled manufacturers to include significantly more compute units and memory bandwidth without dramatically increasing power consumption.

      However, the advanced technology comes at a premium price point, with flagship models starting at $1,599. Industry analysts predict that prices will stabilize as manufacturing scales up and competition intensifies in the coming months.

      Game developers are already optimizing their upcoming titles to take advantage of the new hardware capabilities. Several major releases scheduled for next year have announced enhanced graphics modes specifically designed for these new GPUs.`,
      time: '8 hours ago',
      author: 'Kevin Morrison',
      image: <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
    }
  ]

  const trending = [
    { rank: 1, topic: 'Quantum Computing', posts: '145K' },
    { rank: 2, topic: 'Cybersecurity', posts: '98K' },
    { rank: 3, topic: 'AI Development', posts: '87K' },
    { rank: 4, topic: 'Next-Gen Gaming', posts: '76K' },
    { rank: 5, topic: 'Data Privacy', posts: '65K' }
  ]

  const categoryArticles: Record<string, Array<{id: number, title: string, excerpt: string, time: string}>> = {
    world: [
      { id: 101, title: 'Global Climate Summit Reaches Historic Agreement', excerpt: '195 nations commit to carbon neutrality by 2050 in landmark environmental accord.', time: '1 hour ago' },
      { id: 102, title: 'International Space Station Expansion Project Approved', excerpt: 'Seven countries collaborate on new research modules for extended orbital operations.', time: '3 hours ago' },
      { id: 103, title: 'Renewable Energy Surpasses Fossil Fuels in Major Economy', excerpt: 'Historic milestone as wind and solar power generation exceeds coal and natural gas.', time: '5 hours ago' },
      { id: 104, title: 'Diplomatic Breakthrough in Long-Standing Trade Dispute', excerpt: 'Major trading partners announce comprehensive agreement after years of negotiations.', time: '7 hours ago' },
      { id: 105, title: 'Global Health Organization Announces New Pandemic Preparedness Plan', excerpt: 'Comprehensive framework aims to prevent future health crises through international cooperation.', time: '9 hours ago' },
      { id: 106, title: 'Ocean Conservation Treaty Signed by 120 Nations', excerpt: 'Unprecedented agreement protects 30% of international waters by 2030.', time: '11 hours ago' },
      { id: 107, title: 'International Education Initiative Launches Worldwide', excerpt: 'Global partnership aims to provide free online education to underserved communities.', time: '13 hours ago' },
      { id: 108, title: 'Major Archaeological Discovery Rewrites Ancient History', excerpt: 'Artifacts found in remote region challenge previous understanding of early civilizations.', time: '15 hours ago' },
      { id: 109, title: 'Cross-Continental Infrastructure Project Breaks Ground', excerpt: 'Ambitious transportation network to connect three continents via high-speed rail.', time: '17 hours ago' },
      { id: 110, title: 'Global Tech Conference Showcases Future Innovations', excerpt: 'Thousands gather to witness demonstrations of technologies shaping the next decade.', time: '19 hours ago' }
    ],
    tech: [
      { id: 201, title: 'AI Model Achieves Human-Level Understanding in Complex Tasks', excerpt: 'New neural architecture demonstrates remarkable reasoning and problem-solving abilities.', time: '30 minutes ago' },
      { id: 202, title: 'Revolutionary Battery Technology Promises 1000-Mile Range', excerpt: 'Solid-state battery breakthrough could transform electric vehicle industry.', time: '2 hours ago' },
      { id: 203, title: 'Breakthrough in Quantum Error Correction Announced', excerpt: 'Researchers develop method to dramatically reduce quantum computing errors.', time: '4 hours ago' },
      { id: 204, title: '6G Wireless Technology Prototype Achieves Record Speeds', excerpt: 'Next-generation network demonstrates 1 terabit per second data transmission.', time: '6 hours ago' },
      { id: 205, title: 'Brain-Computer Interface Enables Thought-to-Text Communication', excerpt: 'Paralyzed patients able to communicate at conversational speeds using neural implant.', time: '8 hours ago' },
      { id: 206, title: 'Fusion Reactor Sustains Plasma for Record Duration', excerpt: 'Experimental facility maintains fusion reaction for 17 minutes continuously.', time: '10 hours ago' },
      { id: 207, title: 'Holographic Display Technology Enters Consumer Market', excerpt: 'First commercial glasses-free 3D displays available for home entertainment.', time: '12 hours ago' },
      { id: 208, title: 'DNA Data Storage System Achieves Petabyte Capacity', excerpt: 'Biological storage medium offers unprecedented density and longevity.', time: '14 hours ago' },
      { id: 209, title: 'Autonomous Drone Delivery Service Expands to 50 Cities', excerpt: 'Fully automated aerial logistics network handles millions of daily deliveries.', time: '16 hours ago' },
      { id: 210, title: 'Nanobot Swarm Successfully Targets Cancer Cells', excerpt: 'Microscopic robots deliver precision medicine directly to tumors.', time: '18 hours ago' }
    ],
    business: [
      { id: 301, title: 'Tech Unicorn Achieves Record-Breaking IPO Valuation', excerpt: 'Cloud computing startup surpasses $100 billion market cap on first trading day.', time: '45 minutes ago' },
      { id: 302, title: 'Major Merger Creates New Industry Leader', excerpt: 'Two Fortune 500 companies combine in $85 billion deal.', time: '3 hours ago' },
      { id: 303, title: 'Cryptocurrency Adoption Reaches Mainstream Milestone', excerpt: 'Major payment processors integrate digital currencies for everyday transactions.', time: '5 hours ago' },
      { id: 304, title: 'Remote Work Transformation Reshapes Office Real Estate', excerpt: 'Companies adapt to hybrid models, triggering major shifts in commercial property.', time: '7 hours ago' },
      { id: 305, title: 'Sustainable Investment Funds Outperform Traditional Markets', excerpt: 'ESG-focused portfolios show superior returns over five-year period.', time: '9 hours ago' },
      { id: 306, title: 'E-Commerce Giant Opens Physical Retail Locations', excerpt: 'Online retailer launches brick-and-mortar stores with advanced automation.', time: '11 hours ago' },
      { id: 307, title: 'Startup Ecosystem Attracts Record Venture Capital', excerpt: 'Investors pour $200 billion into emerging technology companies this quarter.', time: '13 hours ago' },
      { id: 308, title: 'Supply Chain Innovation Reduces Global Shipping Times', excerpt: 'New logistics platform cuts international delivery periods by 40%.', time: '15 hours ago' }
    ],
    gaming: [
      { id: 401, title: 'VR MMO Breaks Player Count Records on Launch Day', excerpt: 'Fully immersive virtual world attracts 10 million concurrent players.', time: '1 hour ago' },
      { id: 402, title: 'Esports Tournament Offers $50 Million Prize Pool', excerpt: 'Record-breaking competition attracts top teams from 40 countries.', time: '3 hours ago' },
      { id: 403, title: 'Cloud Gaming Service Eliminates Download Requirements', excerpt: 'New streaming technology enables instant play of AAA titles on any device.', time: '5 hours ago' },
      { id: 404, title: 'AI-Generated Game Content Revolutionizes Development', excerpt: 'Procedural systems create infinite unique adventures for players.', time: '7 hours ago' },
      { id: 405, title: 'Haptic Feedback Suits Bring Physical Sensation to VR', excerpt: 'Full-body wearable technology enhances immersion in virtual environments.', time: '9 hours ago' },
      { id: 406, title: 'Retro Gaming Platform Preserves Classic Titles', excerpt: 'New service makes thousands of legacy games playable on modern hardware.', time: '11 hours ago' },
      { id: 407, title: 'Cross-Platform Play Becomes Industry Standard', excerpt: 'Major publishers commit to unified multiplayer across all platforms.', time: '13 hours ago' },
      { id: 408, title: 'Game Subscription Service Reaches 100 Million Users', excerpt: 'Netflix-style gaming platform demonstrates market shift from ownership to access.', time: '15 hours ago' }
    ]
  }

  const handleArticleClick = (articleId: number) => {
    setSelectedArticleId(articleId)
    setCurrentView('article')
  }

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category)
    setCurrentView('category')
  }

  const handleBackToHome = () => {
    setCurrentView('home')
    setSelectedArticleId(null)
    setSelectedCategory('home')
  }

  // Render article detail view
  if (currentView === 'article' && selectedArticleId !== null) {
    const article = newsArticles.find(a => a.id === selectedArticleId)
    if (!article) return <div>Article not found</div>

    return (
      <div className="home-website">
        <header className="home-header">
          <div className="home-logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span>AXI News</span>
          </div>
          <nav className="home-nav">
            <span className="nav-item" onClick={handleBackToHome}>Home</span>
            <span className="nav-item" onClick={() => handleCategoryClick('world')}>World</span>
            <span className="nav-item" onClick={() => handleCategoryClick('tech')}>Tech</span>
            <span className="nav-item" onClick={() => handleCategoryClick('business')}>Business</span>
            <span className="nav-item" onClick={() => handleCategoryClick('gaming')}>Gaming</span>
          </nav>
        </header>

        <div className="article-view">
          <button className="back-button" onClick={handleBackToHome}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Home
          </button>

          <article className="article-detail">
            <div className="article-category-badge">{article.categoryLabel}</div>
            <h1 className="article-title">{article.title}</h1>
            <div className="article-meta">
              <span className="article-author">By {article.author}</span>
              <span className="article-divider">•</span>
              <span className="article-time">{article.time}</span>
            </div>
            <div className="article-icon-large">{article.image}</div>
            <div className="article-body">
              {article.fullContent.split('\n\n').map((paragraph, idx) => (
                <p key={idx}>{paragraph.trim()}</p>
              ))}
            </div>
          </article>

          <aside className="article-sidebar">
            <div className="related-articles">
              <h3>Related Articles</h3>
              {newsArticles.filter(a => a.id !== article.id).slice(0, 3).map(related => (
                <div key={related.id} className="related-item" onClick={() => handleArticleClick(related.id)}>
                  <h4>{related.title}</h4>
                  <span className="related-time">{related.time}</span>
                </div>
              ))}
            </div>

            <div className="trending-widget">
              <h3>Trending Topics</h3>
              {trending.map((item) => (
                <div key={item.rank} className="trending-item">
                  <span className="trending-rank">#{item.rank}</span>
                  <div className="trending-info">
                    <span className="trending-topic">{item.topic}</span>
                    <span className="trending-posts">{item.posts} posts</span>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    )
  }

  // Render category view
  if (currentView === 'category' && selectedCategory !== 'home') {
    const articles = categoryArticles[selectedCategory] || []
    const categoryName = selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)

    return (
      <div className="home-website">
        <header className="home-header">
          <div className="home-logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span>AXI News</span>
          </div>
          <nav className="home-nav">
            <span className="nav-item" onClick={handleBackToHome}>Home</span>
            <span className={`nav-item ${selectedCategory === 'world' ? 'active' : ''}`} onClick={() => handleCategoryClick('world')}>World</span>
            <span className={`nav-item ${selectedCategory === 'tech' ? 'active' : ''}`} onClick={() => handleCategoryClick('tech')}>Tech</span>
            <span className={`nav-item ${selectedCategory === 'business' ? 'active' : ''}`} onClick={() => handleCategoryClick('business')}>Business</span>
            <span className={`nav-item ${selectedCategory === 'gaming' ? 'active' : ''}`} onClick={() => handleCategoryClick('gaming')}>Gaming</span>
          </nav>
        </header>

        <div className="category-view">
          <button className="back-button" onClick={handleBackToHome}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Home
          </button>

          <div className="category-header">
            <h1>{categoryName}</h1>
            <p>Latest news and updates in {categoryName.toLowerCase()}</p>
          </div>

          <div className="category-articles">
            {articles.map(article => (
              <div key={article.id} className="category-article-card">
                <h3 className="category-article-title">{article.title}</h3>
                <p className="category-article-excerpt">{article.excerpt}</p>
                <span className="category-article-time">{article.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Render home view (default)
  return (
    <div className="home-website">
      {/* Header */}
      <header className="home-header">
        <div className="home-logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M2 12h20"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <span>AXI News</span>
        </div>
        <nav className="home-nav">
          <span className="nav-item active">Home</span>
          <span className="nav-item" onClick={() => handleCategoryClick('world')}>World</span>
          <span className="nav-item" onClick={() => handleCategoryClick('tech')}>Tech</span>
          <span className="nav-item" onClick={() => handleCategoryClick('business')}>Business</span>
          <span className="nav-item" onClick={() => handleCategoryClick('gaming')}>Gaming</span>
        </nav>
      </header>

      {/* Main Content */}
      <div className="home-content">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-badge">BREAKING NEWS</div>
          <h1 className="hero-title">Global Tech Summit Announces Revolutionary Discoveries</h1>
          <p className="hero-subtitle">World leaders and innovators gather to unveil groundbreaking technologies that will shape the next decade</p>
          <div className="hero-meta">
            <span>By AXI News Team</span>
            <span>•</span>
            <span>1 hour ago</span>
          </div>
        </section>

        {/* Main Grid */}
        <div className="content-grid">
          {/* News Feed */}
          <section className="news-feed">
            <h2 className="section-title">Latest Headlines</h2>
            <div className="news-list">
              {newsArticles.map(article => (
                <article key={article.id} className="news-card" onClick={() => handleArticleClick(article.id)}>
                  <div className="news-icon">{article.image}</div>
                  <div className="news-content">
                    <div className="news-category">{article.categoryLabel}</div>
                    <h3 className="news-title">{article.title}</h3>
                    <p className="news-excerpt">{article.excerpt}</p>
                    <div className="news-meta">{article.time}</div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Sidebar */}
          <aside className="sidebar">
            {/* Weather Widget */}
            <div className="widget weather-widget">
              <h3 className="widget-title">Weather</h3>
              <div className="weather-display">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
                <div className="weather-temp">72°F</div>
                <div className="weather-desc">Sunny</div>
              </div>
            </div>

            {/* Trending Widget */}
            <div className="widget trending-widget">
              <h3 className="widget-title">Trending Topics</h3>
              <div className="trending-list">
                {trending.map(item => (
                  <div key={item.rank} className="trending-item">
                    <span className="trending-rank">#{item.rank}</span>
                    <div className="trending-info">
                      <div className="trending-topic">{item.topic}</div>
                      <div className="trending-posts">{item.posts} posts</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Market Widget */}
            <div className="widget market-widget">
              <h3 className="widget-title">Market Overview</h3>
              <div className="market-stats">
                <div className="market-stat">
                  <span className="stat-label">BTC/USD</span>
                  <span className="stat-value positive">$45,234 ↑</span>
                </div>
                <div className="market-stat">
                  <span className="stat-label">ETH/USD</span>
                  <span className="stat-value positive">$3,128 ↑</span>
                </div>
                <div className="market-stat">
                  <span className="stat-label">TECH Index</span>
                  <span className="stat-value negative">15,823 ↓</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
