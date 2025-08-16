/**
 * QueueTimer - Frontend Timer Management
 * Handles timer sessions, API communication, and UI state management
 */

class TimerApp {
  constructor() {
    // Timer states
    this.STATES = {
      IDLE: "idle",
      RUNNING: "running",
      PAUSED: "paused",
      STOPPED: "stopped",
    };

    // Application state
    this.currentState = this.STATES.IDLE;
    this.assignmentId = null;
    this.assignmentName = "";
    this.startTime = null;
    this.elapsedSeconds = 0;
    this.estimatedSeconds = 0;
    this.timerInterval = null;
    this.lastTickTime = null;

    // DOM elements
    this.elements = {};

    // API configuration
    this.API_BASE = "http://localhost:8000/api/assignments";
    this.MAX_ASSIGNMENT_LENGTH = 50;
    this.MIN_ASSIGNMENT_LENGTH = 3;
    this.MAX_ESTIMATED_MINUTES = 1440; // 24 hours
    this.MIN_ESTIMATED_MINUTES = 1;

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
    this.cacheElements();
    this.bindEvents();
    this.updateUI();
  }

  cacheElements() {
    this.elements = {
      title: document.querySelector(".assignment-title"),
      statusIndicator: document.querySelector(".status-indicator"),
      statusDot: document.querySelector(".status-dot"),
      timerDisplay: document.querySelector(".timer-display"),
      startedValue: document.querySelector(
        ".timer-info-item:nth-child(1) .timer-info-value"
      ),
      elapsedValue: document.querySelector(
        ".timer-info-item:nth-child(2) .timer-info-value"
      ),
      estEndValue: document.querySelector(
        ".timer-info-item:nth-child(3) .timer-info-value"
      ),
      controls: document.querySelector(".timer-controls"),
      stopBtn: document.querySelector(".timer-controls .btn:nth-child(1)"),
      pauseBtn: document.querySelector(".timer-controls .btn:nth-child(2)"),
      newSessionBtn: document.querySelector(".timer-controls .btn-primary"),
    };
  }

  bindEvents() {
    this.elements.newSessionBtn.addEventListener("click", () =>
      this.handleNewSession()
    );
    this.elements.pauseBtn.addEventListener("click", () =>
      this.handlePauseResume()
    );
    this.elements.stopBtn.addEventListener("click", () => this.handleStop());
  }

  /* EVENT HANDLERS */
  async handleNewSession() {
    if (this.currentState !== this.STATES.IDLE) return;

    try {
      const sessionData = await this.showSessionForm();
      if (!sessionData) return;

      await this.createAssignment(
        sessionData.name,
        sessionData.estimatedMinutes
      );
    } catch (error) {
      this.handleError("Failed to create session", error);
    }
  }

  async handlePauseResume() {
    if (this.currentState === this.STATES.RUNNING) {
      await this.pauseTimer();
    } else if (this.currentState === this.STATES.PAUSED) {
      await this.resumeTimer();
    }
  }

  async handleStop() {
    if (
      this.currentState === this.STATES.RUNNING ||
      this.currentState === this.STATES.PAUSED
    ) {
      if (
        await this.showConfirmDialog(
          "Stop Timer",
          "Are you sure you want to stop this session?"
        )
      ) {
        await this.stopTimer();
      }
    }
  }

