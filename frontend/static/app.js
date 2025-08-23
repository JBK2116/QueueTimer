/**
 * QueueTimer Production Client
 * Production-ready JavaScript for assignment timer management
 * Features: User ID management, proper error handling, loading states, memory management, UX improvements
 */

class QueueTimerApp {
  constructor() {
    this.config = {
      baseURL: "http://localhost:8000/api/assignments", // ! UPDATE FOR PROD
      pollInterval: 2000,
      maxRetries: 3,
      retryDelay: 1000,
      toastDuration: 4000,
      userIdKey: "queuetimer_user_id",
    };

    this.state = {
      assignments: [],
      activeAssignmentId: null,
      isLoading: false,
      pollHandle: null,
      retryCount: 0,
      userId: null,
    };

    this.elements = {};
    this.init();
  }

  /**
   * Initialize application
   */
  async init() {
    try {
      this.cacheElements();
      this.bindEvents();
      this.showView("list");

      await this.ensureUserId();
      await this.loadAssignments();
      this.showToast("Application ready", "success");
    } catch (error) {
      this.showToast("Failed to initialize application", "error");
      console.error("Init error:", error);
    }
  }

  /**
   * Ensure user has a valid UUID stored locally
   */
  async ensureUserId() {
    let userId = localStorage.getItem(this.config.userIdKey);

    if (!userId || !this.isValidUUID(userId)) {
      try {
        const timezone = this.detectTimezone();
        const response = await this.apiRequest(
          "http://localhost:8000/api/users/", // ! UPDATE FOR PROD
          {
            method: "POST",
            body: JSON.stringify({ timezone }),
          }
        );

        userId = response.user_id;
        localStorage.setItem(this.config.userIdKey, userId);
        this.showToast("New session created", "info");
      } catch (error) {
        throw new Error(`Failed to create user session: ${error.message}`);
      }
    }

    this.state.userId = userId;
  }

