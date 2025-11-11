import React from 'react'
import './DesktopBranding.css'

export const DesktopBranding: React.FC = () => {
  return (
    <div className="desktop-branding">
      <div className="branding-container">
        <div className="desktop-logo-wrapper">
          <svg className="desktop-logo-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            {/* Hexagonal frame */}
            <polygon 
              className="desktop-logo-hex"
              points="50,5 90,25 90,65 50,85 10,65 10,25" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            />
            
            {/* Inner circuit pattern */}
            <circle className="desktop-logo-node" cx="50" cy="30" r="3" fill="currentColor" />
            <circle className="desktop-logo-node" cx="70" cy="45" r="3" fill="currentColor" />
            <circle className="desktop-logo-node" cx="50" cy="60" r="3" fill="currentColor" />
            <circle className="desktop-logo-node" cx="30" cy="45" r="3" fill="currentColor" />
            
            <line className="desktop-logo-line" x1="50" y1="30" x2="70" y2="45" stroke="currentColor" strokeWidth="1.5" />
            <line className="desktop-logo-line" x1="70" y1="45" x2="50" y2="60" stroke="currentColor" strokeWidth="1.5" />
            <line className="desktop-logo-line" x1="50" y1="60" x2="30" y2="45" stroke="currentColor" strokeWidth="1.5" />
            <line className="desktop-logo-line" x1="30" y1="45" x2="50" y2="30" stroke="currentColor" strokeWidth="1.5" />
            
            {/* Center glow */}
            <circle className="desktop-logo-core" cx="50" cy="45" r="8" fill="currentColor" />
          </svg>
        </div>
        
        <div className="branding-text">
          <h1 className="brand-title">
            <span className="brand-letter">T</span>
            <span className="brand-letter">E</span>
            <span className="brand-letter">R</span>
            <span className="brand-letter">M</span>
            <span className="brand-letter">I</span>
            <span className="brand-letter">N</span>
            <span className="brand-letter">A</span>
            <span className="brand-letter">L</span>
            <span className="brand-letter">I</span>
            <span className="brand-letter">T</span>
            <span className="brand-letter">Y</span>
          </h1>
          <div className="brand-subtitle">
            <span className="subtitle-text">O P E R A T I N G</span>
            <span className="subtitle-separator">•</span>
            <span className="subtitle-text">S Y S T E M</span>
          </div>
          <div className="brand-version">v1.0.0-alpha</div>
        </div>
        
        <div className="scan-line"></div>
      </div>
    </div>
  )
}
