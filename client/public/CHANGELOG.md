# Changelog

All notable changes to Terminality OS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.4] - 2025-11-12

### Added
- **About Page Designer**: A complete aesthetic upgrade adding grid background, scanlines, particles, floating logo, and pulsing brackets to match the App Store and system-wide visual language.

### Changed
- **Music Player UI**: Matched progress bar, volume slider, and track scrollbar colors to the App Store system theme; made control buttons smaller and inline; standardized icon and slider colors to use `--color-primary` and `--color-primary-rgb` variables.
- **About Page**: Upgraded panels and sections to use the cyberpunk terminal aesthetic (sharper cards, glows, hover effects, enhanced headings, elevated copy/version/tags).
- **Color Consistency**: Replaced remaining hardcoded green values with theme variables across several apps for consistent theme adaptation.

### Fixed
- **Scrollbar & Slider Visuals**: Removed dark borders around slider thumbs, aligned their glows and hover states to the system theme color.
- **Accessibility**: Improved contrast for headings, info rows, and interactive controls.

## [0.5.3] - 2025-11-12

### Added
- **Changelog System**: Centralized version tracking and changelog management
- **Version File**: Automated version management in `client/src/version.ts`
- **ProfileApp UI Redesign**: Complete redesign matching system design language
- **UserManagementApp UI Redesign**: Complete redesign matching system design language

### Changed
- **ProfileApp**: Updated to use CSS variables for theme integration
- **UserManagementApp**: Updated to use CSS variables for theme integration
- **Color Consistency**: Both apps now automatically adapt to theme changes
- **Typography**: Standardized font sizes, letter spacing, and weights across apps
- **Glassmorphism**: Consistent backdrop-filter and border styling

### Fixed
- **About Page**: Fixed desktop context menu "About" button to properly open System Settings
- **Theme Integration**: Apps now correctly use --color-primary, --color-text, --color-surface variables

## [0.5.2] - 2025-11-10

### Added
- **Login Screen Particles**: 40 ambient particle effects on login screen for immersive atmosphere

### Changed
- **Audio Context**: Improved error handling for audio context initialization

## [0.5.1] - 2025-11-10

### Added
- **System Monitor**: Collapse/expand feature for system monitor
- **Z-Index Management**: Improved layering for system components

### Changed
- **System Monitor**: Streamlined with compact width and minimal design

## [0.4.0] - 2025-11-10

### Added
- **Immersive Article System**: Full article pages with detailed content on Home website
- **Category Navigation**: Dedicated pages for World, Tech, Business, Gaming categories
- **Browser Scroll Behavior**: Auto scroll to top on navigation

### Changed
- **News Website**: Enhanced with breaking news, trending topics, weather widget, and market overview

## [0.3.0] - 2025-11-10

### Added
- **Home Website**: New fake news homepage with comprehensive content
- **Modern File Explorer**: Windows/Mac-style UI with large folder/file icons
- **SVG Icon System**: Complete monotone SVG icon replacement across all applications
- **Navigation Controls**: Back/refresh buttons in File Explorer

### Fixed
- **Sticky Headers**: All website headers now properly stick to top while scrolling
- **Browser Layout**: Fixed toolbar and bookmark bar staying fixed while viewport scrolls
- **ThreadIt Alignment**: Create Post and Log In buttons properly aligned to right edge

## [0.2.0] - 2025-11-08

### Added
- **Multi-window Management**: Drag, resize, minimize, and maximize windows
- **Terminal Emulator**: Command execution with virtual filesystem
- **Music Player**: Playlist support with now playing bar
- **Email & Chat Apps**: Communication interfaces
- **Social Apps**: Instagram and Reddit website simulations
- **Theme System**: Multiple color themes with live preview

### Changed
- **Window Memory**: Persistent window positions and sizes across sessions
- **Desktop Icons**: Auto-arrange functionality

## [0.1.0] - 2025-11-01

### Added
- Initial release of Terminality OS
- Basic desktop environment
- Lock screen with authentication
- Window management system
- File explorer foundation
- Notepad application
- Basic browser functionality
- Settings panel

---

## [0.5.5] - 2025-11-12

### Added
- **Proxy Chain Icon**: Replaced network placeholder with a system-style SVG to match the UI iconography.

### Changed
- **Store Search**: Centered the search input horizontally and vertically; added a max-width for better layout on large screens and restored left-aligned placeholder text.
- **App Store**: Background effects are confined to the app window (position: absolute), categories now wrap to avoid a scrollbar, and featured section spacing was adjusted to prevent overlap.
- **About Page**: Minor content and presentation tweaks to reflect release notes and make changelog highlights more prominent.

### Fixed
- **Layout Overlap**: Fixed featured items overlapping the category row and prevented background effects bleeding over windows.
- **System Monitor**: Ensured the system monitor always stays behind application windows.

## Version History Quick Reference

- **v0.5.3** (Nov 12, 2025) - UI redesign, changelog system, version management
- **v0.5.2** (Nov 10, 2025) - Login screen particles, audio improvements
- **v0.5.1** (Nov 10, 2025) - System monitor enhancements
- **v0.4.0** (Nov 10, 2025) - Article system, category navigation
- **v0.3.0** (Nov 10, 2025) - Home website, modern file explorer, SVG icons
- **v0.2.0** (Nov 08, 2025) - Core applications and theme system
- **v0.1.0** (Nov 01, 2025) - Initial release
