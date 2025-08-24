class QueueTimer {
  constructor() {
    this.apiBase = "http://127.0.0.1:8000/api"; // ! UPDATE FOR PROD LATER
    this.userToken = null;
    this.currentAssignment = null;
    this.timerInterval = null;
    this.startTime = null;
    this.isPaused = false;
    this.maxDurationMinutes = null; // Store max duration for auto-completion
    this.localElapsedSeconds = 0; // Track elapsed time locally

    this.initializeApp();
  }

  async initializeApp() {
    try {
      this.setupEventListeners(); // Set up event listeners first
      await this.ensureUserToken();
      this.showAssignmentForm();
    } catch (error) {
      console.error("Failed to initialize app:", error);
      this.showError("Failed to initialize application");
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
      console.error("Failed to create user:", error);
      throw new Error("Failed to create user account");
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
        this.localElapsedSeconds++;
        this.updateElapsedTime(this.localElapsedSeconds);

        // Check if we've reached max duration
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
      document.getElementById("pause-btn").classList.add("hidden");
      document.getElementById("resume-btn").classList.remove("hidden");
      document.getElementById("pause-count").textContent =
        this.currentAssignment.pause_count + 1;
      // Local elapsed time tracking continues to work correctly when paused
    } catch (error) {
      console.error("Failed to pause assignment:", error);
      this.showError("Failed to pause assignment");
    }
  }

  async resumeAssignment() {
    try {
      const response = await this.makeRequest(
        `/assignments/resume/${this.currentAssignment.id}/`,
        "POST"
      );
      this.isPaused = false;
      document.getElementById("pause-btn").classList.remove("hidden");
      document.getElementById("resume-btn").classList.add("hidden");
      document.getElementById("estimated-end").textContent =
        response.new_end_time;
    } catch (error) {
      console.error("Failed to resume assignment:", error);
      this.showError("Failed to resume assignment");
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
      console.error("Failed to update assignment title:", error);
      this.showError("Failed to update title");
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
      console.error("Failed to complete assignment:", error);
      this.showError("Failed to complete assignment");
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
  }

  async closeCompletionModal() {
    try {
      // Delete the assignment
      await this.makeRequest(
        `/assignments/${this.currentAssignment.id}/`,
        "DELETE"
      );
    } catch (error) {
      console.error("Failed to delete assignment:", error);
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
}

// Initialize the application when the page loads
document.addEventListener("DOMContentLoaded", () => {
  new QueueTimer();
});
