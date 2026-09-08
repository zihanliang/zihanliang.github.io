(() => {
  "use strict";

  const REMOTE_DATA_URL = "https://mlciv.com/ai-deadlines/api/upcoming.json";
  const FALLBACK_DATA_URL = "data/deadlines-snapshot.json";
  const CACHE_KEY = "zihanliang-ai-deadlines-v1";
  const INITIAL_RESULT_COUNT = 12;
  const RESULT_PAGE_SIZE = 12;
  const REQUEST_TIMEOUT_MS = 8000;

  const SUBJECT_LABELS = {
    AP: "Automated Planning",
    CG: "Computer Graphics",
    CV: "Computer Vision",
    DM: "Data Mining",
    EDU: "AI in Education",
    HCI: "Human-Computer Interaction",
    KR: "Knowledge Representation",
    ML: "Machine Learning",
    NLP: "Natural Language Processing",
    RO: "Robotics",
    SP: "Speech & Signal Processing"
  };

  const dateTimeFormatters = new Map();
  let conferences = [];
  let visibleCount = INITIAL_RESULT_COUNT;
  let countdownTimer = 0;
  let localTimezone = "UTC";

  const elements = {
    dataState: document.getElementById("deadlines-data-state"),
    dataUpdated: document.getElementById("deadlines-data-updated"),
    search: document.getElementById("deadlines-search"),
    subject: document.getElementById("deadlines-subject"),
    includePredicted: document.getElementById("deadlines-include-predicted"),
    resultsSummary: document.getElementById("deadlines-results-summary"),
    localTimezone: document.getElementById("deadlines-local-timezone"),
    loading: document.getElementById("deadlines-loading"),
    list: document.getElementById("deadlines-list"),
    empty: document.getElementById("deadlines-empty"),
    error: document.getElementById("deadlines-error"),
    loadMore: document.getElementById("deadlines-load-more")
  };

  if (!elements.list) return;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function safeExternalUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch (_error) {
      return "";
    }
  }

  function plainTextFromHtml(value) {
    const documentFragment = new DOMParser().parseFromString(String(value || ""), "text/html");
    return (documentFragment.body.textContent || "").replace(/\s+/g, " ").trim();
  }

  function isPredicted(conference) {
    return /predict(?:ed|ion)/i.test(String(conference.note || ""));
  }

  function getTimeZoneOffset(timestamp, timezone) {
    let formatter = dateTimeFormatters.get(timezone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
      });
      dateTimeFormatters.set(timezone, formatter);
    }

    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(timestamp))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)])
    );
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return asUtc - Math.floor(timestamp / 1000) * 1000;
  }

  function parseDeadline(conference) {
    const match = String(conference.deadline || "").match(
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/
    );
    if (!match) return null;

    const [, year, month, day, hour, minute, second = "0"] = match;
    const wallClockUtc = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );
    const rawTimezone = String(conference.timezone || "UTC").trim();
    const timezone = rawTimezone === "AoE" ? "UTC-12" : rawTimezone;
    const fixedOffset = timezone.match(/^(?:UTC|GMT)([+-])(\d{1,2})$/i);

    if (fixedOffset) {
      const direction = fixedOffset[1] === "+" ? 1 : -1;
      const offsetHours = Number(fixedOffset[2]);
      return wallClockUtc - direction * offsetHours * 60 * 60 * 1000;
    }

    if (/^(?:UTC|GMT)$/i.test(timezone)) return wallClockUtc;

    try {
      const firstOffset = getTimeZoneOffset(wallClockUtc, timezone);
      let timestamp = wallClockUtc - firstOffset;
      const correctedOffset = getTimeZoneOffset(timestamp, timezone);
      if (correctedOffset !== firstOffset) timestamp = wallClockUtc - correctedOffset;
      return timestamp;
    } catch (_error) {
      return null;
    }
  }

  function normalizeConferences(data) {
    if (!Array.isArray(data)) throw new Error("Deadline data must be an array.");

    return data
      .filter((conference) => conference && conference.id && conference.title && conference.deadline)
      .map((conference) => ({
        ...conference,
        timestamp: parseDeadline(conference),
        predicted: isPredicted(conference),
        sub: Array.isArray(conference.sub) ? conference.sub.filter(Boolean) : []
      }))
      .filter((conference) => Number.isFinite(conference.timestamp))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async function fetchDeadlineData(url, options = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        cache: options.cache || "default",
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Deadline request failed: ${response.status}`);
      return {
        data: normalizeConferences(await response.json()),
        lastModified: response.headers.get("last-modified") || ""
      };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function readBrowserCache() {
    try {
      const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "null");
      if (!cached || !Array.isArray(cached.data)) return null;
      return {
        data: normalizeConferences(cached.data),
        fetchedAt: cached.fetchedAt || "",
        lastModified: cached.lastModified || ""
      };
    } catch (_error) {
      return null;
    }
  }

  function writeBrowserCache(rawData, lastModified) {
    try {
      window.localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data: rawData, fetchedAt: new Date().toISOString(), lastModified })
      );
    } catch (_error) {
      // Storage can be disabled or full; live data should still render normally.
    }
  }

  function serializeForCache(normalizedData) {
    return normalizedData.map(({ timestamp: _timestamp, predicted: _predicted, ...conference }) => conference);
  }

  function formatUpdatedTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `Source updated ${new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date)}`;
  }

  function setDataStatus(kind, label, updatedAt = "") {
    elements.dataState.className = `deadlines-data-state is-${kind}`;
    elements.dataState.innerHTML = `<span class="deadlines-data-dot" aria-hidden="true"></span>${escapeHtml(label)}`;
    const formattedUpdatedAt = formatUpdatedTime(updatedAt);
    if (formattedUpdatedAt) {
      elements.dataUpdated.textContent = formattedUpdatedAt;
    } else if (kind === "error" || kind === "loading") {
      elements.dataUpdated.textContent = "";
    }
  }

  function populateSubjectOptions() {
    const availableSubjects = [...new Set(conferences.flatMap((conference) => conference.sub))].sort(
      (a, b) => (SUBJECT_LABELS[a] || a).localeCompare(SUBJECT_LABELS[b] || b)
    );
    const selectedValue = elements.subject.value;
    elements.subject.innerHTML = '<option value="">All areas</option>' + availableSubjects
      .map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(SUBJECT_LABELS[subject] || subject)}</option>`)
      .join("");
    if (availableSubjects.includes(selectedValue)) elements.subject.value = selectedValue;
  }

  function getFilteredConferences() {
    const now = Date.now();
    const query = elements.search.value.trim().toLocaleLowerCase();
    const subject = elements.subject.value;
    const includePredicted = elements.includePredicted.checked;

    return conferences.filter((conference) => {
      if (conference.timestamp <= now) return false;
      if (subject && !conference.sub.includes(subject)) return false;
      if (!includePredicted && conference.predicted) return false;
      if (!query) return true;

      const searchableText = [
        conference.title,
        conference.full_name,
        conference.place,
        conference.date,
        ...conference.sub.map((code) => SUBJECT_LABELS[code] || code)
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return searchableText.includes(query);
    });
  }

  function countUpcoming(data) {
    const now = Date.now();
    return data.filter((conference) => conference.timestamp > now).length;
  }

  function formatDeadline(timestamp) {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short"
    }).format(new Date(timestamp));
  }

  function formatCountdown(timestamp) {
    const difference = Math.max(0, timestamp - Date.now());
    const totalSeconds = Math.ceil(difference / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const paddedMinutes = String(minutes).padStart(2, "0");
    const paddedSeconds = String(seconds).padStart(2, "0");

    if (days > 0) return `${days}d ${hours}h ${paddedMinutes}m ${paddedSeconds}s`;
    if (hours > 0) return `${hours}h ${paddedMinutes}m ${paddedSeconds}s`;
    return `${minutes}m ${paddedSeconds}s`;
  }

  function urgencyClass(timestamp) {
    const daysRemaining = (timestamp - Date.now()) / 86400000;
    if (daysRemaining <= 7) return "is-critical";
    if (daysRemaining <= 30) return "is-soon";
    return "is-later";
  }

  function renderSubjectTags(subjects) {
    return subjects
      .map(
        (subject) =>
          `<span class="deadline-subject" title="${escapeHtml(SUBJECT_LABELS[subject] || subject)}">${escapeHtml(subject)}</span>`
      )
      .join("");
  }

  function renderConference(conference) {
    const conferenceUrl = safeExternalUrl(conference.link);
    const title = `${conference.title} ${conference.year || ""}`.trim();
    const fullName = conference.full_name && conference.full_name !== conference.title
      ? `<p class="deadline-full-name">${escapeHtml(conference.full_name)}</p>`
      : "";
    const location = conference.place && conference.place !== "TBA"
      ? `<span>${escapeHtml(conference.place)}</span>`
      : "";
    const eventDate = conference.date ? `<span>${escapeHtml(conference.date)}</span>` : "";
    const noteText = plainTextFromHtml(conference.note);
    const note = noteText ? `<p class="deadline-note">${escapeHtml(noteText)}</p>` : "";
    const titleContent = conferenceUrl
      ? `<a href="${escapeHtml(conferenceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}<span class="deadline-link-arrow" aria-hidden="true">↗</span></a>`
      : escapeHtml(title);
    const originalTimezone = conference.timezone || "UTC";

    return `
      <article class="deadline-card ${urgencyClass(conference.timestamp)}" role="listitem">
        <div class="deadline-main">
          <div class="deadline-heading-row">
            <h2 class="deadline-title">${titleContent}</h2>
            <div class="deadline-tags">
              ${conference.predicted ? '<span class="deadline-predicted">Predicted</span>' : ""}
              ${renderSubjectTags(conference.sub)}
            </div>
          </div>
          ${fullName}
          <div class="deadline-event-meta">${eventDate}${location}</div>
          ${note}
        </div>
        <div class="deadline-clock">
          <p class="deadline-countdown" data-deadline="${conference.timestamp}">${formatCountdown(conference.timestamp)}</p>
          <time datetime="${new Date(conference.timestamp).toISOString()}">${escapeHtml(formatDeadline(conference.timestamp))}</time>
          <p class="deadline-source-timezone">Source timezone: ${escapeHtml(originalTimezone)}</p>
        </div>
      </article>
    `;
  }

  function updateCountdowns() {
    elements.list.querySelectorAll("[data-deadline]").forEach((element) => {
      const timestamp = Number(element.dataset.deadline);
      if (Number.isFinite(timestamp)) element.textContent = formatCountdown(timestamp);
    });
  }

  function render() {
    const filtered = getFilteredConferences();
    const displayed = filtered.slice(0, visibleCount);

    elements.loading.hidden = true;
    elements.error.hidden = true;
    elements.empty.hidden = filtered.length !== 0;
    elements.list.innerHTML = displayed.map(renderConference).join("");
    elements.resultsSummary.textContent = filtered.length
      ? `Showing ${displayed.length} of ${filtered.length} upcoming deadline${filtered.length === 1 ? "" : "s"}`
      : "No upcoming deadlines match these filters";
    elements.loadMore.hidden = displayed.length >= filtered.length;
    updateCountdowns();
  }

  function useData(data, status) {
    conferences = data;
    populateSubjectOptions();
    render();
    setDataStatus(status.kind, status.label, status.updatedAt);
    document.dispatchEvent(new CustomEvent("site:content-ready"));
  }

  function showFatalError() {
    elements.loading.hidden = true;
    elements.list.innerHTML = "";
    elements.empty.hidden = true;
    elements.error.hidden = false;
    elements.loadMore.hidden = true;
    elements.resultsSummary.textContent = "Deadline data could not be loaded";
    setDataStatus("error", "Data unavailable");
    document.dispatchEvent(new CustomEvent("site:content-ready"));
  }

  function resetAndRender() {
    visibleCount = INITIAL_RESULT_COUNT;
    render();
  }

  async function initialize() {
    try {
      localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch (_error) {
      localTimezone = "UTC";
    }
    elements.localTimezone.textContent = localTimezone;

    const cached = readBrowserCache();
    let hasUsableData = false;

    if (cached?.data.length) {
      useData(cached.data, {
        kind: "cached",
        label: "Recently cached data",
        updatedAt: cached.lastModified || cached.fetchedAt
      });
      hasUsableData = true;
    }

    try {
      const fallback = await fetchDeadlineData(FALLBACK_DATA_URL, { cache: "force-cache" });
      if (
        fallback.data.length &&
        (!hasUsableData || countUpcoming(fallback.data) > countUpcoming(conferences))
      ) {
        useData(fallback.data, {
          kind: "cached",
          label: "Published snapshot",
          updatedAt: fallback.lastModified
        });
        hasUsableData = true;
      }
    } catch (_error) {
      // Continue to the live source before presenting an error.
    }

    try {
      const live = await fetchDeadlineData(REMOTE_DATA_URL, { cache: "no-store" });
      if (!live.data.length) throw new Error("Live deadline data is empty.");
      writeBrowserCache(serializeForCache(live.data), live.lastModified);
      useData(live.data, {
        kind: "live",
        label: "Live source connected",
        updatedAt: live.lastModified || new Date().toISOString()
      });
      hasUsableData = true;
    } catch (_error) {
      if (hasUsableData) {
        setDataStatus("cached", "Using cached data");
      } else {
        showFatalError();
      }
    }

    window.clearTimeout(countdownTimer);
    const updateAtNextSecond = () => {
      const firstDeadline = elements.list.querySelector("[data-deadline]");
      if (firstDeadline && Number(firstDeadline.dataset.deadline) <= Date.now()) {
        render();
      } else {
        updateCountdowns();
      }
      const delayToNextSecond = 1000 - (Date.now() % 1000) + 20;
      countdownTimer = window.setTimeout(updateAtNextSecond, delayToNextSecond);
    };
    updateAtNextSecond();
  }

  elements.search.addEventListener("input", resetAndRender);
  elements.subject.addEventListener("change", resetAndRender);
  elements.includePredicted.addEventListener("change", resetAndRender);
  elements.loadMore.addEventListener("click", () => {
    visibleCount += RESULT_PAGE_SIZE;
    render();
  });

  initialize();
})();
