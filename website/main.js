document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. Theme Management (Light / Dark Mode)
  // ==========================================
  const themeToggleBtns = document.querySelectorAll('.theme-toggle-btn');
  const body = document.body;

  // Retrieve previous preference or default to system dark mode preference
  const currentTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (currentTheme === 'dark' || (!currentTheme && systemPrefersDark)) {
    body.classList.add('dark-mode');
    updateToggleIcons(true);
  } else {
    body.classList.remove('dark-mode');
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
});
