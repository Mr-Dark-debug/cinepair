document.addEventListener('DOMContentLoaded', () => {
  const loadingContainer = document.getElementById('loadingContainer');
  const fallbackState = document.getElementById('fallbackState');
  const releasesTimeline = document.getElementById('releasesTimeline');
  const searchInput = document.getElementById('searchInput');
  const resultsCount = document.getElementById('resultsCount');

  // URL for CinePair public GitHub releases
  const GITHUB_RELEASES_API = 'https://api.github.com/repos/Mr-Dark-debug/cinepair/releases';
  
  let allReleases = [];

  // ==========================================
  // 1. Fetch Releases from GitHub
  // ==========================================
  async function fetchReleases() {
    try {
      const response = await fetch(GITHUB_RELEASES_API);
      if (!response.ok) {
        throw new Error(`GitHub API returned status ${response.status}`);
      }
      const data = await response.ok ? await response.json() : [];
      
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('No public releases found in the repository.');
      }
      
      return data;
    } catch (error) {
      console.warn('GitHub Releases API fetch failed. Reverting to offline fallback logs.', error);
      showFallbackState();
      return getOfflineFallbackReleases();
    }
  }

  // ==========================================
  // 2. Parse Markdown to Semantic HTML
  // ==========================================
  function parseMarkdown(mdText) {
    if (!mdText) return '<p>No description provided for this release.</p>';

    let html = mdText;

    // Convert Windows line endings
    html = html.replace(/\r\n/g, '\n');

    // Headers - replace ## title or ### title with h3
    html = html.replace(/^(?:###|##)\s*(.+)$/gm, '<h3>$1</h3>');

    // Bold text - **bold**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Monospace code backticks - `code`
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');

    // Bulleted lists (lines starting with - or *)
    // Process bullet points and group consecutive list items inside <ul> tags
    const lines = html.split('\n');
    let insideList = false;
    let listParsedLines = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      const bulletMatch = trimmed.match(/^[-*]\s*(.+)$/);

      if (bulletMatch) {
        if (!insideList) {
          listParsedLines.push('<ul>');
          insideList = true;
        }
        listParsedLines.push(`<li>${bulletMatch[1]}</li>`);
      } else {
        if (insideList) {
          listParsedLines.push('</ul>');
          insideList = false;
        }
        if (trimmed.length > 0 && !trimmed.startsWith('<h3')) {
          listParsedLines.push(`<p>${trimmed}</p>`);
        } else {
          listParsedLines.push(line);
        }
      }
    });

    if (insideList) {
      listParsedLines.push('</ul>');
    }

    return listParsedLines.join('\n');
  }

  // ==========================================
  // 3. Format Date
  // ==========================================
  function formatDate(dateString) {
    if (!dateString) return 'RECENTLY';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).toUpperCase();
  }

  // ==========================================
  // 4. Render Releases to DOM
  // ==========================================
  function renderReleases(releases) {
    releasesTimeline.innerHTML = '';
    
    if (releases.length === 0) {
      releasesTimeline.innerHTML = `
        <div style="text-align: center; padding: 48px; border: 1px dashed var(--color-hairline); border-radius: 20px;">
          <p style="font-size: 16px; opacity: 0.6;">No releases matches your current search criteria.</p>
        </div>
      `;
      resultsCount.textContent = '0 RELEASES';
      return;
    }

    resultsCount.textContent = `${releases.length} RELEASE${releases.length === 1 ? '' : 'S'}`;

    releases.forEach((release) => {
      const parsedBody = parseMarkdown(release.body);
      const formattedDate = formatDate(release.published_at);
      
      const itemElement = document.createElement('div');
      itemElement.className = 'timeline-item';
      itemElement.innerHTML = `
        <div class="timeline-dot"></div>
        <article class="release-card">
          <div class="release-meta">
            <span class="release-version-pill">${release.tag_name}</span>
            <time class="release-date" datetime="${release.published_at}">${formattedDate}</time>
          </div>
          <h2 class="release-title">${release.name || release.tag_name}</h2>
          <div class="release-body-content" style="margin-top: 16px;">
            ${parsedBody}
          </div>
        </article>
      `;
      releasesTimeline.appendChild(itemElement);
    });
  }

  // Show visual indicator that GitHub rate-limiting is active
  function showFallbackState() {
    fallbackState.style.display = 'block';
  }

  // ==========================================
  // 5. Offline Fallback Data Structure
  // ==========================================
  function getOfflineFallbackReleases() {
    return [
      {
        tag_name: 'v0.1.0',
        name: 'CinePair Official Stable Launch',
        published_at: '2026-05-29T17:30:00Z',
        body: `## 🚀 Features & Core Capabilities
* **Perfect Negotiation Integration**: Adopted the state-of-the-art W3C WebRTC Perfect Negotiation pattern to prevent signaling glare and guarantee highly robust connection channels.
* **Vibrant, High-Contrast Premium Dark Mode**: Deep midnight canvas (#0a0a0d) paired with highly vibrant, glowing pastel cards that pop with maximum contrast and uncompromised legibility.
* **Draggable Watcher Badges Overlay**: Users can overlay participant camera streams. Fully interactive with drag-and-drop mouse/touch support, circle vs square geometry toggle, and scaling sliders.
* **Web Audio System Mixer**: Mixes system screen-sharing audio and microphone voice feeds into a single unified AudioContext for premium sound mapping.
* **Lobby Approval Security**: Hosts can approve, decline, or ban inbound connection requests before they join the live cinema room.
* **Slack-Style Emoji Reactions**: Real-time emoji reaction pops that float on top of shared movies to show shared laughs.

## 🛠️ Enhancements & Security
* Built natively on Tauri v2 for low CPU/memory overhead (~15MB bundle).
* Zero cloud logs. Rooms are completely ephemeral and delete on termination.`
      },
      {
        tag_name: 'v0.0.9-alpha',
        name: 'WebRTC Signaling Reliability Updates',
        published_at: '2026-05-18T10:30:00Z',
        body: `## ⚙️ Core Enhancements
* **FastAPI Backend Relays**: Standardized FastAPI Socket.IO messaging exchanges for peer rooms.
* **ICE Connection Fixes**: Integrated fallback TURN and STUN endpoints for stable NAT traversals.
* **Chat Protocol Upgrade**: Implemented inline chat bubble logs with markdown emphasis and timestamp logs.`
      },
      {
        tag_name: 'v0.0.5-alpha',
        name: 'CinePair Prototype Launch',
        published_at: '2026-04-20T14:15:00Z',
        body: `## 🎬 Initial Milestone
* Native Tauri framing initialized for cross-platform desktop compilation.
* Direct peer-to-peer audio-video screensharing channel prototype.
* Minimalist black-and-white editorial aesthetic layout.`
      }
    ];
  }

  // ==========================================
  // 6. Search and Filter Handler
  // ==========================================
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase().trim();
      
      const filtered = allReleases.filter(release => {
        const titleMatch = (release.name || '').toLowerCase().includes(searchTerm);
        const tagMatch = (release.tag_name || '').toLowerCase().includes(searchTerm);
        const bodyMatch = (release.body || '').toLowerCase().includes(searchTerm);
        return titleMatch || tagMatch || bodyMatch;
      });

      renderReleases(filtered);
    });
  }

  // ==========================================
  // 7. Initialization Lifecycle
  // ==========================================
  async function init() {
    allReleases = await fetchReleases();
    
    // Hide loading animations
    if (loadingContainer) {
      loadingContainer.style.display = 'none';
    }
    
    // Display timeline and render
    if (releasesTimeline) {
      releasesTimeline.style.display = 'block';
      renderReleases(allReleases);
    }
  }

  init();
});
