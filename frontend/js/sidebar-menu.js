document.addEventListener("DOMContentLoaded", function () {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const openBtn = document.getElementById("openSidebar");
  const closeBtn = document.getElementById("closeSidebar");

  if (!sidebar || !overlay) return;

  function openSidebar() {
    sidebar.classList.remove("-translate-x-full");
    overlay.classList.remove("hidden");
    document.body.classList.add("overflow-hidden");
  }

  function closeSidebar() {
    sidebar.classList.add("-translate-x-full");
    overlay.classList.add("hidden");
    document.body.classList.remove("overflow-hidden");
  }

  if (openBtn) {
    openBtn.addEventListener("click", openSidebar);
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeSidebar);
  }

  overlay.addEventListener("click", closeSidebar);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeSidebar();
    }
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth >= 1024) {
      overlay.classList.add("hidden");
      document.body.classList.remove("overflow-hidden");
      sidebar.classList.remove("-translate-x-full");
    } else {
      sidebar.classList.add("-translate-x-full");
    }
  });
});