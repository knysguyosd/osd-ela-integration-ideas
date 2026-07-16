/* CKLA <-> Utah Standards Integration Finder — hash-routed static app over data.js */
(function () {
  "use strict";

  var DB = window.CROSSWALK_DATA;
  if (!DB) {
    document.getElementById("app").innerHTML =
      "<div class='empty'>data.js not found. Run <code>python scripts/build_web_data.py</code> and reload.</div>";
    return;
  }

  // ---------- indexes ----------

  var allStandards = DB.standards.social_studies.concat(DB.standards.computer_science);
  var stdByCode = {};
  allStandards.forEach(function (s) { stdByCode[s.code] = s; });

  var unitById = {};
  var lessons = [];
  var lessonById = {};
  DB.units.forEach(function (u) {
    unitById[u.unit_id] = u;
    u.lessons.forEach(function (l) {
      l.unit_id = u.unit_id;
      lessons.push(l);
      lessonById[l.lesson_id] = l;
    });
  });

  var intsByLesson = {};
  var intsByStd = {};
  DB.integrations.forEach(function (r) {
    (intsByLesson[r.lesson_id] = intsByLesson[r.lesson_id] || []).push(r);
    (intsByStd[r.standard_code] = intsByStd[r.standard_code] || []).push(r);
  });

  var STRENGTH_LABEL = { 3: "Direct", 2: "Natural extension", 1: "Opportunistic" };
  var STRENGTH_TIP = {
    3: "Direct — the lesson already does much of the standard's work",
    2: "Natural extension — a modest add-on makes the connection explicit",
    1: "Opportunistic — a brief tie-in that enriches the lesson"
  };

  // persists while the page is open, across views
  var filters = { system: "all", axis: "all", minStrength: 1, status: "all" };

  // ---------- helpers ----------

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function lessonUrl(l) { return "#/lesson/" + l.lesson_id; }
  function gradeLabel(g) { return g === 0 ? "K" : g; }
  // K-2 CKLA calls its units "Knowledge" domains; teachers know them by that name
  function unitNoun(u) { return u.grade <= 2 ? "Knowledge" : "Unit"; }
  function unitShort(u) { return unitNoun(u) + " " + u.unit; }
  function lessonNo(l) { return l.lesson_label || l.lesson; }
  function lessonLabel(l) { return "Lesson " + lessonNo(l) + ": " + l.title; }
  function unitLabel(u) { return unitShort(u) + ": " + u.unit_title; }

  function sysBadge(sys) {
    return sys === "SS"
      ? "<span class='badge badge-ss'>Social Studies</span>"
      : "<span class='badge badge-cs'>Computer Science</span>";
  }
  function axisBadge(axis) {
    return axis === "content"
      ? "<span class='badge badge-content' title='The lesson&#39;s subject matter overlaps the standard&#39;s subject matter'>Content match</span>"
      : "<span class='badge badge-skill' title='The lesson&#39;s student work builds the practice the standard demands'>Skill match</span>";
  }
  function statusBadge(status) {
    if (status === "approved") return "<span class='badge badge-approved'>Approved</span>";
    if (status === "rejected") return "";
    return "<span class='badge badge-draft'>Draft</span>";
  }
  function strengthDots(n) {
    var out = "";
    for (var i = 1; i <= 3; i++) out += "<span class='" + (i <= n ? "on" : "off") + "'>&#9679;</span>";
    return "<span class='dots' title='" + esc(STRENGTH_TIP[n]) + "'>" + out +
      " <span class='faint'>" + esc(STRENGTH_LABEL[n]) + "</span></span>";
  }

  function visibleInts(list) {
    return (list || []).filter(function (r) {
      if (r.status === "rejected") return false;
      if (filters.system !== "all" && r.system !== filters.system) return false;
      if (filters.axis !== "all" && r.axis !== filters.axis) return false;
      if (r.strength < filters.minStrength) return false;
      if (filters.status !== "all" && r.status !== filters.status) return false;
      return true;
    });
  }

  function activeInts(list) {
    return (list || []).filter(function (r) { return r.status !== "rejected"; });
  }

  function sortInts(list) {
    return list.slice().sort(function (a, b) {
      if (a.system !== b.system) return a.system === "SS" ? -1 : 1;
      if (a.strength !== b.strength) return b.strength - a.strength;
      return a.standard_code < b.standard_code ? -1 : 1;
    });
  }

  function countBadges(list) {
    var ss = 0, cs = 0;
    activeInts(list).forEach(function (r) { r.system === "SS" ? ss++ : cs++; });
    var out = "";
    if (ss) out += "<span class='badge badge-ss'>" + ss + " SS</span>";
    if (cs) out += "<span class='badge badge-cs'>" + cs + " CS</span>";
    return out || "<span class='badge badge-plain'>0</span>";
  }

  // ---------- filter bar ----------

  function fbtn(group, value, label, on) {
    return "<button class='fbtn" + (on ? " on" : "") + "' data-fgroup='" + group +
      "' data-fvalue='" + value + "'>" + label + "</button>";
  }

  function filterBar(shownCount, totalCount) {
    return "<div class='filter-bar no-print'>" +
      "<div class='filter-group'><span class='label'>Subject</span>" +
        fbtn("system", "all", "All", filters.system === "all") +
        fbtn("system", "SS", "Social Studies", filters.system === "SS") +
        fbtn("system", "CS", "Computer Science", filters.system === "CS") + "</div>" +
      "<div class='filter-group'><span class='label'>Match type</span>" +
        fbtn("axis", "all", "Both", filters.axis === "all") +
        fbtn("axis", "content", "Content", filters.axis === "content") +
        fbtn("axis", "skill", "Skill", filters.axis === "skill") + "</div>" +
      "<div class='filter-group'><span class='label'>Depth</span>" +
        fbtn("minStrength", "1", "Any", filters.minStrength === 1) +
        fbtn("minStrength", "2", "&#9679;&#9679;+", filters.minStrength === 2) +
        fbtn("minStrength", "3", "&#9679;&#9679;&#9679; only", filters.minStrength === 3) + "</div>" +
      "<div class='filter-group'><span class='label'>Status</span>" +
        fbtn("status", "all", "All", filters.status === "all") +
        fbtn("status", "approved", "Approved", filters.status === "approved") +
        fbtn("status", "draft", "Draft", filters.status === "draft") + "</div>" +
      "<span class='filter-count'>" + shownCount + " of " + totalCount + " ideas shown</span>" +
      "</div>";
  }

  // ---------- integration card ----------

  function intCard(r, opts) {
    opts = opts || {};
    var std = stdByCode[r.standard_code] || {};
    var context = "";
    if (opts.showLesson) {
      var l = lessonById[r.lesson_id];
      if (l) {
        var u = unitById[l.unit_id];
        context = "<div class='int-context'>In <a href='" + lessonUrl(l) + "'>" +
          esc(unitShort(u) + " · " + lessonLabel(l)) + "</a></div>";
      }
    }
    var meta = [];
    if (r.materials) meta.push("<span><b>Materials:</b> " + esc(r.materials) + "</span>");
    if (r.time_estimate) meta.push("<span><b>Time:</b> " + esc(r.time_estimate) + "</span>");
    return "<div class='int-card sys-" + r.system + "'>" +
      "<div class='int-head'>" +
        "<a class='std-link' href='#/standard/" + encodeURIComponent(r.standard_code) + "'>" + esc(r.standard_code) + "</a>" +
        sysBadge(r.system) + axisBadge(r.axis) + strengthDots(r.strength) +
        "<span class='spacer'></span>" + statusBadge(r.status) +
      "</div>" +
      context +
      "<div class='int-standard-text'>" + esc(std.text || "") + "</div>" +
      "<div class='int-idea'><span class='idea-label'>In the classroom</span>" + esc(r.teacher_idea) + "</div>" +
      (meta.length ? "<div class='int-meta'>" + meta.join("") + "</div>" : "") +
      (r.rationale ? "<details class='plain'><summary>Why this fits</summary><div class='small muted'>" +
        esc(r.rationale) + "</div></details>" : "") +
      "</div>";
  }

  function intCardList(list, opts) {
    var visible = sortInts(visibleInts(list));
    var total = activeInts(list).length;
    var html = filterBar(visible.length, total);
    if (!visible.length) {
      html += "<div class='empty'>No integration ideas match the current filters.</div>";
    } else {
      visible.forEach(function (r) { html += intCard(r, opts); });
    }
    return html;
  }

  // ---------- views ----------

  function viewHome() {
    var total = activeInts(DB.integrations).length;
    var approved = DB.integrations.filter(function (r) { return r.status === "approved"; }).length;
    var covered = { SS: {}, CS: {} };
    activeInts(DB.integrations).forEach(function (r) { covered[r.system][r.standard_code] = 1; });
    var ssCov = Object.keys(covered.SS).length, csCov = Object.keys(covered.CS).length;

    var html = "<section class='card hero'>" +
      "<h1>Find the social studies and computer science <em>already inside</em> your CKLA lessons</h1>" +
      "<p class='lede'>Every record below pairs a specific Amplify CKLA lesson with a Utah Core " +
      "Social Studies or Computer Science standard for its grade — plus a concrete, classroom-ready idea for making the " +
      "connection explicit without abandoning the ELA block.</p>" +
      "<div class='stat-row'>" +
        "<div class='stat'><b>" + DB.units.length + "</b><span>units indexed</span></div>" +
        "<div class='stat'><b>" + lessons.length + "</b><span>lessons</span></div>" +
        "<div class='stat'><b>" + total + "</b><span>integration ideas</span></div>" +
        "<div class='stat'><b>" + approved + "</b><span>teacher-approved</span></div>" +
        "<div class='stat'><b>" + ssCov + "/" + DB.standards.social_studies.length + "</b><span>SS standards reached</span></div>" +
        "<div class='stat'><b>" + csCov + "/" + DB.standards.computer_science.length + "</b><span>CS standards reached</span></div>" +
      "</div></section>";

    html += "<section class='card'><div class='legend'>" +
      "<div><h3>Two ways a lesson can match a standard</h3><ul>" +
      "<li><span class='badge badge-content'>Content match</span> — the lesson's <em>topic</em> overlaps the standard's topic (e.g., a Native Americans chapter &rarr; Utah Strand&nbsp;1).</li>" +
      "<li><span class='badge badge-skill'>Skill match</span> — the lesson's <em>student work</em> builds the practice the standard demands (e.g., argument writing with sources &rarr; SS inquiry verbs; organizing data &rarr; CS Data &amp; Analysis).</li>" +
      "</ul></div>" +
      "<div><h3>Integration depth</h3><ul>" +
      "<li><span class='dots'><span class='on'>&#9679;&#9679;&#9679;</span></span> <b>Direct</b> — the lesson already does much of the standard's work.</li>" +
      "<li><span class='dots'><span class='on'>&#9679;&#9679;</span><span class='off'>&#9679;</span></span> <b>Natural extension</b> — a modest add-on makes it explicit.</li>" +
      "<li><span class='dots'><span class='on'>&#9679;</span><span class='off'>&#9679;&#9679;</span></span> <b>Opportunistic</b> — a quick tie-in enriches the lesson.</li>" +
      "</ul></div>" +
      "<div><h3>Curation status</h3><ul>" +
      "<li><span class='badge badge-approved'>Approved</span> — reviewed and confirmed by a teacher.</li>" +
      "<li><span class='badge badge-draft'>Draft</span> — AI-proposed, awaiting teacher review. Use with judgment.</li>" +
      "</ul></div>" +
      "</div></section>";

    html += "<h2 style='margin-top:1.6rem'>Browse by unit</h2><div class='grid-3'>" + DB.units.map(unitCard).join("") + "</div>";

    html += "<section class='card' style='margin-top:1.4rem'><h2>Standards coverage</h2>" +
      "<p class='small muted'>Across the indexed units, <b>" + ssCov + " of " + DB.standards.social_studies.length +
      "</b> Social Studies standards and <b>" + csCov + " of " + DB.standards.computer_science.length +
      "</b> Computer Science standards have at least one integration idea. Standards with no coverage are " +
      "flagged on the standards page — they need standalone instruction outside CKLA.</p>" +
      "<a class='btn' href='#/standards'>Open the standards browser &rarr;</a></section>";
    return html;
  }

  function unitCard(u) {
    var ints = [];
    u.lessons.forEach(function (l) { ints = ints.concat(intsByLesson[l.lesson_id] || []); });
    return "<a class='card unit-card' href='#/unit/" + u.unit_id + "'>" +
      "<div class='unit-kicker'>Grade " + gradeLabel(u.grade) + " &middot; " + unitShort(u) + " &middot; " +
      u.lessons.length + " lessons &middot; " + esc(u.unit_length_days) + " days</div>" +
      "<h3>" + esc(u.unit_title) + "</h3>" +
      "<p class='small muted'>" + esc(u.content_theme) + "</p>" +
      "<div class='unit-counts'>" + countBadges(ints) + "</div></a>";
  }

  function viewUnits() {
    return "<h1>Units</h1><p class='muted'>The CKLA units and Knowledge domains indexed so far. More come online as each grade is reviewed.</p>" +
      "<div class='grid-3'>" + DB.units.map(unitCard).join("") + "</div>";
  }

  function viewUnit(unitId) {
    var u = unitById[unitId];
    if (!u) return notFound("Unit not found.");
    var html = "<div class='breadcrumb'><a href='#/'>Home</a> &rsaquo; <a href='#/units'>Units</a></div>";
    html += "<section class='card unit-header'><h1>" + esc(unitLabel(u)) + "</h1>" +
      "<div class='meta-row'>" +
        "<span class='chip'>Grade " + gradeLabel(u.grade) + "</span>" +
        "<span class='chip'>" + esc(u.unit_length_days) + " days</span>" +
        "<span class='chip'>" + esc(u.lexile) + "</span>" +
        "<span class='chip'>" + esc(u.text_type) + "</span>" +
      "</div>" +
      "<p class='small'>" + esc(u.unit_summary) + "</p>" +
      "<div class='two-col'>" +
      "<div><h3>Big ideas</h3><ul class='tight'>" + u.big_ideas.map(function (b) {
        return "<li>" + esc(b) + "</li>";
      }).join("") + "</ul></div>" +
      "<div><h3>Unit writing project</h3><p class='small muted'>" + esc(u.writing_focus) + "</p></div>" +
      "</div>" +
      "<details class='plain'><summary>Prior knowledge from earlier grades</summary><ul class='tight muted'>" +
      u.prior_knowledge_units.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") +
      "</ul></details></section>";

    html += "<section class='card'><h2>Lessons</h2>";
    u.lessons.forEach(function (l) {
      var ints = intsByLesson[l.lesson_id] || [];
      var domains = [];
      (l.primary_focus || []).forEach(function (f) {
        if (domains.indexOf(f.domain) < 0) domains.push(f.domain);
      });
      html += "<div class='lesson-row'>" +
        "<div class='lesson-no'>" + lessonNo(l) + "</div>" +
        "<div class='lesson-main'><a href='" + lessonUrl(l) + "'>" + esc(l.title) + "</a>" +
        "<div class='faint'>" + esc(domains.join(" · ")) + "</div></div>" +
        "<div class='lesson-tags'>" + countBadges(ints) + "</div></div>";
    });
    html += "</section>";
    return html;
  }

  function viewLesson(lessonId) {
    var l = lessonById[lessonId];
    if (!l) return notFound("Lesson not found.");
    var u = unitById[l.unit_id];
    var ints = intsByLesson[l.lesson_id] || [];

    var idx = u.lessons.indexOf(l);
    var prev = u.lessons[idx - 1], next = u.lessons[idx + 1];
    var pager = "<div class='pager no-print'><span>" +
      (prev ? "&larr; <a href='" + lessonUrl(prev) + "'>" + esc(lessonLabel(prev)) + "</a>" : "") +
      "</span><span>" +
      (next ? "<a href='" + lessonUrl(next) + "'>" + esc(lessonLabel(next)) + "</a> &rarr;" : "") +
      "</span></div>";

    var html = "<div class='breadcrumb'><a href='#/'>Home</a> &rsaquo; " +
      "<a href='#/unit/" + u.unit_id + "'>" + esc(unitLabel(u)) + "</a></div>";

    html += "<div class='lesson-title-row'><h1>Lesson " + lessonNo(l) + ": " + esc(l.title) + "</h1>" +
      "<button class='btn no-print' onclick='window.print()'>Print one-pager</button></div>";

    html += "<div class='grid-2'>";
    html += "<section class='card'><h3>Primary focus</h3><ul class='tight'>" +
      (l.primary_focus || []).map(function (f) {
        return "<li><b>" + esc(f.domain) + ":</b> " + esc(f.text) + "</li>";
      }).join("") + "</ul>" +
      "<h3>Formative assessments</h3><ul class='tight'>" +
      (l.formative_assessments || []).map(function (a) {
        return "<li><b>" + esc(a.name) + "</b> — <span class='muted'>" + esc(a.description) + "</span></li>";
      }).join("") + "</ul></section>";

    var segRows = "";
    (l.segments || []).forEach(function (s) {
      segRows += "<tr class='seg-block'><td colspan='3'>" + esc(s.block) +
        (s.minutes != null ? " (" + s.minutes + " min)" : "") + "</td></tr>";
      (s.activities || []).forEach(function (a) {
        segRows += "<tr><td>" + esc(a.name) + "</td><td>" + esc(a.grouping || "") + "</td><td>" +
          (a.minutes != null ? a.minutes + " min" : "") + "</td></tr>";
      });
    });
    html += "<section class='card'><h3>Lesson at a glance</h3>" +
      "<table class='seg-table'><thead><tr><th>Activity</th><th>Grouping</th><th>Time</th></tr></thead><tbody>" +
      segRows + "</tbody></table></section>";
    html += "</div>";

    html += "<section class='card'><h3>What happens in this lesson</h3>" +
      "<p class='small'>" + esc(l.content_summary) + "</p>" +
      "<div>" + (l.topics || []).map(function (t) { return "<span class='chip'>" + esc(t) + "</span>"; }).join("") + "</div>" +
      "<details class='plain'><summary>Student work &amp; vocabulary</summary><div class='two-col'>" +
      "<div><h4>Students will&hellip;</h4><ul class='tight'>" +
      (l.student_work || []).map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("") + "</ul></div>" +
      "<div><h4>Core vocabulary</h4><div>" +
      (l.core_vocab || []).map(function (v) { return "<span class='chip'>" + esc(v) + "</span>"; }).join("") + "</div>" +
      "<h4>Academic vocabulary</h4><dl class='vocab'>" +
      (l.academic_vocab || []).map(function (v) {
        return "<dt>" + esc(v.word) + "</dt><dd>" + esc(v.definition) + "</dd>";
      }).join("") + "</dl></div>" +
      "</div></details></section>";

    html += "<h2 style='margin-top:1.6rem'>Integration ideas <span class='faint'>(" +
      activeInts(ints).length + ")</span></h2>";
    html += intCardList(ints);
    html += pager;
    return html;
  }

  function coverageBadges(code) {
    var ints = activeInts(intsByStd[code]);
    if (!ints.length) return "<span class='badge badge-gap' title='No CKLA lesson in the indexed units reaches this standard — it needs standalone instruction'>Gap — no coverage</span>";
    var lessonSet = {};
    var maxStrength = 0;
    ints.forEach(function (r) {
      lessonSet[r.lesson_id] = 1;
      if (r.strength > maxStrength) maxStrength = r.strength;
    });
    var nl = Object.keys(lessonSet).length;
    return "<span class='badge badge-plain'>" + ints.length + " idea" + (ints.length > 1 ? "s" : "") +
      " · " + nl + " lesson" + (nl > 1 ? "s" : "") + "</span> " + strengthDots(maxStrength);
  }

  function stdRow(s) {
    return "<div class='std-row'>" +
      "<div class='std-code'><a href='#/standard/" + encodeURIComponent(s.code) + "'>" + esc(s.code) + "</a></div>" +
      "<div class='std-body'>" + esc(s.text) + "</div>" +
      "<div class='std-cov'>" + coverageBadges(s.code) + "</div></div>";
  }

  function viewStandards() {
    var covered = { SS: {}, CS: {} };
    activeInts(DB.integrations).forEach(function (r) { covered[r.system][r.standard_code] = 1; });

    var html = "<h1>Utah Core standards browser</h1>" +
      "<p class='muted'>Every Social Studies and Computer Science standard for the grades indexed so far, with " +
      "CKLA coverage across those units. <span class='badge badge-gap'>Gap</span> standards have no integration ideas " +
      "yet — plan standalone instruction for those.</p>";

    // more than one grade indexed -> prefix strand/concept headings with the grade
    var gradeSet = {};
    DB.standards.social_studies.concat(DB.standards.computer_science).forEach(function (s) {
      gradeSet[s.grade] = 1;
    });
    var multiGrade = Object.keys(gradeSet).length > 1;
    function gradePrefix(s) { return multiGrade ? "Grade " + gradeLabel(s.grade) + " · " : ""; }

    // SS grouped by grade + strand
    var strands = {};
    DB.standards.social_studies.forEach(function (s) {
      var k = s.grade + "." + s.strand;
      (strands[k] = strands[k] || []).push(s);
    });
    html += "<h2 id='ss' style='margin-top:1.4rem'>" + sysBadge("SS") + " Social Studies <span class='faint'>(" +
      Object.keys(covered.SS).length + " of " + DB.standards.social_studies.length + " covered)</span></h2>";
    Object.keys(strands).sort().forEach(function (k) {
      var group = strands[k];
      html += "<div class='strand-head'><h2>" + esc(gradePrefix(group[0])) + "Strand " + group[0].strand + ": " +
        esc(group[0].strand_title) + "</h2>" +
        "<details class='plain'><summary>About this strand</summary><p class='desc'>" +
        esc(group[0].strand_description) + "</p>" +
        (group[0].compelling_questions ? "<ul class='tight muted small'>" + group[0].compelling_questions.map(function (q) {
          return "<li>" + esc(q) + "</li>";
        }).join("") + "</ul>" : "") + "</details></div>";
      html += "<section class='card'>" + group.map(stdRow).join("") + "</section>";
    });

    // CS grouped by grade + concept
    var concepts = {};
    var conceptOrder = [];
    DB.standards.computer_science.forEach(function (s) {
      var k = s.grade + "|" + s.concept;
      if (!concepts[k]) { concepts[k] = []; conceptOrder.push(k); }
      concepts[k].push(s);
    });
    html += "<h2 id='cs' style='margin-top:2rem'>" + sysBadge("CS") + " Computer Science <span class='faint'>(" +
      Object.keys(covered.CS).length + " of " + DB.standards.computer_science.length + " covered)</span></h2>";
    conceptOrder.forEach(function (c) {
      var group = concepts[c];
      html += "<div class='strand-head'><h2>" + esc(gradePrefix(group[0]) + group[0].concept) + "</h2>" +
        "<details class='plain'><summary>About this concept</summary><p class='desc'>" +
        esc(group[0].concept_description) + "</p></details></div>";
      html += "<section class='card'>" + group.map(stdRow).join("") + "</section>";
    });
    return html;
  }

  function viewStandard(code) {
    var s = stdByCode[code];
    if (!s) return notFound("Standard not found.");
    var ints = activeInts(intsByStd[code]);

    var html = "<div class='breadcrumb'><a href='#/'>Home</a> &rsaquo; <a href='#/standards'>Standards</a></div>";
    html += "<section class='card std-detail-head sys-" + s.system + "'>" +
      "<div class='int-head'>" + sysBadge(s.system) +
      "<span class='badge badge-plain'>" + esc(s.system === "SS" ? "Strand " + s.strand + ": " + s.strand_title : s.concept) + "</span></div>" +
      "<h1>" + esc(s.code) + "</h1><p>" + esc(s.text) + "</p>";
    if (s.explanation) html += "<p class='small muted'>" + esc(s.explanation) + "</p>";
    if (s.examples && s.examples.length) {
      html += "<div>" + s.examples.map(function (e) { return "<span class='chip'>" + esc(e) + "</span>"; }).join("") + "</div>";
    }
    if (s.practices && s.practices.length) {
      html += "<h3 style='margin-top:.6rem'>CS practices</h3><ul class='tight muted small'>" +
        s.practices.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>";
    }
    if (s.compelling_questions && s.compelling_questions.length) {
      html += "<details class='plain'><summary>Strand compelling questions</summary><ul class='tight muted small'>" +
        s.compelling_questions.map(function (q) { return "<li>" + esc(q) + "</li>"; }).join("") + "</ul></details>";
    }
    html += "</section>";

    html += "<h2>Where CKLA reaches this standard <span class='faint'>(" + ints.length + ")</span></h2>";
    if (!ints.length) {
      html += "<div class='empty'><span class='badge badge-gap'>Gap</span><p style='margin-top:.6rem'>" +
        "No lesson in the indexed units reaches this standard. Plan standalone instruction, or check back " +
        "as more units are indexed.</p></div>";
    } else {
      html += intCardList(ints, { showLesson: true });
    }
    return html;
  }

  // ---------- search ----------

  function snippet(text, q) {
    var lower = text.toLowerCase();
    var i = lower.indexOf(q.toLowerCase());
    if (i < 0) return "";
    var start = Math.max(0, i - 60);
    var end = Math.min(text.length, i + q.length + 90);
    var frag = (start > 0 ? "&hellip;" : "") + esc(text.slice(start, end)) + (end < text.length ? "&hellip;" : "");
    // highlight all case-insensitive occurrences in the escaped fragment
    var eq = esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return frag.replace(new RegExp("(" + eq + ")", "gi"), "<mark>$1</mark>");
  }

  function viewSearch(q) {
    q = (q || "").trim();
    if (q.length < 2) return "<h1>Search</h1><p class='muted'>Type at least two characters in the search box above.</p>";
    var ql = q.toLowerCase();
    var results = [];

    lessons.forEach(function (l) {
      var hay = [l.title, (l.topics || []).join(" "), l.content_summary,
        (l.student_work || []).join(" "), (l.core_vocab || []).join(" ")].join(" || ");
      if (hay.toLowerCase().indexOf(ql) >= 0) {
        var u = unitById[l.unit_id];
        results.push({
          kicker: "Lesson · " + unitShort(u), url: lessonUrl(l),
          title: lessonLabel(l), snip: snippet(hay.replace(/ \|\| /g, " — "), q)
        });
      }
    });

    allStandards.forEach(function (s) {
      var hay = s.code + " " + s.text + " " + (s.strand_title || s.concept || "");
      if (hay.toLowerCase().indexOf(ql) >= 0) {
        results.push({
          kicker: s.system === "SS" ? "Social Studies standard" : "Computer Science standard",
          url: "#/standard/" + encodeURIComponent(s.code),
          title: s.code, snip: snippet(s.text, q) || esc(s.text.slice(0, 150))
        });
      }
    });

    activeInts(DB.integrations).forEach(function (r) {
      var hay = [r.teacher_idea, r.rationale || "", r.materials || ""].join(" — ");
      if (hay.toLowerCase().indexOf(ql) >= 0) {
        var l = lessonById[r.lesson_id];
        var u = l ? unitById[l.unit_id] : null;
        results.push({
          kicker: "Integration idea · " + r.standard_code + (r.status === "approved" ? " · approved" : " · draft"),
          url: lessonUrl(l),
          title: (u ? unitShort(u) + ", " : "") + (l ? lessonLabel(l) : r.lesson_id) + " &rarr; " + r.standard_code,
          snip: snippet(hay, q)
        });
      }
    });

    var html = "<h1>Search: &ldquo;" + esc(q) + "&rdquo;</h1>" +
      "<p class='muted'>" + results.length + " result" + (results.length === 1 ? "" : "s") + "</p>";
    if (!results.length) {
      html += "<div class='empty'>Nothing found. Try a topic (&ldquo;bison&rdquo;, &ldquo;maps&rdquo;), a standard code " +
        "(&ldquo;5.1.1&rdquo;, &ldquo;5.DA.2&rdquo;), or a practice (&ldquo;primary sources&rdquo;, &ldquo;data&rdquo;).</div>";
    } else {
      results.forEach(function (r) {
        html += "<div class='card'><div class='result-kicker'>" + r.kicker + "</div>" +
          "<h3><a href='" + r.url + "'>" + r.title + "</a></h3>" +
          (r.snip ? "<p class='small muted'>" + r.snip + "</p>" : "") + "</div>";
      });
    }
    return html;
  }

  // ---------- router ----------

  function notFound(msg) {
    return "<div class='empty'><p>" + esc(msg) + "</p><a class='btn' href='#/'>Back to home</a></div>";
  }

  function render() {
    var hash = location.hash || "#/";
    var parts = hash.replace(/^#\//, "").split("/");
    var route = parts[0] || "home";
    var arg = parts.slice(1).join("/");
    var app = document.getElementById("app");
    var nav = "home";

    if (route === "" || route === "home") {
      app.innerHTML = viewHome();
    } else if (route === "units") {
      app.innerHTML = viewUnits(); nav = "units";
    } else if (route === "unit") {
      app.innerHTML = viewUnit(arg); nav = "units";
    } else if (route === "lesson") {
      app.innerHTML = viewLesson(arg); nav = "units";
    } else if (route === "standards") {
      app.innerHTML = viewStandards(); nav = "standards";
    } else if (route === "standard") {
      app.innerHTML = viewStandard(decodeURIComponent(arg)); nav = "standards";
    } else if (route === "search") {
      app.innerHTML = viewSearch(decodeURIComponent(arg)); nav = "";
    } else {
      app.innerHTML = notFound("Page not found.");
    }

    document.querySelectorAll(".site-nav a").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-nav") === nav);
    });
    window.scrollTo(0, 0);
  }

  // filter buttons: re-render in place, preserving scroll position
  document.getElementById("app").addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest(".fbtn") : null;
    if (!btn) return;
    var group = btn.getAttribute("data-fgroup");
    var value = btn.getAttribute("data-fvalue");
    filters[group] = group === "minStrength" ? parseInt(value, 10) : value;
    var y = window.scrollY;
    render();
    window.scrollTo(0, y);
  });

  // light/dark theme toggle (default light; index.html applies the saved
  // choice before first paint)
  var themeBtn = document.getElementById("theme-toggle");
  function syncThemeBtn() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    themeBtn.innerHTML = dark ? "&#9788; Light" : "&#9789; Dark";
  }
  themeBtn.addEventListener("click", function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("osd-theme", next); } catch (e) {}
    syncThemeBtn();
  });
  syncThemeBtn();

  // A- / A / A+ text-size control (persisted like the theme)
  var sizeGroup = document.getElementById("text-size");
  function syncSizeBtns() {
    var cur = document.documentElement.getAttribute("data-textsize") || "compact";
    sizeGroup.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-size") === cur);
    });
  }
  sizeGroup.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest("button[data-size]") : null;
    if (!btn) return;
    var size = btn.getAttribute("data-size");
    document.documentElement.setAttribute("data-textsize", size);
    try { localStorage.setItem("osd-textsize", size); } catch (e2) {}
    syncSizeBtns();
  });
  syncSizeBtns();

  document.getElementById("search-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var q = document.getElementById("search-input").value;
    location.hash = "#/search/" + encodeURIComponent(q);
  });

  // open collapsed sections when printing so one-pagers are complete
  var closedForPrint = [];
  window.addEventListener("beforeprint", function () {
    closedForPrint = [];
    document.querySelectorAll("#app details:not([open])").forEach(function (d) {
      d.setAttribute("open", ""); closedForPrint.push(d);
    });
  });
  window.addEventListener("afterprint", function () {
    closedForPrint.forEach(function (d) { d.removeAttribute("open"); });
    closedForPrint = [];
  });

  window.addEventListener("hashchange", render);
  render();
})();
