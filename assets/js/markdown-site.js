(function () {
  "use strict";

  const root = document.querySelector("#site-root");
  const sourcePath = document.documentElement.dataset.markdownSource;

  function parseFrontMatter(source) {
    const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
    if (!match) return { meta: {}, markdown: source };

    const meta = {};
    match[1].split("\n").forEach((line) => {
      const separator = line.indexOf(":");
      if (separator < 0) return;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      meta[key] = value;
    });

    return { meta, markdown: source.slice(match[0].length) };
  }

  function extractSectionIds(markdown) {
    const ids = [];
    const cleaned = markdown.replace(/^##\s+(.+?)\s+\{#([\w-]+)\}\s*$/gm, (_, title, id) => {
      ids.push(id);
      return `## ${title}`;
    });
    return { ids, markdown: cleaned };
  }

  function externalizeLinks(container) {
    container.querySelectorAll('a[href^="http"]').forEach((link) => {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });
  }

  function enhancePeopleTable(section) {
    const table = section.querySelector("table");
    if (!table) return;
    const headers = Array.from(table.querySelectorAll("thead th"), (cell) => cell.textContent.trim().toLowerCase());
    if (headers.join("|") !== "photo|name|affiliation") return;

    const grid = document.createElement("div");
    grid.className = `people-grid ${section.id === "speaker" ? "speaker-grid" : "organizer-grid"}`;
    table.querySelectorAll("tbody tr").forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length !== 3) return;
      const card = document.createElement("article");
      card.className = "member markdown-person";
      card.setAttribute("data-aos", "fade-up");
      const image = cells[0].querySelector("img");
      card.innerHTML = `
        <div class="person-photo">${image ? image.outerHTML : ""}</div>
        <div class="member-info"><h4>${cells[1].innerHTML}</h4><span>${cells[2].innerHTML}</span></div>`;
      grid.appendChild(card);
    });
    table.closest(".markdown-table").replaceWith(grid);
  }

  const scrollableTables = [];

  let detailsCounter = 0;

  function makeRowExpandable(row, layout, cell) {
    const details = layout.querySelector(".schedule-details");
    if (!details) return;
    detailsCounter += 1;
    details.id = `schedule-details-${detailsCounter}`;
    const inner = document.createElement("div");
    inner.className = "schedule-details-inner";
    while (details.firstChild) inner.appendChild(details.firstChild);
    details.appendChild(inner);
    cell.appendChild(details);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "schedule-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", details.id);
    toggle.innerHTML = '<span>Details</span><i class="bi bi-chevron-down"></i>';
    layout.appendChild(toggle);

    // Hand the height back to CSS once the slide finishes. The timeout is a
    // safety net: transitionend never fires when the transition is skipped
    // (reduced motion, a backgrounded tab), which would otherwise freeze the
    // panel at its start height.
    let settleTimer;
    const settle = () => {
      clearTimeout(settleTimer);
      details.style.height = row.classList.contains("is-open") ? "auto" : "";
    };
    details.addEventListener("transitionend", (event) => {
      if (event.propertyName === "height") settle();
    });

    row.classList.add("schedule-row--expandable");
    row.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      const opening = !row.classList.contains("is-open");
      const target = `${inner.offsetHeight}px`;
      details.style.height = opening ? "0px" : target;
      details.getBoundingClientRect();
      row.classList.toggle("is-open", opening);
      toggle.setAttribute("aria-expanded", String(opening));
      details.style.height = opening ? target : "0px";
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, 400);
    });
  }

  function enhanceScheduleTable(section) {
    if (section.id !== "schedule") return;
    section.querySelectorAll("table").forEach((table) => {
      table.classList.add("schedule-table");
      table.querySelectorAll("tbody tr").forEach((row) => {
        const badge = row.querySelector(".schedule-badge");
        const label = badge ? badge.textContent.toLowerCase() : "";
        let kind = "plain";
        if (label.includes("speaker")) kind = "talk";
        else if (label.includes("sharing")) kind = "sharing";
        else if (label.includes("poster")) kind = "poster";
        row.classList.add("schedule-row", `schedule-row--${kind}`);
        const shortLabels = { talk: "Speaker", sharing: "Sharing", poster: "Poster" };
        if (badge && shortLabels[kind]) badge.dataset.short = shortLabels[kind];
        const when = row.querySelector("td");
        if (when && !when.querySelector(".schedule-when")) {
          const slot = document.createElement("div");
          slot.className = "schedule-when";
          while (when.firstChild) slot.appendChild(when.firstChild);
          when.appendChild(slot);
        }
        const programme = row.querySelectorAll("td")[1];
        if (!programme || programme.querySelector(".schedule-programme")) return;
        const layout = document.createElement("div");
        layout.className = "schedule-programme";
        while (programme.firstChild) layout.appendChild(programme.firstChild);
        programme.appendChild(layout);
        makeRowExpandable(row, layout, programme);
      });
    });
  }

  function enhanceLeaderboardTables(section) {
    if (section.id !== "leaderboard" && section.id !== "leadboard") return;
    const medals = { "1": "gold", "2": "silver", "3": "bronze" };
    section.querySelectorAll("table").forEach((table) => {
      table.classList.add("leaderboard-table");
      // Carry the header text onto every cell so the small-screen card layout
      // (which hides <thead>) can still label each field.
      const headers = Array.from(table.querySelectorAll("thead th"), (cell) => cell.textContent.trim());
      table.querySelectorAll("tbody tr").forEach((row) => {
        const cells = row.querySelectorAll("td");
        cells.forEach((cell, column) => {
          if (column > 0 && headers[column]) cell.dataset.label = headers[column];
        });
        const cell = cells[0];
        if (!cell) return;
        const medal = medals[cell.textContent.trim().charAt(0)];
        if (medal) cell.innerHTML = `<span class="rank-pill rank-${medal}">${cell.innerHTML}</span>`;
      });
    });
  }

  function enhanceTables(section) {
    section.querySelectorAll("table").forEach((table) => {
      table.classList.add("table", "table-hover", "align-middle");
      const wrapper = document.createElement("div");
      wrapper.className = "table-responsive markdown-table";
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
      scrollableTables.push(wrapper);
    });
    enhancePeopleTable(section);
    enhanceScheduleTable(section);
    enhanceLeaderboardTables(section);
  }

  function buildSections(markdown, sectionIds) {
    const parsed = document.createElement("div");
    parsed.innerHTML = marked.parse(markdown, { gfm: true, breaks: false });
    const sections = [];
    let section = null;
    let index = 0;

    Array.from(parsed.childNodes).forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "H2") {
        const id = sectionIds[index] || `section-${index + 1}`;
        section = document.createElement("section");
        section.id = id;
        section.className = id === "speaker" || id === "organizer" ? "team markdown-section" : "services markdown-section";
        section.innerHTML = '<div class="container"><div class="section-title" data-aos="fade-in"><div class="markdown-body"></div></div></div>';
        section.querySelector(".markdown-body").appendChild(node);
        sections.push(section);
        index += 1;
      } else if (section) {
        section.querySelector(".markdown-body").appendChild(node);
      }
    });

    sections.forEach((item) => {
      enhanceTables(item);
      externalizeLinks(item);
    });
    return sections;
  }

  function navItem(id, title) {
    const labels = {
      announce: "Announcement",
      intro: "Introduction",
      dates: "Dates",
      call: "Call for Paper",
      tracks: "Tracks & Submission",
      leaderboard: "Leaderboard",
      schedule: "Schedule",
      speaker: "Speakers",
      organizer: "Organizers",
      contact: "Contact"
    };
    return `<li><a class="nav-link scrollto" href="#${id}">${labels[id] || title}</a></li>`;
  }

  function renderPage(meta, sections) {
    const excluded = new Set((meta.nav_exclude || "").split(",").map((id) => id.trim()).filter(Boolean));
    const hiddenSections = new Set((meta.section_exclude || "").split(",").map((id) => id.trim()).filter(Boolean));
    const visibleSections = sections.filter((section) => !hiddenSections.has(section.id));
    const nav = visibleSections
      .filter((section) => !excluded.has(section.id))
      .map((section) => navItem(section.id, section.querySelector("h2").textContent))
      .join("");
    const overlay = meta.overlay === "true" ? "hero-overlay" : "";
    // Only offer the hero shortcut when there is a schedule to jump to.
    const cta = visibleSections.some((section) => section.id === "schedule")
      ? '<a href="#schedule" class="hero-cta scrollto">View Schedule <i class="bi bi-arrow-down-short"></i></a>'
      : "";
    const event = meta.event_url
      ? `<a href="${meta.event_url}" target="_blank" rel="noopener noreferrer">${meta.event}</a>`
      : meta.event;

    root.className = "";
    // The placeholder was a live region; keep it from re-announcing the whole
    // page now that the real content is in place.
    root.removeAttribute("aria-live");
    root.removeAttribute("aria-busy");
    root.innerHTML = `
      <header id="header" class="fixed-top header-transparent">
        <div class="container d-flex align-items-center justify-content-between position-relative">
          <div class="logo"><p class="text-light"><a href="index.html"><span>LSVOS</span></a></p></div>
          <nav id="navbar" class="navbar">
            <ul>
              <li><a class="nav-link scrollto active" href="#hero">Home</a></li>
              ${nav}
              <li class="dropdown"><a href="#" aria-haspopup="true" aria-expanded="false"><span>Editions</span> <i class="bi bi-chevron-down"></i></a>
                <ul>
                  <li><a href="./index.html">8th LSVOS (2026)</a></li>
                  <li><a href="./index_2025.html">7th LSVOS (2025)</a></li>
                  <li><a href="./index_2024.html">6th LSVOS (2024)</a></li>
                  <li><a href="https://youtube-vos.org/challenge/2023/">5th LSVOS (2023)</a></li>
                  <li><a href="https://youtube-vos.org/challenge/2022/">4th LSVOS (2022)</a></li>
                  <li><a href="https://youtube-vos.org/challenge/2021/">3rd LSVOS (2021)</a></li>
                  <li><a href="https://youtube-vos.org/challenge/2019/">2nd LSVOS (2019)</a></li>
                  <li><a href="https://youtube-vos.org/challenge/2018/">1st LSVOS (2018)</a></li>
                </ul>
              </li>
            </ul>
            <button type="button" class="bi bi-list mobile-nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="navbar"></button>
          </nav>
        </div>
      </header>
      <section id="hero" class="${overlay}" style="background-image: url('${meta.background}')">
        <div class="hero-container" data-aos="fade-up">
          <h1>${meta.title}</h1>
          <h2 class="hero-event">${event}</h2>
          <h2>${meta.date}</h2>
          <h2>${meta.location}</h2>
          ${cta}
        </div>
      </section>
      <main id="main"></main>
      <footer id="footer"><div class="container"><div class="copyright">&copy; Copyright <strong><span>LSVOS</span></strong>. All Rights Reserved</div></div></footer>
      <a href="#hero" class="back-to-top d-flex align-items-center justify-content-center" aria-label="Back to top"><i class="bi bi-arrow-up-short"></i></a>`;

    const main = root.querySelector("main");
    visibleSections.forEach((section) => main.appendChild(section));
    externalizeLinks(root);
    document.title = meta.page_title || `${meta.title} · ${meta.year || "LSVOS"}`;
  }

  function initializeInteractions() {
    const header = document.querySelector("#header");
    const navbar = document.querySelector("#navbar");
    const toggle = document.querySelector(".mobile-nav-toggle");
    const backToTop = document.querySelector(".back-to-top");
    const links = Array.from(document.querySelectorAll("#navbar .scrollto"));

    const updateScrollState = () => {
      header.classList.toggle("header-scrolled", window.scrollY > 100);
      backToTop.classList.toggle("active", window.scrollY > 100);
      const position = window.scrollY + 200;
      links.forEach((link) => {
        const target = document.querySelector(link.hash);
        link.classList.toggle("active", Boolean(target && position >= target.offsetTop && position <= target.offsetTop + target.offsetHeight));
      });
    };

    toggle.addEventListener("click", () => {
      const open = navbar.classList.toggle("navbar-mobile");
      toggle.classList.toggle("bi-list", !open);
      toggle.classList.toggle("bi-x", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });

    // The dropdown opens on hover for pointer users; this makes it reachable by
    // keyboard and on touch, at every width.
    const dropdown = document.querySelector(".navbar .dropdown > a");
    dropdown.addEventListener("click", (event) => {
      event.preventDefault();
      const menu = event.currentTarget.nextElementSibling;
      const open = menu.classList.toggle(
        navbar.classList.contains("navbar-mobile") ? "dropdown-active" : "dropdown-open"
      );
      event.currentTarget.setAttribute("aria-expanded", String(open));
    });

    document.addEventListener("click", (event) => {
      if (event.target.closest(".navbar .dropdown")) return;
      const menu = dropdown.nextElementSibling;
      menu.classList.remove("dropdown-open", "dropdown-active");
      dropdown.setAttribute("aria-expanded", "false");
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      dropdown.nextElementSibling.classList.remove("dropdown-open", "dropdown-active");
      dropdown.setAttribute("aria-expanded", "false");
      if (navbar.classList.contains("navbar-mobile")) toggle.click();
    });

    // A wide table only needs a scroll affordance when it actually overflows.
    const markScrollable = () => scrollableTables.forEach((wrapper) => {
      wrapper.classList.toggle("is-scrollable", wrapper.scrollWidth > wrapper.clientWidth + 1);
    });
    markScrollable();
    window.addEventListener("resize", markScrollable);

    document.querySelectorAll(".scrollto").forEach((link) => link.addEventListener("click", (event) => {
      const target = document.querySelector(link.hash);
      if (!target) return;
      event.preventDefault();
      if (navbar.classList.contains("navbar-mobile")) toggle.click();
      window.scrollTo({ top: target.offsetTop - header.offsetHeight, behavior: "smooth" });
    }));

    window.addEventListener("scroll", updateScrollState, { passive: true });
    updateScrollState();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (window.AOS) AOS.init({ duration: still ? 0 : 800, easing: "ease-in-out", once: true });
  }

  async function initialize() {
    try {
      if (!sourcePath) throw new Error("No Markdown source is configured for this page.");
      if (!window.marked) throw new Error("The Markdown renderer could not be loaded.");
      const response = await fetch(sourcePath);
      if (!response.ok) throw new Error(`Unable to load ${sourcePath} (${response.status}).`);
      const source = await response.text();
      const { meta, markdown } = parseFrontMatter(source);
      const extracted = extractSectionIds(markdown);
      const sections = buildSections(extracted.markdown, extracted.ids);
      renderPage(meta, sections);
      initializeInteractions();
    } catch (error) {
      root.className = "site-error container";
      root.innerHTML = `<div><h1>Unable to render this page</h1><p>${error.message}</p><p>Serve the repository through a local HTTP server instead of opening the HTML file directly.</p></div>`;
      console.error(error);
    }
  }

  initialize();
})();