  /* SESSION FORM */
  async showSessionForm() {
    return new Promise((resolve) => {
      const modal = this.createModal(`
        <div class="session-form">
          <h3>New Session</h3>
          <div class="form-group">
            <label for="assignment-name">Assignment Name</label>
            <input 
              type="text" 
              id="assignment-name" 
              placeholder="Enter assignment name"
              maxlength="${this.MAX_ASSIGNMENT_LENGTH}"
              required
            >
            <small>3-${this.MAX_ASSIGNMENT_LENGTH} characters</small>
          </div>
          <div class="form-group">
            <label for="estimated-time">Estimated Time</label>
            <div class="time-input">
              <input type="text" id="hours" maxlength="2" placeholder="00">
              <span>hours</span>
              <input type="text" id="minutes" maxlength="2" placeholder="30">
              <span>minutes</span>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
            <button type="button" class="btn btn-primary" data-action="create">Create Session</button>
          </div>
        </div>
      `);

      const nameInput = modal.querySelector("#assignment-name");
      const hoursInput = modal.querySelector("#hours");
      const minutesInput = modal.querySelector("#minutes");

      nameInput.focus();

      modal.addEventListener("click", (e) => {
        const action = e.target.dataset.action;
        if (action === "cancel") {
          modal.remove();
          resolve(null);
        } else if (action === "create") {
          const name = nameInput.value.trim();
          const hours = parseInt(hoursInput.value) || 0;
          const minutes = parseInt(minutesInput.value) || 0;

          const validation = this.validateSessionForm(name, hours, minutes);
          if (validation.valid) {
            modal.remove();
            resolve({
              name,
              estimatedMinutes: hours * 60 + minutes,
            });
          } else {
            this.showValidationError(modal, validation.error);
          }
        }
      });

      // Add input restrictions for time inputs
      hoursInput.addEventListener("input", (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, "");
        if (parseInt(e.target.value) > 23) e.target.value = "23";
      });

      minutesInput.addEventListener("input", (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, "");
        if (parseInt(e.target.value) > 59) e.target.value = "59";
      });
    });
  }

  validateSessionForm(name, hours, minutes) {
    if (
      name.length < this.MIN_ASSIGNMENT_LENGTH ||
      name.length > this.MAX_ASSIGNMENT_LENGTH
    ) {
      return {
        valid: false,
        error: `Assignment name must be ${this.MIN_ASSIGNMENT_LENGTH}-${this.MAX_ASSIGNMENT_LENGTH} characters`,
      };
    }

    const totalMinutes = hours * 60 + minutes;
    if (
      totalMinutes < this.MIN_ESTIMATED_MINUTES ||
      totalMinutes > this.MAX_ESTIMATED_MINUTES
    ) {
      return {
        valid: false,
        error: `Estimated time must be between ${
          this.MIN_ESTIMATED_MINUTES
        } minute and ${this.MAX_ESTIMATED_MINUTES / 60} hours`,
      };
    }

    return { valid: true };
  }

  showValidationError(modal, message) {
    let errorEl = modal.querySelector(".validation-error");
    if (!errorEl) {
      errorEl = document.createElement("div");
      errorEl.className = "validation-error";
      modal.querySelector(".form-actions").before(errorEl);
    }
    errorEl.textContent = message;
  }

  /* API CALLS */
  async createAssignment(name, estimatedMinutes) {
    try {
      this.setLoading(true);

      const response = await fetch(this.API_BASE + "/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name,
          estimated_minutes: estimatedMinutes,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.handleAssignmentCreated(data, name, estimatedMinutes);
    } catch (error) {
      this.handleError("Failed to create assignment", error);
    } finally {
      this.setLoading(false);
    }
  }

  async pauseTimer() {
    try {
      const response = await fetch(
        `${this.API_BASE}/${this.assignmentId}/pause/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            elapsed_seconds: this.elapsedSeconds,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.handleTimerPaused(data);
    } catch (error) {
      this.handleError("Failed to pause timer", error);
    }
  }

  async resumeTimer() {
    try {
      const response = await fetch(
        `${this.API_BASE}/${this.assignmentId}/start/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            current_elapsed_seconds: this.elapsedSeconds,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.handleTimerResumed(data);
    } catch (error) {
      this.handleError("Failed to resume timer", error);
    }
  }

  async stopTimer() {
    try {
      const response = await fetch(
        `${this.API_BASE}/${this.assignmentId}/stop/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            elapsed_seconds: this.elapsedSeconds,
            is_finished: true,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.handleTimerStopped(data);
    } catch (error) {
      this.handleError("Failed to stop timer", error);
    }
  }

  /* API RESPONSE HANDLERS */
  handleAssignmentCreated(data, name, estimatedMinutes) {
    this.assignmentId = data.assignment_id;
    this.assignmentName = name;
    this.startTime = data.start_time;
    this.elapsedSeconds = 0;
    this.estimatedSeconds = estimatedMinutes * 60;

    this.startTimerDisplay();
    this.setState(this.STATES.RUNNING);
  }

  handleTimerPaused(data) {
    this.elapsedSeconds = data.elapsed_seconds;
    this.stopTimerDisplay();
    this.setState(this.STATES.PAUSED);
  }

  handleTimerResumed(data) {
    this.elapsedSeconds = data.elapsed_seconds;
    this.startTimerDisplay();
    this.setState(this.STATES.RUNNING);
  }

  handleTimerStopped(data) {
    this.stopTimerDisplay();
    this.setState(this.STATES.STOPPED);

    // Show completion popup
    this.showCompletionPopup({
      assignmentName: this.assignmentName,
      startTime: data.start_time,
      endTime: data.end_time,
      totalElapsed: data.total_elapsed,
    });
  }

  /* TIMER DISPLAY MANAGEMENT */
  startTimerDisplay() {
    this.stopTimerDisplay();
    this.lastTickTime = Date.now();

    this.timerInterval = setInterval(() => {
      const now = Date.now();
      const deltaSeconds = Math.floor((now - this.lastTickTime) / 1000);

      if (deltaSeconds >= 1) {
        this.elapsedSeconds += deltaSeconds;
        this.lastTickTime = now;
        this.updateTimerDisplay();

        // Auto-stop when estimated time reached
        if (this.elapsedSeconds >= this.estimatedSeconds) {
          this.stopTimer();
        }
      }
    }, 100);
  }

  stopTimerDisplay() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateTimerDisplay() {
    this.elements.timerDisplay.textContent = this.formatTime(
      this.elapsedSeconds
    );
    this.elements.elapsedValue.textContent = this.formatTime(
      this.elapsedSeconds
    );
  }

  /* STATE MANAGEMENT */
  setState(newState) {
    this.currentState = newState;
    this.updateUI();
  }

  updateUI() {
    switch (this.currentState) {
      case this.STATES.IDLE:
        this.updateUIForIdle();
        break;
      case this.STATES.RUNNING:
        this.updateUIForRunning();
        break;
      case this.STATES.PAUSED:
        this.updateUIForPaused();
        break;
      case this.STATES.STOPPED:
        this.updateUIForStopped();
        break;
    }
  }

  updateUIForIdle() {
    this.elements.title.textContent =
      "Create A New Session To Begin Tracking Your Time";
    this.elements.statusIndicator.innerHTML =
      '<div class="status-dot"></div>No Session in Progress';
    this.elements.timerDisplay.textContent = "00:00:00";
    this.elements.startedValue.textContent = "00:00:00";
    this.elements.elapsedValue.textContent = "00:00:00";
    this.elements.estEndValue.textContent = "00:00:00";

    this.elements.stopBtn.style.display = "none";
    this.elements.pauseBtn.style.display = "none";
    this.elements.newSessionBtn.style.display = "block";
    this.elements.newSessionBtn.textContent = "New Session";
  }

  updateUIForRunning() {
    this.elements.title.textContent = `Tracking: ${this.assignmentName}`;
    this.elements.statusIndicator.innerHTML =
      '<div class="status-dot status-running"></div>Session in Progress';
    this.elements.startedValue.textContent = this.startTime || "00:00:00";
    this.elements.estEndValue.textContent = this.calculateEstEndTime();

    this.elements.stopBtn.style.display = "block";
    this.elements.pauseBtn.style.display = "block";
    this.elements.pauseBtn.textContent = "Pause";
    this.elements.newSessionBtn.style.display = "none";
  }

  updateUIForPaused() {
    this.elements.statusIndicator.innerHTML =
      '<div class="status-dot status-paused"></div>Session Paused';
    this.elements.pauseBtn.textContent = "Resume";
  }

  updateUIForStopped() {
    this.elements.statusIndicator.innerHTML =
      '<div class="status-dot status-stopped"></div>Session Completed';
  }

  /* UTILITY FUNCTIONS */
  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  calculateEstEndTime() {
    if (!this.startTime || !this.estimatedSeconds) return "00:00:00";

    // Parse start time (assuming HH:MM:SS format)
    const [hours, minutes, seconds] = this.startTime.split(":").map(Number);
    const startSeconds = hours * 3600 + minutes * 60 + seconds;
    const endSeconds = startSeconds + this.estimatedSeconds;

    // Handle day overflow
    const endHours = Math.floor(endSeconds / 3600) % 24;
    const endMinutes = Math.floor((endSeconds % 3600) / 60);
    const endSecs = endSeconds % 60;

    return `${endHours.toString().padStart(2, "0")}:${endMinutes
      .toString()
      .padStart(2, "0")}:${endSecs.toString().padStart(2, "0")}`;
  }

  /* UI COMPONENTS */
  createModal(content) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal">
        ${content}
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  async showConfirmDialog(title, message) {
    return new Promise((resolve) => {
      const modal = this.createModal(`
        <div class="confirm-dialog">
          <h3>${title}</h3>
          <p>${message}</p>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
            <button type="button" class="btn btn-primary" data-action="confirm">Confirm</button>
          </div>
        </div>
      `);

      modal.addEventListener("click", (e) => {
        const action = e.target.dataset.action;
        if (action) {
          modal.remove();
          resolve(action === "confirm");
        }
      });
    });
  }

  showCompletionPopup(data) {
    const modal = this.createModal(`
      <div class="completion-popup">
        <div class="popup-header">
          <h3>Session Complete!</h3>
          <button class="close-btn" data-action="close">×</button>
        </div>
        <div class="completion-stats">
          <h4>${this.assignmentName}</h4>
          <div class="stat-row">
            <span>Started:</span>
            <span>${data.startTime}</span>
          </div>
          <div class="stat-row">
            <span>Ended:</span>
            <span>${data.endTime}</span>
          </div>
          <div class="stat-row">
            <span>Total Time:</span>
            <span>${data.totalElapsed}</span>
          </div>
        </div>
      </div>
    `);

    modal.addEventListener("click", (e) => {
      if (
        e.target.dataset.action === "close" ||
        e.target.className === "modal-overlay"
      ) {
        modal.remove();
        this.resetSession();
      }
    });
  }

  resetSession() {
    this.assignmentId = null;
    this.assignmentName = "";
    this.startTime = null;
    this.elapsedSeconds = 0;
    this.estimatedSeconds = 0;
    this.setState(this.STATES.IDLE);
  }

  setLoading(isLoading) {
    this.elements.newSessionBtn.disabled = isLoading;
    this.elements.newSessionBtn.textContent = isLoading
      ? "Creating..."
      : "New Session";
  }

  handleError(message, error) {
    console.error(message, error);

    const modal = this.createModal(`
      <div class="error-popup">
        <h3>Error</h3>
        <p>${message}</p>
        <div class="form-actions">
          <button type="button" class="btn btn-primary" data-action="close">OK</button>
        </div>
      </div>
    `);

    modal.addEventListener("click", (e) => {
      if (e.target.dataset.action === "close") {
        modal.remove();
      }
    });
  }
}

// Initialize the application
const timerApp = new TimerApp();
