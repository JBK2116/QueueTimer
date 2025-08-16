/**
 * Fixed Frontend Router for QueueTimer
 * Updated to work with http-server and root-level HTML files
 */
class Router {
  constructor() {
    this.routes = new Map();
    this.currentPath = null; // Track current path to prevent loops
    this.currentPage = null;
    this.appContainer = null;
    this.isLoading = false;

    this.init();
  }

  /* INITIALIZATION */
  init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    this.appContainer = document.querySelector("#app") || document.body;
    this.defineRoutes();
    this.bindEvents();
    this.handleInitialRoute();
  }

  /* ROUTE DEFINITIONS (UPDATE AS REQUIRED) */
  defineRoutes() {
    this.routes.set("/", {
      page: "index.html",
      title: "Home",
    });

    this.routes.set("/dashboard", {
      page: "dashboard.html",
      title: "Dashboard",
    });

    this.routes.set("/auth/login", {
      page: "/auth/login.html",
      title: "Login",
    });

    this.routes.set("/auth/register", {
      page: "/auth/register.html",
      title: "Register",
    });

    this.routes.set("/auth/forgot-password", {
      page: "/auth/forgot-password.html",
      title: "Forgot Password",
    });

    this.routes.set("/auth/reset-password", {
      page: "/auth/reset-password.html",
      title: "Reset Password",
    });

    this.routes.set("/auth/account", {
      page: "account.html",
      title: "Account",
    });
  }

  /* EVENT HANDLERS */
  bindEvents() {
    window.addEventListener("popstate", () => {
      this.handleRoute(window.location.pathname, false);
    });

    document.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (link && this.isInternalLink(link)) {
        event.preventDefault();
        const path = new URL(link.href).pathname;
        this.navigate(path);
      }
    });
  }

  isInternalLink(link) {
    const href = link.getAttribute("href");
    return (
      href &&
      !href.startsWith("http") &&
      !href.startsWith("mailto:") &&
      !href.startsWith("tel:") &&
      !href.startsWith("#")
    );
  }

  /* ROUTE HANDLING */
  handleInitialRoute() {
    this.handleRoute(window.location.pathname, false);
  }

  navigate(path) {
    if (path !== window.location.pathname) {
      history.pushState({}, "", path);
      this.handleRoute(path, true);
    }
  }

  async handleRoute(path, isNavigation) {
    if (this.isLoading || path === this.currentPath) return;

    try {
      this.isLoading = true;
      this.currentPath = path; // Track current path

      const normalizedPath = this.normalizePath(path);
      const routeConfig = this.routes.get(normalizedPath);

      if (!routeConfig) {
        await this.handle404(path);
        return;
      }

      if (routeConfig.page === this.currentPage && !isNavigation) return;

      await this.loadPage(routeConfig);
      this.currentPage = routeConfig.page;
    } catch (error) {
      console.error("Router error:", error);
      await this.handleError(error, path);
    } finally {
      this.isLoading = false;
    }
  }

  normalizePath(path) {
    if (!path || path === "/") return "/";
    return path.startsWith("/") ? path : `/${path}`;
  }

  /* PAGE LOADING */
  async loadPage(routeConfig) {
    this.showLoading();

    try {
      // Special case: index.html is already loaded
      if (routeConfig.page === "index.html") {
        this.updatePageTitle(routeConfig.title);
        return;
      }

      const response = await fetch(routeConfig.page);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      this.appContainer.innerHTML = html;
      this.updatePageTitle(routeConfig.title);
      this.executePageScripts();
    } finally {
      this.hideLoading();
    }
  }

  executePageScripts() {
    const scripts = this.appContainer.querySelectorAll("script");
    scripts.forEach((oldScript) => {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }

  /* ERROR HANDLING */
  async handle404(path) {
    if (this.currentPage === "404") return;
    this.currentPage = "404";

    this.updatePageTitle("Page Not Found");
    this.appContainer.innerHTML = `
      <div class="error-page">
        <h1>404</h1>
        <p>Path: ${this.escapeHtml(path)}</p>
        <a href="/">Home</a>
      </div>
    `;
  }

  async handleError(error, path) {
    this.updatePageTitle("Error");
    this.appContainer.innerHTML = `
      <div class="error-page">
        <h1>Error</h1>
        <p>${this.escapeHtml(error.message)}</p>
        <a href="/">Home</a>
      </div>
    `;
  }

  /* UTILITIES */
  showLoading() {
    document.body.classList.add("loading");
    // Add your loading spinner HTML here if needed
  }

  hideLoading() {
    document.body.classList.remove("loading");
  }

  updatePageTitle(title) {
    document.title = `${title} | Your App`;
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize
const router = new Router();