  /**
   * Detect user's timezone
   * @returns {string} IANA timezone identifier
   */
  detectTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
      console.warn("Failed to detect timezone, using UTC:", error);
      return "UTC";
    }
  }

  /**
   * Validate UUID format
   */
  isValidUUID(uuid) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Cache DOM elements for performance
   */
  cacheElements() {
    this.elements = {
      // Views
      listView: document.getElementById("view-list"),
      timerView: document.getElementById("view-timer"),
      summaryView: document.getElementById("view-summary"),

      // List view elements
      assignmentList: document.getElementById("assignmentList"),
      emptyState: document.getElementById("emptyState"),
      btnCreate: document.getElementById("btnCreate"),
      btnStart: document.getElementById("btnStart"),
      btnUpdate: document.getElementById("btnUpdate"),
      btnDelete: document.getElementById("btnDelete"),

      // Timer view elements
      bigTimer: document.getElementById("bigTimer"),
      timerTitle: document.getElementById("timerTitle"),
      metricStart: document.getElementById("metricStart"),
      metricElapsed: document.getElementById("metricElapsed"),
      metricEnd: document.getElementById("metricEnd"),
      btnPause: document.getElementById("btnPause"),
      btnResume: document.getElementById("btnResume"),
      btnComplete: document.getElementById("btnComplete"),
      backToList: document.getElementById("backToList"),

      // Summary view elements
      sumStart: document.getElementById("sumStart"),
      sumEnd: document.getElementById("sumEnd"),
      sumElapsed: document.getElementById("sumElapsed"),
      sumPauses: document.getElementById("sumPauses"),
      btnSummaryDone: document.getElementById("btnSummaryDone"),

      // Modals
      createModal: document.getElementById("modalCreate"),
      createForm: document.getElementById("formCreate"),
      createCancel: document.getElementById("btnCreateCancel"),
      editModal: document.getElementById("modalEdit"),
      editForm: document.getElementById("formEdit"),
      confirmModal: document.getElementById("modalConfirm"),

      // Toast
      toast: document.getElementById("toast"),

      // Loading overlay
      loadingOverlay: document.getElementById("loadingOverlay"),
    };
  }

  /**
   * Bind all event listeners
   */
  bindEvents() {
    // Main action buttons
    this.elements.btnCreate?.addEventListener("click", () =>
      this.openCreateModal()
    );
    this.elements.btnStart?.addEventListener("click", () =>
      this.openAssignmentPicker("start")
    );
    this.elements.btnUpdate?.addEventListener("click", () =>
      this.openAssignmentPicker("edit")
    );
    this.elements.btnDelete?.addEventListener("click", () =>
      this.openAssignmentPicker("delete")
    );

    // Navigation
    this.elements.backToList?.addEventListener("click", () =>
      this.goBackToList()
    );
    this.elements.btnSummaryDone?.addEventListener("click", () =>
      this.showView("list")
    );

    // Timer controls
    this.elements.btnPause?.addEventListener("click", () =>
      this.pauseAssignment()
    );
    this.elements.btnResume?.addEventListener("click", () =>
      this.resumeAssignment()
    );
    this.elements.btnComplete?.addEventListener("click", () =>
      this.completeAssignment()
    );

    // Forms
    this.elements.createForm?.addEventListener("submit", (e) =>
      this.handleCreateSubmit(e)
    );
    this.elements.editForm?.addEventListener("submit", (e) =>
      this.handleEditSubmit(e)
    );
    this.elements.createCancel?.addEventListener("click", () =>
      this.closeCreateModal()
    );

    // Page visibility for polling management
    document.addEventListener("visibilitychange", () =>
      this.handleVisibilityChange()
    );
    window.addEventListener("beforeunload", () => this.cleanup());
  }

  /**
   * API request wrapper with retry logic and user ID headers
   *
   * @param {string} endpoint - API endpoint path or full URL
   * @param {Object} options - Fetch options (method, body, headers)
   * @returns {Promise<Object|null>} Response data or null for 204 status
   * @throws {Error} Request failed after retries
   */
  async apiRequest(endpoint, options = {}) {
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.config.baseURL}${endpoint}`;

    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    // Add user ID header if we have one (skip for user creation)
    if (this.state.userId && !endpoint.includes("/users/")) {
      headers["X-User-ID"] = this.state.userId;
    }

    const config = {
      method: "GET",
      headers,
      credentials: "include",
      ...options,
    };

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(url, config);

        if (!response.ok) {
          // Handle user ID issues
          if (response.status === 400 && this.state.userId) {
            const errorData = await response.json().catch(() => ({}));
            if (
              errorData.detail?.includes("User-ID") ||
              errorData.detail?.includes("UUID")
            ) {
              // Invalid user ID, regenerate
              localStorage.removeItem(this.config.userIdKey);
              await this.ensureUserId();
              // Retry with new user ID
              headers["X-User-ID"] = this.state.userId;
              continue;
            }
          }

          // Handle server errors for user creation
          if (endpoint.includes("/users/") && response.status >= 500) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage =
              errorData.detail ||
              errorData.error ||
              "Server error during user creation";
            throw new Error(errorMessage);
          }

          const errorData = await response.json().catch(() => ({}));
          const errorMessage =
            errorData.detail || errorData.error || `HTTP ${response.status}`;
          throw new Error(errorMessage);
        }

        return response.status === 204 ? null : await response.json();
      } catch (error) {
        if (attempt === this.config.maxRetries) {
          throw error;
        }
        await this.delay(this.config.retryDelay * attempt);
      }
    }
  }

  /**
   * GET /api/assignments/
   * Load all assignments for current user session
   */
  async loadAssignments() {
    try {
      this.setLoading(true);
      const assignments = await this.apiRequest("/");
      this.state.assignments = Array.isArray(assignments) ? assignments : [];
      this.renderAssignmentList();
    } catch (error) {
      this.showToast("Failed to load assignments", "error");
      console.error("Load assignments error:", error);
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * POST /api/assignments/
   * Create new assignment with title and duration
   */
  async createAssignment(data) {
    try {
      this.setLoading(true);
      await this.apiRequest("/", {
        method: "POST",
        body: JSON.stringify(data),
      });

      this.showToast("Assignment created successfully", "success");
      this.closeCreateModal();
      await this.loadAssignments();
    } catch (error) {
      this.showToast(`Failed to create assignment: ${error.message}`, "error");
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * PATCH /api/assignments/{id}/
   * Update existing assignment title and duration
   */
  async updateAssignment(id, data) {
    try {
      this.setLoading(true);
      await this.apiRequest(`/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });

      this.showToast("Assignment updated successfully", "success");
      await this.loadAssignments();
    } catch (error) {
      this.showToast(`Failed to update assignment: ${error.message}`, "error");
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * DELETE /api/assignments/{id}/
   * Delete assignment permanently
   */
  async deleteAssignment(id) {
    try {
      this.setLoading(true);
      await this.apiRequest(`/${id}/`, { method: "DELETE" });

      this.showToast("Assignment deleted successfully", "success");
      await this.loadAssignments();
    } catch (error) {
      this.showToast(`Failed to delete assignment: ${error.message}`, "error");
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * POST /api/assignments/start/{id}/
   * Start assignment timer
   */
  async startAssignment(id) {
    try {
      this.setLoading(true);
      await this.apiRequest(`/start/${id}/`, { method: "POST" });

      this.state.activeAssignmentId = id;
      const fullData = await this.apiRequest(`/${id}/`);

      this.updateTimerDisplay(fullData);
      this.showView("timer");
      this.startPolling();
      this.showToast("Timer started", "success");
    } catch (error) {
      this.showToast(`Failed to start timer: ${error.message}`, "error");
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * POST /api/assignments/pause/{id}/
   * Pause running assignment timer
   */
  async pauseAssignment() {
    if (!this.state.activeAssignmentId) return;

    try {
      this.setButtonLoading("btnPause", true);
      await this.apiRequest(`/pause/${this.state.activeAssignmentId}/`, {
        method: "POST",
      });

      const fullData = await this.apiRequest(
        `/${this.state.activeAssignmentId}/`
      );
      this.updateTimerDisplay(fullData);
      this.showToast("Timer paused", "info");
    } catch (error) {
      this.showToast(`Failed to pause timer: ${error.message}`, "error");
    } finally {
      this.setButtonLoading("btnPause", false);
    }
  }

  /**
   * POST /api/assignments/resume/{id}/
   * Resume paused assignment timer
   */
  async resumeAssignment() {
    if (!this.state.activeAssignmentId) return;

    try {
      this.setButtonLoading("btnResume", true);
      await this.apiRequest(`/resume/${this.state.activeAssignmentId}/`, {
        method: "POST",
      });

      const fullData = await this.apiRequest(
        `/${this.state.activeAssignmentId}/`
      );
      this.updateTimerDisplay(fullData);
      this.showToast("Timer resumed", "success");
    } catch (error) {
      this.showToast(`Failed to resume timer: ${error.message}`, "error");
    } finally {
      this.setButtonLoading("btnResume", false);
    }
  }

  /**
   * POST /api/assignments/complete/{id}/
   * Complete assignment and generate final statistics
   */
  async completeAssignment() {
    if (!this.state.activeAssignmentId) return;

    try {
      this.setButtonLoading("btnComplete", true);
      await this.apiRequest(`/complete/${this.state.activeAssignmentId}/`, {
        method: "POST",
      });

      const fullData = await this.apiRequest(
        `/${this.state.activeAssignmentId}/`
      );
      this.stopPolling();
      this.renderSummary(fullData);
      this.showView("summary");
      this.showToast("Assignment completed!", "success");
      this.state.activeAssignmentId = null;
      await this.loadAssignments();
    } catch (error) {
      this.showToast(
        `Failed to complete assignment: ${error.message}`,
        "error"
      );
    } finally {
      this.setButtonLoading("btnComplete", false);
    }
  }

  /**
   * Start polling for timer updates
   */
  startPolling() {
    this.stopPolling();
    this.state.retryCount = 0;

    this.state.pollHandle = setInterval(async () => {
      if (document.hidden) return; // Don't poll when tab is hidden

      try {
        const data = await this.apiRequest(
          `/${this.state.activeAssignmentId}/`
        );
        this.updateTimerDisplay(data);
        this.state.retryCount = 0;

        // Auto-complete if time limit reached
        if (this.shouldAutoComplete(data)) {
          this.showToast(
            "Time limit reached - completing assignment",
            "warning"
          );
          await this.completeAssignment();
        }
      } catch (error) {
        this.state.retryCount++;
        if (this.state.retryCount >= this.config.maxRetries) {
          this.stopPolling();
          this.showToast("Connection lost. Timer may be inaccurate.", "error");
        }
      }
    }, this.config.pollInterval);
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.state.pollHandle) {
      clearInterval(this.state.pollHandle);
      this.state.pollHandle = null;
    }
  }

  /**
   * Check if assignment should auto-complete
   */
  shouldAutoComplete(data) {
    if (!data || !data.elapsed_time || !data.max_duration) return false;

    const elapsedSeconds = this.parseTimeToSeconds(data.elapsed_time);
    const maxSeconds = data.max_duration * 60;

    return elapsedSeconds >= maxSeconds;
  }

  /**
   * Render assignment list
   */
  renderAssignmentList() {
    const list = this.elements.assignmentList;
    const emptyState = this.elements.emptyState;

    if (!list || !emptyState) return;

    list.innerHTML = "";

    if (this.state.assignments.length === 0) {
      emptyState.style.display = "block";
      return;
    }

    emptyState.style.display = "none";

    // Filter and sort assignments
    const pendingAssignments = this.state.assignments
      .filter((a) => !a.is_complete)
      .sort((a, b) => (a.is_started ? -1 : 1)); // Started assignments first

    pendingAssignments.forEach((assignment) => {
      const li = document.createElement("li");
      li.className = `assignment-item ${
        assignment.is_started ? "started" : ""
      }`;

      li.innerHTML = `
        <div class="assignment-info">
          <div class="assignment-title">${this.escapeHTML(
            assignment.title
          )}</div>
          <div class="assignment-meta">
            <span class="duration-badge">${this.formatDuration(
              assignment.max_duration
            )}</span>
            ${
              assignment.is_started
                ? '<span class="status-badge">In Progress</span>'
                : ""
            }
          </div>
        </div>
      `;

      list.appendChild(li);
    });

    // Update button states
    this.updateButtonStates();
  }

  /**
   * Update timer display
   */
  updateTimerDisplay(data) {
    if (!data) return;

    // Update timer status
    const timerView = this.elements.timerView;
    if (timerView) {
      if (data.is_started && !data.is_complete) {
        timerView.dataset.status = data.is_paused ? "paused" : "running";
      } else {
        timerView.dataset.status = "stopped";
      }
    }

    // Update display elements
    if (this.elements.timerTitle)
      this.elements.timerTitle.textContent = data.title;
    if (this.elements.metricStart)
      this.elements.metricStart.textContent = this.formatTime(data.start_time);
    if (this.elements.metricElapsed)
      this.elements.metricElapsed.textContent = this.formatTime(
        data.elapsed_time
      );
    if (this.elements.metricEnd)
      this.elements.metricEnd.textContent = this.formatTime(data.end_time);
    if (this.elements.bigTimer)
      this.elements.bigTimer.textContent = this.formatTime(data.elapsed_time);

    // Update button states based on assignment state
    this.updateTimerButtons(data);
  }

  /**
   * Update timer control buttons
   */
  updateTimerButtons(data) {
    const pauseBtn = this.elements.btnPause;
    const resumeBtn = this.elements.btnResume;
    const completeBtn = this.elements.btnComplete;

    if (!pauseBtn || !resumeBtn || !completeBtn) return;

    if (data.is_paused) {
      pauseBtn.style.display = "none";
      resumeBtn.style.display = "inline-flex";
    } else {
      pauseBtn.style.display = "inline-flex";
      resumeBtn.style.display = "none";
    }

    completeBtn.disabled = !data.is_started || data.is_complete;
  }

  /**
   * Render summary view
   */
  renderSummary(data) {
    if (this.elements.sumStart)
      this.elements.sumStart.textContent = this.formatTime(data.start_time);
    if (this.elements.sumEnd)
      this.elements.sumEnd.textContent = this.formatTime(data.end_time);
    if (this.elements.sumElapsed)
      this.elements.sumElapsed.textContent = this.formatTime(data.elapsed_time);
    if (this.elements.sumPauses)
      this.elements.sumPauses.textContent = String(data.pause_count || 0);
  }

  /**
   * Show different views
   */
  showView(viewName) {
    const views = [
      this.elements.listView,
      this.elements.timerView,
      this.elements.summaryView,
    ];
    views.forEach((view) => view?.classList.remove("active"));

    const targetView = this.elements[`${viewName}View`];
    if (targetView) targetView.classList.add("active");
  }

  /**
   * Open create assignment modal
   */
  openCreateModal() {
    if (this.state.assignments.length >= 10) {
      this.showToast("Maximum of 10 assignments allowed", "warning");
      return;
    }

    this.elements.createModal?.showModal();
  }

  /**
   * Close create modal
   */
  closeCreateModal() {
    this.elements.createForm?.reset();
    this.elements.createModal?.close();
  }

  /**
   * Open assignment picker
   */
  openAssignmentPicker(action) {
    const availableAssignments = this.state.assignments.filter(
      (a) => !a.is_started && !a.is_complete
    );

    if (availableAssignments.length === 0) {
      this.showToast(`No assignments available to ${action}`, "info");
      return;
    }

    // Create dynamic picker modal
    this.showAssignmentPicker(action, availableAssignments);
  }

  /**
   * Handle form submissions
   */
  handleCreateSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const title = formData.get("createTitle")?.trim();
    const duration = formData.get("createDuration")?.trim();

    if (!this.validateAssignmentData(title, duration)) return;

    this.createAssignment({ title, duration });
  }

  handleEditSubmit(e) {
    e.preventDefault();
    // Implementation for edit form
  }

  /**
   * Validate assignment data
   */
  validateAssignmentData(title, duration) {
    if (!title) {
      this.showToast("Title is required", "error");
      return false;
    }

    if (title.length > 50) {
      this.showToast("Title must be 50 characters or fewer", "error");
      return false;
    }

    if (!/^\d{1,2}:\d{2}$/.test(duration)) {
      this.showToast("Duration must be in HH:MM format (e.g., 01:30)", "error");
      return false;
    }

    const [hours, minutes] = duration.split(":").map(Number);
    if (hours > 24 || minutes > 59 || (hours === 0 && minutes === 0)) {
      this.showToast("Invalid duration. Maximum 24:00, minimum 00:01", "error");
      return false;
    }

    return true;
  }

  /**
   * Update button states based on current assignments
   */
  updateButtonStates() {
    const hasUnstartedAssignments = this.state.assignments.some(
      (a) => !a.is_started && !a.is_complete
    );

    if (this.elements.btnStart)
      this.elements.btnStart.disabled = !hasUnstartedAssignments;
    if (this.elements.btnUpdate)
      this.elements.btnUpdate.disabled = !hasUnstartedAssignments;
    if (this.elements.btnDelete)
      this.elements.btnDelete.disabled = !hasUnstartedAssignments;
    if (this.elements.btnCreate)
      this.elements.btnCreate.disabled = this.state.assignments.length >= 10;
  }

  /**
   * Go back to list view with cleanup
   */
  goBackToList() {
    this.stopPolling();
    this.state.activeAssignmentId = null;
    this.showView("list");
  }

  /**
   * Handle visibility change (tab switching)
   */
  handleVisibilityChange() {
    if (document.hidden && this.state.pollHandle) {
      // Tab is hidden, polling continues but at reduced frequency
      return;
    }

    if (
      !document.hidden &&
      this.state.activeAssignmentId &&
      !this.state.pollHandle
    ) {
      // Tab is visible again, restart polling if needed
      this.startPolling();
    }
  }

  /**
   * Set loading state
   */
  setLoading(loading) {
    this.state.isLoading = loading;
    const overlay = this.elements.loadingOverlay;
    if (overlay) {
      overlay.style.display = loading ? "flex" : "none";
    }
  }

  /**
   * Set button loading state
   */
  setButtonLoading(buttonId, loading) {
    const button = this.elements[buttonId] || document.getElementById(buttonId);
    if (!button) return;

    button.disabled = loading;
    button.dataset.loading = loading;

    if (loading) {
      button.dataset.originalText = button.textContent;
      button.textContent = "Loading...";
    } else {
      button.textContent =
        button.dataset.originalText ||
        button.textContent.replace("Loading...", "");
    }
  }

  /**
   * Show toast notification
   */
  showToast(message, type = "info") {
    const toast = this.elements.toast;
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
      toast.classList.remove("show");
    }, this.config.toastDuration);
  }

  /**
   * Utility functions
   */
  escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  formatTime(timeStr) {
    if (!timeStr || typeof timeStr !== "string") return "--:--:--";
    return timeStr.match(/^\d{2}:\d{2}:\d{2}$/) ? timeStr : "--:--:--";
  }

  formatDuration(minutes) {
    if (typeof minutes !== "number") return "--:--";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}`;
  }

  parseTimeToSeconds(timeStr) {
    if (!timeStr || typeof timeStr !== "string") return 0;
    const parts = timeStr.split(":").map(Number);
    if (parts.length !== 3) return 0;
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Cleanup function
   */
  cleanup() {
    this.stopPolling();
  }

  /**
   * Show assignment picker modal (simplified implementation)
   */
  showAssignmentPicker(action, assignments) {
    // This would typically create a dynamic modal
    // For now, using a simple approach
    const titles = assignments
      .map(
        (a, i) =>
          `${i + 1}. ${a.title} (${this.formatDuration(a.max_duration)})`
      )
      .join("\n");
    const choice = prompt(
      `Select assignment to ${action}:\n\n${titles}\n\nEnter number (1-${assignments.length}):`
    );

    if (!choice) return;

    const index = parseInt(choice) - 1;
    if (index >= 0 && index < assignments.length) {
      const assignment = assignments[index];

      switch (action) {
        case "start":
          this.startAssignment(assignment.id);
          break;
        case "edit":
          this.editAssignment(assignment);
          break;
        case "delete":
          if (confirm(`Delete "${assignment.title}"?`)) {
            this.deleteAssignment(assignment.id);
          }
          break;
      }
    }
  }

  /**
   * Edit assignment (simplified)
   */
  editAssignment(assignment) {
    const newTitle = prompt("New title:", assignment.title);
    if (!newTitle) return;

    const newDuration = prompt(
      "New duration (HH:MM):",
      this.formatDuration(assignment.max_duration)
    );
    if (!newDuration) return;

    if (this.validateAssignmentData(newTitle, newDuration)) {
      this.updateAssignment(assignment.id, {
        title: newTitle,
        duration: newDuration,
      });
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.queueTimer = new QueueTimerApp();
});
