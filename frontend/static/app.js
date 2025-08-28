class QueueTimer {
  constructor() {
    this.apiBase = "/api";
    this.userToken = null;
    this.currentAssignment = null;
    this.timerInterval = null;
    this.startTime = null;
    this.isPaused = false;
    this.pauseStartTime = null; // Tracking pauses
    this.maxDurationMinutes = null; // Store max duration for auto-completion
    this.localElapsedSeconds = 0; // Track elapsed time locally
    this.audioContext = null; // Web Audio context (initialized on first user gesture)
    this.audioGainNode = null; // Master gain node

    this.initializeApp();
  }

  async initializeApp() {
    try {
      this.setupEventListeners();
      await this.ensureUserToken();
      this.showAssignmentForm();
    } catch (error) {
      const errorMessage = "Failed to initialize app";
      console.error(errorMessage);
      this.showError(errorMessage);
    }
  }

  async ensureUserToken() {
    // Check if we have a stored token
    this.userToken = localStorage.getItem("queueTimerToken");

    if (!this.userToken) {
      // Get user's timezone and create new user
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await this.createUser(timezone);
    } else {
      // Verify token is still valid by making a test request
      try {
        await this.makeRequest("/test/", "GET");
      } catch (error) {
        // Token expired, create new user
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        await this.createUser(timezone);
      }
    }
  }

  async createUser(timezone) {
    try {
      const response = await this.makeRequest("/users/", "POST", {
        timezone: timezone,
      });

      this.userToken = response.user_id;
      localStorage.setItem("queueTimerToken", this.userToken);
    } catch (error) {
      const errorMessage = error.message || "Failed to create user";
      console.error("Failed to create user:", error);
      throw new Error(errorMessage);
    }
  }

  async makeRequest(endpoint, method = "GET", data = null) {
    const url = `${this.apiBase}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      "X-User-ID": this.userToken,
    };

    const options = {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    };

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  setupEventListeners() {
    // Assignment creation form
    document
      .getElementById("create-assignment-form")
      .addEventListener("submit", (e) => {
        e.preventDefault();
        this.createAndStartAssignment();
      });

    // Timer controls
    document
      .getElementById("pause-btn")
      .addEventListener("click", () => this.pauseAssignment());
    document
      .getElementById("resume-btn")
      .addEventListener("click", () => this.resumeAssignment());
    document
      .getElementById("complete-btn")
      .addEventListener("click", () => this.completeAssignment());

    // Title editing
    document
      .getElementById("save-title-btn")
      .addEventListener("click", () => this.updateAssignmentTitle());
    document
      .getElementById("assignment-title-input")
      .addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.updateAssignmentTitle();
        }
      });

    // Modal close
    document
      .getElementById("close-modal")
      .addEventListener("click", () => this.closeCompletionModal());

    // Error modal close
    const errorCloseBtn = document.getElementById("close-error-modal");
    const errorModal = document.getElementById("error-modal");

    if (errorCloseBtn) {
      errorCloseBtn.addEventListener("click", () => this.closeErrorModal());
      console.log("Error close button event listener added");
    } else {
      console.error("Error close button not found");
    }

    // Also allow clicking on modal backdrop to close
    if (errorModal) {
      errorModal.addEventListener("click", (e) => {
        if (e.target === errorModal) {
          this.closeErrorModal();
        }
      });
      console.log("Error modal backdrop click listener added");
    } else {
      console.error("Error modal element not found");
    }

    // Allow Escape key to close error modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !errorModal.classList.contains("hidden")) {
        this.closeErrorModal();
      }
    });

    // Initialize audio on first user interaction to satisfy autoplay policies
    const initAudioIfNeeded = () => this.initializeAudio();
    document.body.addEventListener("click", initAudioIfNeeded, { once: true });
    document.body.addEventListener("keydown", initAudioIfNeeded, {
      once: true,
    });
  }

  async createAndStartAssignment() {
    const title = document.getElementById("title").value.trim();
    const duration = document.getElementById("duration").value;

    if (!title || !duration) {
      this.showError("Please fill in all fields");
      return;
    }

    this.showLoading();

    try {
      // Create assignment
      const assignment = await this.makeRequest("/assignments/", "POST", {
        title: title,
        duration: duration,
      });

      // Start assignment
      const startData = await this.makeRequest(
        `/assignments/start/${assignment.id}/`,
        "POST"
      );

      // Get updated assignment data to get max_duration_minutes
      const updatedAssignment = await this.makeRequest(
        `/assignments/${assignment.id}/`,
        "GET"
      );

      this.currentAssignment = updatedAssignment;
      this.startTime = new Date();
      this.isPaused = false;
      this.maxDurationMinutes = updatedAssignment.max_duration_minutes;
      this.localElapsedSeconds = 0;

      // Update UI
      this.updateTimerDisplay(updatedAssignment, startData);
      this.startTimer();
      this.showTimerDisplay();
    } catch (error) {
      const errorMessage = error.message || "Failed to create assignment";
      this.showError(errorMessage);
      this.showAssignmentForm();
    }
  }

  updateTimerDisplay(assignment, startData) {
    document.getElementById("assignment-title-input").value = assignment.title;
    document.getElementById("start-time").textContent = startData.start_time;
    document.getElementById("estimated-end").textContent =
      startData.estimated_end_time;
    document.getElementById("pause-count").textContent = assignment.pause_count;
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      if (!this.isPaused && this.startTime) {
        this.localElapsedSeconds = Math.floor(
          (Date.now() - this.startTime) / 1000
        );
        this.updateElapsedTime(this.localElapsedSeconds);

        if (
          this.maxDurationMinutes &&
          this.localElapsedSeconds >= this.maxDurationMinutes * 60
        ) {
          this.autoCompleteAssignment();
        }
      }
    }, 1000);
  }

  updateElapsedTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const timeString = `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    document.getElementById("elapsed-time").textContent = timeString;
  }

  async pauseAssignment() {
    try {
      const response = await this.makeRequest(
        `/assignments/pause/${this.currentAssignment.id}/`,
        "POST"
      );
      this.isPaused = true;
      this.pauseStartTime = Date.now();
      this.currentAssignment.pause_count += 1;
      document.getElementById("pause-btn").classList.add("hidden");
      document.getElementById("resume-btn").classList.remove("hidden");
      document.getElementById("pause-count").textContent =
      this.currentAssignment.pause_count;
      // Local elapsed time tracking continues to work correctly when paused
    } catch (error) {
      const errorMessage = error.message || "Failed to pause assignment";
      console.error("Failed to pause assignment:", error);
      this.showError(errorMessage);
    }
  }

  async resumeAssignment() {
    try {
      const response = await this.makeRequest(
        `/assignments/resume/${this.currentAssignment.id}/`,
        "POST"
      );
      if (this.pauseStartTime) {
        const pauseDuration = Date.now() - this.pauseStartTime;
        this.startTime = new Date(this.startTime.getTime() + pauseDuration);
        this.pauseStartTime = null; // Reset for the next pause
      }
      this.isPaused = false;
      document.getElementById("pause-btn").classList.remove("hidden");
      document.getElementById("resume-btn").classList.add("hidden");
      document.getElementById("estimated-end").textContent =
        response.new_end_time;
    } catch (error) {
      const errorMessage = error.message || "Failed to resume assignment";
      console.error("Failed to resume assignment:", error);
      this.showError(errorMessage);
    }
  }

  async updateAssignmentTitle() {
    const newTitle = document
      .getElementById("assignment-title-input")
      .value.trim();

    if (!newTitle) {
      this.showError("Title cannot be empty");
      return;
    }

    try {
      const updatedAssignment = await this.makeRequest(
        `/assignments/${this.currentAssignment.id}/`,
        "PATCH",
        {
          title: newTitle,
        }
      );

      // Update current assignment with new title
      this.currentAssignment.title = newTitle;

      // Show success feedback (optional - could be a subtle visual indicator)
      const saveBtn = document.getElementById("save-title-btn");
      const originalText = saveBtn.textContent;
      saveBtn.textContent = "Saved!";
      saveBtn.style.background = "linear-gradient(45deg, #4caf50, #45a049)";

      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.style.background = "";
      }, 1000);
    } catch (error) {
      const errorMessage = error.message || "Failed to update assignment title";
      console.error("Failed to update assignment title:", error);
      this.showError(errorMessage);
    }
  }

  async autoCompleteAssignment() {
    console.log("Auto-completing assignment - max duration reached");
    this.stopTimer();
    await this.completeAssignment();
  }

  async completeAssignment() {
    try {
      await this.makeRequest(
        `/assignments/complete/${this.currentAssignment.id}/`,
        "POST"
      );

      // Get final assignment data
      const finalAssignment = await this.makeRequest(
        `/assignments/${this.currentAssignment.id}/`,
        "GET"
      );

      this.stopTimer();
      this.showCompletionModal(finalAssignment);
    } catch (error) {
      const errorMessage = error.message || "Failed to complete assignment";
      console.error("Failed to complete assignment:", error);
      this.showError(errorMessage);
    }
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  showCompletionModal(assignment) {
    document.getElementById("modal-start-time").textContent =
      assignment.start_time_formatted || "--:--:--";
    document.getElementById("modal-end-time").textContent =
      assignment.end_time_formatted || "--:--:--";
    document.getElementById("modal-elapsed-time").textContent =
      assignment.elapsed_time_formatted || "--:--:--";
    document.getElementById("modal-pause-count").textContent =
      assignment.pause_count;

    document.getElementById("completion-modal").classList.remove("hidden");
    this.playCompletionSound();
  }

  async closeCompletionModal() {
    try {
      // Delete the assignment
      await this.makeRequest(
        `/assignments/${this.currentAssignment.id}/`,
        "DELETE"
      );
    } catch (error) {
      const errorMessage = error.message || "Failed to delete assignment";
      console.error(errorMessage); // No need to show error, the assignment will auto delete when the users token is expired
    }

    // Reset state
    this.currentAssignment = null;
    this.startTime = null;
    this.isPaused = false;
    this.maxDurationMinutes = null;
    this.localElapsedSeconds = 0;

    // Hide modal and show form
    document.getElementById("completion-modal").classList.add("hidden");
    this.showAssignmentForm();
  }

  showAssignmentForm() {
    document.getElementById("assignment-form").classList.remove("hidden");
    document.getElementById("timer-display").classList.add("hidden");
    document.getElementById("loading").classList.add("hidden");

    // Reset form
    document.getElementById("create-assignment-form").reset();
  }

  showTimerDisplay() {
    document.getElementById("assignment-form").classList.add("hidden");
    document.getElementById("timer-display").classList.remove("hidden");
    document.getElementById("loading").classList.add("hidden");
  }

  showLoading() {
    document.getElementById("assignment-form").classList.add("hidden");
    document.getElementById("timer-display").classList.add("hidden");
    document.getElementById("loading").classList.remove("hidden");
  }

  showError(message) {
    document.getElementById("error-message").textContent = message;
    document.getElementById("error-modal").classList.remove("hidden");
  }

  closeErrorModal() {
    console.log("Closing error modal");
    const errorModal = document.getElementById("error-modal");
    if (errorModal) {
      errorModal.classList.add("hidden");
      console.log("Error modal hidden");
    } else {
      console.error("Error modal element not found");
    }
  }

  initializeAudio() {
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return; // Browser not supported
        this.audioContext = new AudioCtx();
        this.audioGainNode = this.audioContext.createGain();
        this.audioGainNode.gain.value = 0.05; // Low volume default
        this.audioGainNode.connect(this.audioContext.destination);
      }
      if (this.audioContext.state === "suspended") {
        this.audioContext.resume();
      }
    } catch (e) {
      // Fail silently if audio cannot be initialized
    }
  }

  playTone(frequency, durationMs, type = "sine", startDelayMs = 0) {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime + startDelayMs / 1000;
    const oscillator = this.audioContext.createOscillator();
    const envelope = this.audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);

    // Quick attack/decay envelope to avoid clicks
    const attack = 0.005;
    const release = 0.08;
    envelope.gain.setValueAtTime(0.0, now);
    envelope.gain.linearRampToValueAtTime(1.0, now + attack);
    envelope.gain.setValueAtTime(1.0, now + durationMs / 1000 - release);
    envelope.gain.linearRampToValueAtTime(0.0, now + durationMs / 1000);

    oscillator.connect(envelope);
    envelope.connect(this.audioGainNode || this.audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + durationMs / 1000 + 0.01);
  }

  playCompletionSound() {
    // Ensure audio is initialized (safe no-op if already done)
    this.initializeAudio();
    if (!this.audioContext) return;

    const totalDurationMs = 4000; // Repeat alert for ~3s
    const toneDurationMs = 180; // Length of each individual beep
    const spacingBetweenBeepsMs = 230; // Delay between beep 1 and beep 2
    const cyclePeriodMs = 600; // Start of one pair to start of the next

    // Beep frequencies: A5 (880 Hz) then C6 (~1046.5 Hz)
    for (
      let offsetMs = 0;
      offsetMs < totalDurationMs;
      offsetMs += cyclePeriodMs
    ) {
      this.playTone(880, toneDurationMs, "sine", offsetMs);
      this.playTone(
        1046.5,
        toneDurationMs,
        "sine",
        offsetMs + spacingBetweenBeepsMs
      );
    }
  }
}

// Initialize the application when the page loads
document.addEventListener("DOMContentLoaded", () => {
  new QueueTimer();
});
