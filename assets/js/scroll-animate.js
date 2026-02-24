(function () {
  function revealAll() {
    document.querySelectorAll('[data-animate]').forEach((el) => {
      el.classList.add('visible');
    });
  }

  function setup() {
    const animated = document.querySelectorAll('[data-animate]');
    if (!animated.length) return;

    if (!('IntersectionObserver' in window)) {
      revealAll();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    animated.forEach((el) => observer.observe(el));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
