document.addEventListener('DOMContentLoaded', () => {
  const SIGNALING_BASE_URL = (() => {
    const configured = import.meta.env.VITE_SIGNALING_URL || 'https://cinepair-signaling.onrender.com';
    if (/^https?:\/\//i.test(configured)) {
      return configured;
    }
    return `https://${configured}`;
  })();

  // ==========================================
  // 1. Theme Management (Light / Dark Mode)
  // ==========================================
  const themeToggleBtns = document.querySelectorAll('.theme-toggle-btn');
  const body = document.body;

  // Retrieve saved theme preference; default to Light Mode
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    body.classList.add('dark-mode');
    updateToggleIcons(true);
  } else {
    body.classList.remove('dark-mode'); // Light mode default
    updateToggleIcons(false);
  }

  themeToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const isDark = body.classList.toggle('dark-mode');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      updateToggleIcons(isDark);
    });
  });

  function updateToggleIcons(isDark) {
    themeToggleBtns.forEach(btn => {
      const textSpan = btn.querySelector('.theme-text');
      const iconSpan = btn.querySelector('.theme-icon');
      if (isDark) {
        if (textSpan) textSpan.textContent = 'Light Mode';
        if (iconSpan) iconSpan.textContent = '☀️';
      } else {
        if (textSpan) textSpan.textContent = 'Dark Mode';
        if (iconSpan) iconSpan.textContent = '🌙';
      }
    });
  }

  // ==========================================
  // 2. Entrance Scroll Animations (Scroll-Reveal)
  // ==========================================
  const revealElements = document.querySelectorAll('.scroll-reveal');

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        // Once animated, no need to observe again
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach(element => {
    revealObserver.observe(element);
  });

  // ==========================================
  // 3. Interactive Screenshare Overlay Demo
  // ==========================================
  const demoProfile = document.getElementById('demoProfile');
  const demoScreen = document.getElementById('demoScreen');
  const toggleShapeBtn = document.getElementById('btnToggleShape');
  const resizeLargerBtn = document.getElementById('btnResizeLarger');
  const resizeSmallerBtn = document.getElementById('btnResizeSmaller');
  const toggleSelfBtn = document.getElementById('btnToggleSelf');

  if (demoProfile && demoScreen) {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;
    let currentScale = 1.0;
    let isSquare = false;
    let isVisible = true;

    // A. Drag & Drop Logic (Mouse and Touch)
    const startDrag = (e) => {
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      
      isDragging = true;
      const rect = demoProfile.getBoundingClientRect();
      offsetX = clientX - rect.left - (rect.width / 2);
      offsetY = clientY - rect.top - (rect.height / 2);
      demoProfile.style.transition = 'none'; // Temporarily disable transitions during drag
    };

    const doDrag = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      
      const containerRect = demoScreen.getBoundingClientRect();
      const profileRect = demoProfile.getBoundingClientRect();
      
      // Calculate new relative position
      let x = clientX - containerRect.left - offsetX - (profileRect.width / 2);
      let y = clientY - containerRect.top - offsetY - (profileRect.height / 2);
      
      // Keep boundaries restricted inside screen frame
      const maxX = containerRect.width - profileRect.width;
      const maxY = containerRect.height - profileRect.height;
      
      x = Math.max(0, Math.min(x, maxX));
      y = Math.max(0, Math.min(y, maxY));
      
      demoProfile.style.left = `${x}px`;
      demoProfile.style.top = `${y}px`;
    };

    const stopDrag = () => {
      if (isDragging) {
        isDragging = false;
        demoProfile.style.transition = 'border-radius 0.3s ease, transform 0.2s ease';
      }
    };

    // Attach listeners for drag
    demoProfile.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', stopDrag);

    demoProfile.addEventListener('touchstart', startDrag, { passive: false });
    window.addEventListener('touchmove', doDrag, { passive: false });
    window.addEventListener('touchend', stopDrag);

    // B. Options and Control Buttons
    // Shape Toggle (Circle vs Square)
    if (toggleShapeBtn) {
      toggleShapeBtn.addEventListener('click', () => {
        isSquare = !isSquare;
        if (isSquare) {
          demoProfile.classList.add('square');
          toggleShapeBtn.textContent = 'Shape: Square';
        } else {
          demoProfile.classList.remove('square');
          toggleShapeBtn.textContent = 'Shape: Circle';
        }
      });
    }

    // Resize Larger
    if (resizeLargerBtn) {
      resizeLargerBtn.addEventListener('click', () => {
        if (currentScale < 1.6) {
          currentScale += 0.2;
          applyTransform();
        }
      });
    }

    // Resize Smaller
    if (resizeSmallerBtn) {
      resizeSmallerBtn.addEventListener('click', () => {
        if (currentScale > 0.6) {
          currentScale -= 0.2;
          applyTransform();
        }
      });
    }

    // Hide / Show Self View
    if (toggleSelfBtn) {
      toggleSelfBtn.addEventListener('click', () => {
        isVisible = !isVisible;
        if (isVisible) {
          demoProfile.style.display = 'flex';
          toggleSelfBtn.textContent = 'Self View: On';
        } else {
          demoProfile.style.display = 'none';
          toggleSelfBtn.textContent = 'Self View: Off';
        }
      });
    }

    function applyTransform() {
      demoProfile.style.transform = `scale(${currentScale})`;
    }
  }

  // ==========================================
  // 4. Hamburger Mobile Navigation Menu
  // ==========================================
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const mobileMenuDrawer = document.getElementById('mobileMenuDrawer');
  const mobileNavLinks = document.querySelectorAll('.nav-link-mobile');

  if (mobileMenuToggle && mobileMenuDrawer) {
    mobileMenuToggle.addEventListener('click', () => {
      const isActive = mobileMenuToggle.classList.toggle('active');
      mobileMenuDrawer.classList.toggle('active', isActive);
      document.body.style.overflow = isActive ? 'hidden' : '';
    });

    mobileNavLinks.forEach(link => {
      link.addEventListener('click', () => {
        mobileMenuToggle.classList.remove('active');
        mobileMenuDrawer.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  // ==========================================
  // 4.5 Live Active Room Count
  // ==========================================
  const activeRoomCount = document.getElementById('activeRoomCount');

  if (activeRoomCount) {
    const loadActiveRoomCount = async () => {
      try {
        const response = await fetch(new URL('/stats', SIGNALING_BASE_URL), {
          headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) throw new Error(`Status ${response.status}`);

        const data = await response.json();
        const count = typeof data.active_rooms === 'number' ? data.active_rooms : null;
        activeRoomCount.textContent = count === null ? '--' : String(count);
      } catch (err) {
        console.warn('Failed to fetch live room count.', err);
        activeRoomCount.textContent = '--';
      }
    };

    loadActiveRoomCount();
    window.setInterval(loadActiveRoomCount, 30000);
  }

  // ==========================================
  // 5. Dynamic Release Center Fetching
  // ==========================================
  const GITHUB_RELEASES_API = 'https://api.github.com/repos/Mr-Dark-debug/cinepair/releases';
  const latestVersionTitle = document.getElementById('latestVersionTitle');
  const latestReleaseDate = document.getElementById('latestReleaseDate');
  const btnWinExe = document.getElementById('btnWinExe');
  const btnWinMsi = document.getElementById('btnWinMsi');
  const olderReleasesList = document.getElementById('olderReleasesList');

  if (latestVersionTitle && olderReleasesList) {
    async function loadDownloads() {
      let releases = [];
      try {
        const response = await fetch(GITHUB_RELEASES_API);
        if (!response.ok) throw new Error(`Status ${response.status}`);
        releases = await response.json();
        if (!Array.isArray(releases) || releases.length === 0) throw new Error('Empty releases');
      } catch (err) {
        console.warn('Failed to fetch from GitHub API, loading fallbacks.', err);
        releases = getFallbackReleases();
      }

      renderDownloads(releases);
    }

    function formatDate(dateString) {
      if (!dateString) return 'RECENTLY';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).toUpperCase();
    }

    function renderDownloads(releases) {
      const latest = releases[0];
      latestVersionTitle.textContent = `CinePair Stable ${latest.tag_name}`;
      latestReleaseDate.textContent = `PUBLISHED ON ${formatDate(latest.published_at)}`;

      let latestExeUrl = `https://github.com/Mr-Dark-debug/cinepair/releases/tag/${latest.tag_name}`;
      let latestMsiUrl = `https://github.com/Mr-Dark-debug/cinepair/releases/tag/${latest.tag_name}`;

      if (latest.assets && Array.isArray(latest.assets)) {
        const exeAsset = latest.assets.find(a => a.name.endsWith('.exe'));
        const msiAsset = latest.assets.find(a => a.name.endsWith('.msi'));
        if (exeAsset) latestExeUrl = exeAsset.browser_download_url;
        if (msiAsset) latestMsiUrl = msiAsset.browser_download_url;
      }

      if (btnWinExe) btnWinExe.href = latestExeUrl;
      if (btnWinMsi) btnWinMsi.href = latestMsiUrl;

      olderReleasesList.innerHTML = '';
      const previousReleases = releases.slice(1);

      if (previousReleases.length === 0) {
        olderReleasesList.innerHTML = `
          <div style="text-align: center; padding: 24px; border: 1px dashed var(--color-hairline); border-radius: 14px; opacity: 0.6; font-size: 14px; color: var(--color-ink);">
            No older releases available. You are running the first version!
          </div>
        `;
        return;
      }

      previousReleases.forEach(rel => {
        let exeUrl = `https://github.com/Mr-Dark-debug/cinepair/releases/tag/${rel.tag_name}`;
        let msiUrl = `https://github.com/Mr-Dark-debug/cinepair/releases/tag/${rel.tag_name}`;
        let hasExe = false;
        let hasMsi = false;

        if (rel.assets && Array.isArray(rel.assets)) {
          const exeAsset = rel.assets.find(a => a.name.endsWith('.exe'));
          const msiAsset = rel.assets.find(a => a.name.endsWith('.msi'));
          if (exeAsset) { exeUrl = exeAsset.browser_download_url; hasExe = true; }
          if (msiAsset) { msiUrl = msiAsset.browser_download_url; hasMsi = true; }
        }

        const row = document.createElement('div');
        row.className = 'older-release-row';
        row.innerHTML = `
          <div class="older-release-meta">
            <span class="older-release-tag">${rel.tag_name}</span>
            <span class="older-release-name">${rel.name || 'CinePair Release'}</span>
            <time class="older-release-date" datetime="${rel.published_at}">${formatDate(rel.published_at)}</time>
          </div>
          <div class="older-release-actions">
            <a href="${exeUrl}" class="btn-download-sm ${hasExe ? 'btn-primary' : 'btn-secondary'}" style="text-decoration: none;">
              📥 Windows EXE
            </a>
            <a href="${msiUrl}" class="btn-download-sm btn-secondary" style="text-decoration: none;">
              📦 Windows MSI
            </a>
          </div>
        `;
        olderReleasesList.appendChild(row);
      });
    }

    function getFallbackReleases() {
      return [
        {
          tag_name: 'v0.1.0',
          name: 'CinePair Stable Release',
          published_at: '2026-05-29T17:30:00Z',
          assets: [
            {
              name: 'CinePair_0.1.0_x64.exe',
              browser_download_url: 'https://github.com/Mr-Dark-debug/cinepair/releases/download/v0.1.0/CinePair_0.1.0_x64.exe'
            },
            {
              name: 'CinePair_0.1.0_x64_en-US.msi',
              browser_download_url: 'https://github.com/Mr-Dark-debug/cinepair/releases/download/v0.1.0/CinePair_0.1.0_x64_en-US.msi'
            }
          ]
        },
        {
          tag_name: 'v0.0.9-alpha',
          name: 'WebRTC Signaling Reliability Updates',
          published_at: '2026-05-18T10:30:00Z',
          assets: [
            {
              name: 'CinePair_0.0.9_x64.exe',
              browser_download_url: 'https://github.com/Mr-Dark-debug/cinepair/releases/download/v0.0.9-alpha/CinePair_0.0.9_x64.exe'
            },
            {
              name: 'CinePair_0.0.9_x64_en-US.msi',
              browser_download_url: 'https://github.com/Mr-Dark-debug/cinepair/releases/download/v0.0.9-alpha/CinePair_0.0.9_x64_en-US.msi'
            }
          ]
        },
        {
          tag_name: 'v0.0.5-alpha',
          name: 'CinePair Prototype Launch',
          published_at: '2026-04-20T14:15:00Z',
          assets: []
        }
      ];
    }

    loadDownloads();
  }
});
