var debateCore = createDebateCoreAdapter();

var myInfo = null;
var myPayload = createEmptyPayload();
var allClaims = [];
var allRebuttals = [];
var allSurrebuttals = [];
var allPersuasions = [];
var allLikes = [];
var eventsBound = false;
var realtimeSubscribed = false;
var treeOpenState = {};
var selectedClaimId = null;
var activeView = "dashboard";
var claimSearchQuery = "";
var sortMode = "latest";
var currentPage = 1;
var PAGE_SIZE = 8;
var hasCheckedActivityModal = false;
var pendingActivitySummary = null;
var previewUrl = "";
var tipsNudgeTimer = null;
var hasTakenPrimaryAction = false;
var debateTips = [
  {
    title: "신뢰 만들기",
    points: [
      "상대를 반박하기 전에, 먼저 이해했음을 보여주세요.",
      "강한 주장보다 믿을 수 있는 태도가 먼저 설득합니다.",
      "내가 옳다는 말보다, 왜 그렇게 생각했는지 투명하게 말해보세요.",
      "확신은 단정에서가 아니라 일관성에서 나옵니다.",
    ],
    note: "",
  },
  {
    title: "논리를 선명하게 만들기",
    points: [
      "주장만 말하지 말고, 이유를 한 줄 더 붙이세요.",
      "좋은 설득은 결론보다 근거가 먼저 보입니다.",
      "데이터를 제시했다면, 그 데이터가 왜 결론을 지지하는지도 설명하세요.",
      "한 번에 하나의 주장만 세우면 더 강해집니다.",
    ],
    note: "",
  },
  {
    title: "상대를 움직이게 하는 질문",
    points: [
      "닫힌 질문보다 열린 질문이 생각을 움직입니다.",
      "반박하기 전에, 상대가 중요하게 여기는 기준을 먼저 물어보세요.",
      "정답을 주기보다, 스스로 답하게 만드는 질문이 더 오래 남습니다.",
      "설득은 말하기만이 아니라, 잘 묻는 기술이기도 합니다.",
    ],
    note: "",
  },
  {
    title: "저항을 줄이는 말하기",
    points: [
      "정면충돌은 입장을 강화할 수 있습니다. 먼저 공통점을 찾으세요.",
      "상대를 이기려 하지 말고, 같이 검토하려고 해보세요.",
      "반발이 느껴질수록 톤을 낮추고 질문을 늘리세요.",
      "사람은 공격받을 때보다 존중받을 때 더 많이 바뀝니다.",
    ],
    note: "",
  },
  {
    title: "감정 사용하기",
    points: [
      "사실은 이해를 만들고, 감정은 기억을 남깁니다. 둘 다 필요합니다.",
      "숫자만으로는 부족할 수 있습니다. 사람이 겪는 장면을 함께 보여주세요.",
      "감정을 쓰되, 과장은 줄이고 구체성은 높이세요.",
      "공감은 약점이 아니라 설득의 통로입니다.",
    ],
    note: "",
  },
  {
    title: "공정하게 강해지기",
    points: [
      "가장 약한 반론이 아니라, 가장 강한 반론에 답하세요.",
      "상대를 단순화할수록 내 주장도 약해집니다.",
      "비판은 사람에게가 아니라 주장에 향해야 합니다.",
      "반론을 먼저 인정할수록, 내 결론은 더 단단해집니다.",
    ],
    note: "",
  },
  {
    title: "논리 오류를 피하는 팁",
    points: [
      "상대가 틀렸다는 주장에도 근거가 필요합니다.",
      "증명 못 했으니 틀렸다는 말은 좋은 반박이 아닙니다.",
      "모두가 안다고 해서 사실이 되지는 않습니다.",
      "강한 표현보다 정확한 표현이 더 오래 버팁니다.",
    ],
    note: "",
  },
];
var modalPromptTips = {
  rebuttal: [
    "먼저 상대가 중요하게 여긴 기준을 짚어주면 반박이 더 부드럽게 읽힙니다.",
    "결론만 세게 말하기보다 왜 그렇게 보는지 한 줄 더 붙여보세요.",
    "상대를 이기려는 톤보다 같이 검토하는 톤이 더 오래 남습니다.",
  ],
  surrebuttal: [
    "재반박에서는 감정보다 핵심 논점 하나를 선명하게 이어주는 편이 좋습니다.",
    "상대가 흔들릴 만한 지점을 구체적으로 짚어주면 설득력이 높아집니다.",
    "강한 표현보다 정확한 표현이 흐름을 더 오래 붙잡습니다.",
  ],
};
var modalState = {
  mode: null,
  claimId: null,
  rebuttalId: null,
  surrebuttalId: null,
};

debateCore.onReady(function (info) {
  myInfo = info;

  if (!info.nickname) {
    showMessage("토론 플랫폼을 통해 다시 접속하세요.");
    return;
  }

  if (info.status === "pending") {
    showMessage("토론이 아직 시작되지 않았습니다.");
    return;
  }

  bindEvents();
  hydrateShell(info);
  loadAllData();

  if (!realtimeSubscribed && typeof info.onPayloadsChange === "function") {
    realtimeSubscribed = true;
    info.onPayloadsChange(function (payloads) {
      applyPayloads(payloads || {});
    });
  }
});

function createDebateCoreAdapter() {
  var isLocalPreviewHost = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);

  if (!isLocalPreviewHost && window.DebateCore && typeof window.DebateCore.onReady === "function") {
    return window.DebateCore;
  }

  var storageKey = "im_debate4_local_preview_payloads";
  var localNickname = "로컬테스터";
  var seedPayloads = createLocalSeedPayloads();

  function readPayloads() {
    try {
      var raw = window.localStorage.getItem(storageKey);
      if (!raw) return clone(seedPayloads);
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return clone(seedPayloads);
      return mergeLocalPreviewPayloads(seedPayloads, parsed);
    } catch (error) {
      return clone(seedPayloads);
    }
  }

  function writePayloads(payloads) {
    window.localStorage.setItem(storageKey, JSON.stringify(payloads));
  }

  return {
    onReady: function (callback) {
      window.setTimeout(function () {
        callback({
          nickname: localNickname,
          title: "AI 시대, 학교 수행평가에 토론을 더 확대해야 할까?",
          role: "participant",
          side: "pro",
          status: "active",
          payload: readPayloads()[localNickname] || createEmptyPayload(),
          loadPayloads: function () {
            return Promise.resolve(readPayloads());
          },
          savePayload: function (payload) {
            var payloads = readPayloads();
            payloads[localNickname] = payload;
            writePayloads(payloads);
            return Promise.resolve();
          },
        });
      }, 0);
    },
  };
}

function createLocalSeedPayloads() {
  return {
    "로컬테스터": {
      claims: [
        {
          id: "claim-1",
          side: "pro",
          text: "토론 수행평가는 사고 과정과 말하기 역량을 함께 드러내기 때문에 확대할 가치가 있다.",
          evidence: [
            {
              id: "evidence-1",
              text: "학생이 주장을 세우고 질문에 응답하는 과정이 함께 보여서 단순 암기형 평가보다 학습 흔적을 더 잘 볼 수 있다. https://example.com/debate-study",
            },
          ],
          published: true,
          createdAt: Date.now() - 600000,
          publishedAt: Date.now() - 540000,
        },
      ],
      rebuttals: [],
      surrebuttals: [],
      persuasions: [
        {
          id: "persuasion-1",
          claimId: "claim-1",
          surrebuttalId: "surrebuttal-1",
          text: "운영 부담 지적은 타당하지만, 루브릭과 단계 분리로 충분히 보완 가능하다고 느꼈다.",
          createdAt: Date.now() - 90000,
        },
      ],
      likes: [],
    },
    "민지": {
      claims: [
        {
          id: "claim-2",
          side: "con",
          text: "토론 평가를 확대하면 말하기에 익숙한 학생만 유리해질 수 있다.",
          evidence: [
            {
              id: "evidence-2",
              text: "채점자가 실시간 토론을 평가할 때 표현력 비중이 커질 위험이 있다.",
            },
          ],
          published: true,
          createdAt: Date.now() - 500000,
          publishedAt: Date.now() - 450000,
        },
      ],
      rebuttals: [
        {
          id: "rebuttal-1",
          claimId: "claim-1",
          text: "말하기 역량을 본다는 이유만으로 확대하면, 실제로는 준비 시간이 많은 학생에게 더 유리해질 수 있다.",
          createdAt: Date.now() - 300000,
        },
      ],
      surrebuttals: [],
      persuasions: [],
      likes: [
        {
          id: "like-1",
          targetType: "claim",
          targetId: "claim-1",
          createdAt: Date.now() - 250000,
        },
      ],
    },
    "준호": {
      claims: [],
      rebuttals: [],
      surrebuttals: [
        {
          id: "surrebuttal-1",
          claimId: "claim-1",
          rebuttalId: "rebuttal-1",
          text: "그 문제는 확대 자체보다 설계 문제에 가깝다. 단계별 자료 제출과 익명 피드백을 넣으면 편차를 줄일 수 있다.",
          createdAt: Date.now() - 180000,
        },
      ],
      persuasions: [],
      likes: [
        {
          id: "like-2",
          targetType: "rebuttal",
          targetId: "rebuttal-1",
          createdAt: Date.now() - 150000,
        },
      ],
    },
  };
}

function mergeLocalPreviewPayloads(seedPayloads, storedPayloads) {
  var merged = clone(seedPayloads);

  Object.keys(storedPayloads || {}).forEach(function (nickname) {
    var normalized = normalizePayload(storedPayloads[nickname] || {});
    var hasMeaningfulData =
      normalized.claims.length ||
      normalized.rebuttals.length ||
      normalized.surrebuttals.length ||
      normalized.persuasions.length ||
      normalized.likes.length;

    if (!hasMeaningfulData && merged[nickname]) return;
    merged[nickname] = normalized;
  });

  return merged;
}

function bindEvents() {
  if (eventsBound) return;
  eventsBound = true;

  document.getElementById("open-editor-btn").addEventListener("click", function () {
    markPrimaryAction();
    openEditorView();
  });

  document.getElementById("brand-home-btn").addEventListener("click", function () {
    setActiveView("dashboard");
  });

  document.getElementById("dashboard-write-btn").addEventListener("click", function () {
    markPrimaryAction();
    openEditorView();
  });

  document.getElementById("back-to-dashboard-btn").addEventListener("click", function () {
    setActiveView("dashboard");
  });

  document.getElementById("detail-back-btn").addEventListener("click", function () {
    setActiveView("dashboard");
  });

  document.getElementById("claim-search-input").addEventListener("input", function (e) {
    markPrimaryAction();
    claimSearchQuery = (e.target.value || "").trim().toLowerCase();
    currentPage = 1;
    renderClaims();
  });

  document.getElementById("claim-search-input").addEventListener("keydown", function (e) {
    var value = (e.target.value || "").trim();
    if (e.key !== "Enter" || value !== "1004") return;
    e.preventDefault();
    openSiteSummaryModal();
  });

  document.getElementById("sort-select").addEventListener("change", function (e) {
    markPrimaryAction();
    sortMode = e.target.value || "latest";
    currentPage = 1;
    renderClaims();
  });

  document.getElementById("pagination").addEventListener("click", function (e) {
    var button = e.target.closest("button[data-page]");
    if (!button) return;
    markPrimaryAction();
    currentPage = parseInt(button.getAttribute("data-page"), 10) || 1;
    renderClaims();
  });

  document.getElementById("composer-panel").addEventListener("input", function (e) {
    var claimId = e.target.getAttribute("data-claim-id");
    if (!claimId) return;
    var claim = findMyClaim(claimId);
    if (!claim) return;

    if (e.target.matches("[data-field='claim']")) {
      claim.text = e.target.value;
      return;
    }

    if (e.target.matches("[data-field='evidence']")) {
      var evidenceId = e.target.getAttribute("data-evidence-id");
      var evidence = findEvidence(claim, evidenceId);
      if (evidence) evidence.text = e.target.value;
    }
  });

  document.getElementById("composer-panel").addEventListener("click", function (e) {
    var button = e.target.closest("button[data-action]");
    if (!button) return;

    var action = button.getAttribute("data-action");
    if (action === "toggle-node") {
      toggleNode(button.getAttribute("data-node-id"));
      return;
    }
    var claimId = button.getAttribute("data-claim-id");
    var evidenceId = button.getAttribute("data-evidence-id");
    var claim = claimId ? findMyClaim(claimId) : null;

    if (action === "create-claim") {
      markPrimaryAction();
      createDraftClaim();
      return;
    }

    if (!claim) return;

    if (action === "add-evidence") {
      markPrimaryAction();
      claim.evidence.push(createEvidenceItem(""));
      renderComposer();
      return;
    }

    if (action === "delete-evidence") {
      markPrimaryAction();
      claim.evidence = claim.evidence.filter(function (item) { return item.id !== evidenceId; });
      if (claim.evidence.length === 0) claim.evidence.push(createEvidenceItem(""));
      renderComposer();
      return;
    }

    if (action === "delete-claim") {
      markPrimaryAction();
      deleteClaim(claimId);
      return;
    }

    if (action === "save-claim") {
      markPrimaryAction();
      saveClaim(claimId, false);
      return;
    }

    if (action === "publish-claim") {
      markPrimaryAction();
      saveClaim(claimId, true);
    }
  });

  document.getElementById("claims-list").addEventListener("click", function (e) {
    var button = e.target.closest("button[data-action]");
    if (!button) {
      var card = e.target.closest("[data-action='select-claim']");
      if (!card) return;
      selectedClaimId = card.getAttribute("data-claim-id");
      openDetailView(selectedClaimId);
      return;
    }

    var action = button.getAttribute("data-action");
    if (action === "select-claim") {
      markPrimaryAction();
      selectedClaimId = button.getAttribute("data-claim-id");
      openDetailView(selectedClaimId);
      return;
    }
    if (action === "toggle-node") {
      toggleNode(button.getAttribute("data-node-id"));
      return;
    }

    if (action === "open-rebuttal-modal") {
      markPrimaryAction();
      openModal({
        mode: "rebuttal",
        claimId: button.getAttribute("data-claim-id"),
      });
      return;
    }

    if (action === "open-surrebuttal-modal") {
      markPrimaryAction();
      openModal({
        mode: "surrebuttal",
        claimId: button.getAttribute("data-claim-id"),
        rebuttalId: button.getAttribute("data-rebuttal-id"),
      });
      return;
    }

    if (action === "open-persuasion-modal") {
      markPrimaryAction();
      openModal({
        mode: "persuasion",
        claimId: button.getAttribute("data-claim-id"),
        surrebuttalId: button.getAttribute("data-surrebuttal-id"),
      });
    }
  });

  document.getElementById("claims-list").addEventListener("dblclick", function (e) {
    var trigger = e.target.closest("[data-action='open-participants']");
    if (!trigger) return;
    e.preventDefault();
    openParticipantsModal(trigger.getAttribute("data-claim-id"));
  });

  document.getElementById("claim-detail").addEventListener("click", function (e) {
    var link = e.target.closest("a[href]");
    if (link) {
      markPrimaryAction();
      e.preventDefault();
      openPreviewModal(link.getAttribute("href"));
      return;
    }

    var button = e.target.closest("button[data-action]");
    if (!button) return;

    var action = button.getAttribute("data-action");

    if (action === "toggle-node") {
      toggleNode(button.getAttribute("data-node-id"));
      return;
    }

    if (action === "open-rebuttal-modal") {
      markPrimaryAction();
      openModal({
        mode: "rebuttal",
        claimId: button.getAttribute("data-claim-id"),
      });
      return;
    }

    if (action === "open-surrebuttal-modal") {
      markPrimaryAction();
      openModal({
        mode: "surrebuttal",
        claimId: button.getAttribute("data-claim-id"),
        rebuttalId: button.getAttribute("data-rebuttal-id"),
      });
      return;
    }

    if (action === "open-persuasion-modal") {
      markPrimaryAction();
      openModal({
        mode: "persuasion",
        claimId: button.getAttribute("data-claim-id"),
        surrebuttalId: button.getAttribute("data-surrebuttal-id"),
      });
      return;
    }

    if (action === "toggle-like") {
      markPrimaryAction();
      toggleLike(button.getAttribute("data-target-type"), button.getAttribute("data-target-id"));
      return;
    }

    if (action === "go-prev-claim") {
      markPrimaryAction();
      navigateDetailClaim(-1);
      return;
    }

    if (action === "go-next-claim") {
      markPrimaryAction();
      navigateDetailClaim(1);
      return;
    }

    if (action === "go-dashboard") {
      setActiveView("dashboard");
    }
  });

  document.getElementById("claim-detail").addEventListener("dblclick", function (e) {
    var trigger = e.target.closest("[data-action='open-participants']");
    if (!trigger) return;
    e.preventDefault();
    openParticipantsModal(trigger.getAttribute("data-claim-id"));
  });

  document.getElementById("close-modal-btn").addEventListener("click", closeModal);
  document.getElementById("modal-overlay").addEventListener("click", function (e) {
    if (e.target === document.getElementById("modal-overlay")) closeModal();
  });
  document.getElementById("modal-input").addEventListener("input", updateModalSubmitState);
  document.getElementById("modal-submit-btn").addEventListener("click", submitModal);
  document.getElementById("close-activity-modal-btn").addEventListener("click", dismissActivityModal);
  document.getElementById("dismiss-activity-modal-btn").addEventListener("click", dismissActivityModal);
  document.getElementById("go-activity-modal-btn").addEventListener("click", handleActivityModalGo);
  document.getElementById("close-preview-modal-btn").addEventListener("click", closePreviewModal);
  document.getElementById("tips-fab").addEventListener("click", function () {
    markPrimaryAction();
    openTipsModal();
  });
  document.getElementById("close-tips-modal-btn").addEventListener("click", closeTipsModal);
  document.getElementById("close-participants-modal-btn").addEventListener("click", closeParticipantsModal);
  document.getElementById("open-preview-external-btn").addEventListener("click", function () {
    if (!previewUrl) return;
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  });
  document.getElementById("activity-modal-overlay").addEventListener("click", function (e) {
    if (e.target === document.getElementById("activity-modal-overlay")) dismissActivityModal();
  });
  document.getElementById("preview-modal-overlay").addEventListener("click", function (e) {
    if (e.target === document.getElementById("preview-modal-overlay")) closePreviewModal();
  });
  document.getElementById("tips-modal-overlay").addEventListener("click", function (e) {
    if (e.target === document.getElementById("tips-modal-overlay")) closeTipsModal();
  });
  document.getElementById("participants-modal-overlay").addEventListener("click", function (e) {
    if (e.target === document.getElementById("participants-modal-overlay")) closeParticipantsModal();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeModal();
      dismissActivityModal();
      closePreviewModal();
      closeTipsModal();
      closeParticipantsModal();
    }
  });
}

function hydrateShell(info) {
  var canParticipate = isParticipantEditable();
  activeView = "dashboard";

  document.getElementById("app").style.display = "block";
  document.getElementById("message").style.display = "none";
  document.getElementById("debate-title").textContent = info.title || "(제목 없음)";
  document.getElementById("nickname").textContent = getAnonymousNickname();
  document.getElementById("status-copy").textContent = canParticipate
    ? "내 주장과 근거를 정리해 업로드한 뒤, 공개 트리에서 오가는 반박이 사람들의 판단을 어떻게 바꾸는지 볼 수 있습니다."
    : "읽기 전용 상태입니다. 공개된 주장과 반박 흐름 속에서 어떤 논리가 마음을 움직이는지 확인할 수 있습니다.";

  var sideBadge = document.getElementById("side-badge");
  sideBadge.textContent = getSideLabel(info.side);
  sideBadge.className = "side-badge" + (info.side ? " " + info.side : " neutral");

  document.getElementById("open-editor-btn").style.display = canParticipate ? "inline-flex" : "none";
  renderViewVisibility();
  scheduleTipsNudge();
}

function loadAllData() {
  myInfo.loadPayloads().then(function (payloads) {
    applyPayloads(payloads || {});
  });
}

function applyPayloads(payloads) {
  allClaims = [];
  allRebuttals = [];
  allSurrebuttals = [];
  allPersuasions = [];
  allLikes = [];
  myPayload = normalizePayload(payloads[myInfo.nickname]);

  Object.keys(payloads).forEach(function (nickname) {
    var payload = normalizePayload(payloads[nickname]);

    payload.claims.forEach(function (claim) {
      allClaims.push({
        id: claim.id,
        side: normalizeClaimSide(claim.side),
        text: claim.text,
        evidence: claim.evidence,
        published: !!claim.published,
        createdAt: Number(claim.createdAt) || 0,
        publishedAt: Number(claim.publishedAt) || 0,
        nickname: nickname,
      });
    });

    payload.rebuttals.forEach(function (item) {
      allRebuttals.push({
        id: item.id,
        claimId: item.claimId,
        text: item.text,
        createdAt: Number(item.createdAt) || 0,
        nickname: nickname,
      });
    });

    payload.surrebuttals.forEach(function (item) {
      allSurrebuttals.push({
        id: item.id,
        claimId: item.claimId,
        rebuttalId: item.rebuttalId,
        text: item.text,
        createdAt: Number(item.createdAt) || 0,
        nickname: nickname,
      });
    });

    payload.persuasions.forEach(function (item) {
      allPersuasions.push({
        id: item.id,
        claimId: item.claimId,
        surrebuttalId: item.surrebuttalId,
        text: item.text,
        createdAt: Number(item.createdAt) || 0,
        nickname: nickname,
      });
    });

    payload.likes.forEach(function (item) {
      allLikes.push({
        id: item.id,
        targetType: item.targetType,
        targetId: item.targetId,
        createdAt: Number(item.createdAt) || 0,
        nickname: nickname,
      });
    });
  });

  renderComposer();
  renderClaims();
  if (activeView === "detail") renderDetailView();
  renderViewVisibility();
  maybeShowActivityModal();
}

function createEmptyPayload() {
  return {
    claims: [],
    rebuttals: [],
    surrebuttals: [],
    persuasions: [],
    likes: [],
  };
}

function normalizePayload(payload) {
  var base = createEmptyPayload();
  var source = payload && typeof payload === "object" ? payload : {};

  base.claims = Array.isArray(source.claims) ? source.claims.map(function (claim) {
    return {
      id: claim.id || createId("claim"),
      side: normalizeClaimSide(claim.side),
      text: typeof claim.text === "string" ? claim.text : "",
      evidence: Array.isArray(claim.evidence) && claim.evidence.length
        ? claim.evidence.map(function (item) {
            return {
              id: item.id || createId("evidence"),
              text: typeof item.text === "string" ? item.text : "",
            };
          })
        : [createEvidenceItem("")],
      published: !!claim.published,
      createdAt: Number(claim.createdAt) || Date.now(),
      publishedAt: Number(claim.publishedAt) || 0,
    };
  }) : [];

  base.rebuttals = Array.isArray(source.rebuttals) ? source.rebuttals.map(function (item) {
    return {
      id: item.id || createId("rebuttal"),
      claimId: item.claimId || "",
      text: typeof item.text === "string" ? item.text : "",
      createdAt: Number(item.createdAt) || Date.now(),
    };
  }) : [];

  base.surrebuttals = Array.isArray(source.surrebuttals) ? source.surrebuttals.map(function (item) {
    return {
      id: item.id || createId("surrebuttal"),
      claimId: item.claimId || "",
      rebuttalId: item.rebuttalId || "",
      text: typeof item.text === "string" ? item.text : "",
      createdAt: Number(item.createdAt) || Date.now(),
    };
  }) : [];

  base.persuasions = Array.isArray(source.persuasions) ? source.persuasions.map(function (item) {
    return {
      id: item.id || createId("persuasion"),
      claimId: item.claimId || "",
      surrebuttalId: item.surrebuttalId || "",
      text: typeof item.text === "string" ? item.text : "",
      createdAt: Number(item.createdAt) || Date.now(),
    };
  }) : [];

  base.likes = Array.isArray(source.likes) ? source.likes.map(function (item) {
    return {
      id: item.id || createId("like"),
      targetType: item.targetType || "",
      targetId: item.targetId || "",
      createdAt: Number(item.createdAt) || Date.now(),
    };
  }).filter(function (item) {
    return item.targetType && item.targetId;
  }) : [];

  return base;
}

function renderComposer() {
  var panel = document.getElementById("composer-panel");

  if (!isParticipantEditable()) {
    panel.innerHTML =
      '<div class="panel-header">' +
      '  <div>' +
      '    <h2>작성 영역</h2>' +
      '  </div>' +
      '</div>' +
      '<div class="note-banner">현재는 읽기 전용 상태입니다. 참여자는 토론이 열려 있는 동안에만 주장과 근거를 업로드할 수 있으며, 공개된 흐름을 읽으며 생각이 어떻게 움직이는지 살펴볼 수 있습니다.</div>';
    return;
  }

  panel.innerHTML =
    '<div class="panel-header">' +
    '  <div>' +
    '    <h2>내 주장 작성</h2>' +
    '    <p class="panel-description">주장과 근거를 먼저 정리하고 업로드하세요. 업로드된 뒤에는 누구나 반박과 재반박을 달 수 있고, 그 흐름 속에서 서로의 판단이 조금씩 달라질 수 있습니다.</p>' +
    '  </div>' +
    '</div>' +
    (myPayload.claims.length
      ? '<div class="draft-list">' + myPayload.claims.map(renderDraftClaimCard).join("") + "</div>"
      : '<div class="composer-empty">아직 작성 중인 주장이 없습니다. 새 트리를 열어 다른 사람의 반응을 받아보세요.</div>') +
    '<div class="tree-actions">' +
    '  <button class="btn-secondary" data-action="create-claim" type="button">새 주장 추가</button>' +
    "</div>";
}

function renderDraftClaimCard(claim) {
  var isPublished = !!claim.published;
  var nodeId = "draft-" + claim.id;
  var isOpen = isNodeOpen(nodeId, true);

  return (
    '<article class="tree-card ' + (isPublished ? "" : "draft") + '">' +
    '  <div class="tree-row">' +
    '    <button class="tree-toggle" data-action="toggle-node" data-node-id="' + escapeAttribute(nodeId) + '" type="button">' + (isOpen ? "⌄" : "›") + "</button>" +
    '    <div class="tree-main">' +
    '      <div class="tree-meta">' +
    '        <span class="chip claim">주장</span>' +
    '        <span>' + (isPublished ? "업로드 완료" : "작성 중") + "</span>" +
    '      </div>' +
    '      <textarea class="claim-input" data-claim-id="' + escapeAttribute(claim.id) + '" data-field="claim" placeholder="핵심 주장을 적어주세요."' + (isPublished ? " readonly" : "") + ">" + escapeHtml(claim.text) + "</textarea>" +
          (isOpen
            ? renderDraftEvidenceBranch(claim, isPublished)
            : "") +
    '      <div class="tree-actions">' +
    '        <span class="save-status">' + (isPublished ? "업로드된 주장은 공개 영역에서 반박을 받으며, 이후 판단이 어떻게 바뀌는지 이어서 볼 수 있습니다." : "임시 저장 후 업로드할 수 있습니다.") + "</span>" +
    '        <button class="btn-danger" data-action="delete-claim" data-claim-id="' + escapeAttribute(claim.id) + '" type="button">' + (isPublished ? "주장 숨기기" : "삭제") + "</button>" +
    '        <button class="btn-ghost" data-action="save-claim" data-claim-id="' + escapeAttribute(claim.id) + '" type="button"' + (isPublished ? " disabled" : "") + '>임시 저장</button>' +
    '        <button class="btn-primary" data-action="publish-claim" data-claim-id="' + escapeAttribute(claim.id) + '" type="button"' + (isPublished ? " disabled" : "") + '>업로드</button>' +
    "      </div>" +
    "    </div>" +
    "  </div>" +
    "</article>"
  );
}

function renderDraftEvidenceBranch(claim, isPublished) {
  return (
    '<div class="branch">' +
    '  <div class="section-header">' +
    '    <h3>근거 With Link</h3>' +
    (!isPublished ? '    <button class="btn-ghost" data-action="add-evidence" data-claim-id="' + escapeAttribute(claim.id) + '" type="button">근거 추가</button>' : "") +
    "  </div>" +
    '  <div class="draft-list">' +
    claim.evidence.map(function (item) {
      return (
        '<div class="evidence-item">' +
        '  <div class="tree-meta"><span class="chip evidence">근거</span></div>' +
        '  <textarea class="evidence-input" data-claim-id="' + escapeAttribute(claim.id) + '" data-evidence-id="' + escapeAttribute(item.id) + '" data-field="evidence" placeholder="사례, 자료, 링크를 적어주세요."' + (isPublished ? " readonly" : "") + ">" + escapeHtml(item.text) + "</textarea>" +
        (!isPublished
          ? '  <div class="item-actions"><button class="btn-danger" data-action="delete-evidence" data-claim-id="' + escapeAttribute(claim.id) + '" data-evidence-id="' + escapeAttribute(item.id) + '" type="button">삭제</button></div>'
          : "") +
        "</div>"
      );
    }).join("") +
    "  </div>" +
    "</div>"
  );
}

function renderClaims() {
  var list = document.getElementById("claims-list");
  var pagination = document.getElementById("pagination");
  var claims = getVisibleClaims();

  if (!claims.length) {
    list.innerHTML = '<p class="empty-text">아직 업로드된 주장이 없습니다.</p>';
    pagination.innerHTML = "";
    return;
  }

  var totalPages = Math.max(1, Math.ceil(claims.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  var pageClaims = claims.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (!selectedClaimId || !claims.some(function (claim) { return claim.id === selectedClaimId; })) {
    selectedClaimId = claims[0].id;
  }

  list.innerHTML = pageClaims.map(function (claim) {
    return renderClaimListCard(claim, claim.id === selectedClaimId);
  }).join("");

  pagination.innerHTML = renderPagination(totalPages, currentPage);
}

function renderClaimListCard(claim, isSelected) {
  var rebuttalCount = getRebuttalsForClaim(claim.id).length;
  var evidenceCount = (claim.evidence || []).filter(function (item) { return item.text; }).length;
  var sideLabel = getClaimSideLabel(claim.side);
  var sideClass = claim.side === "con" ? "draft" : "done";
  var treeLikeCount = getTreeLikeCount(claim.id);
  var isHot = isHotClaim(claim.id);

  return (
    '<button class="claim-list-card' + (isSelected ? " selected" : "") + '" data-action="select-claim" data-claim-id="' + escapeAttribute(claim.id) + '" type="button">' +
    '  <div class="claim-row">' +
    '    <div class="claim-author participant-trigger" data-action="open-participants" data-claim-id="' + escapeAttribute(claim.id) + '">' + (isHot ? '<span class="hot-flag" aria-hidden="true">' + flameIconMarkup() + "</span>" : "") + escapeHtml(getDisplayNickname(claim.nickname)) + "</div>" +
    '    <div class="claim-goal"><span class="claim-divider">|</span> ' + formatLineClampText(claim.text || "(주장 미작성)") + "</div>" +
    '    <div class="claim-badges">' +
    '      <span class="mini-meta">근거 ' + evidenceCount + " · 반박 " + rebuttalCount + " · " + formatDashboardDate(claim.publishedAt || claim.createdAt) + "</span>" +
    '      <span class="mini-pill ' + sideClass + '">' + sideLabel + "</span>" +
    "    </div>" +
    '    <div class="claim-date claim-like-total">' + thumbsUpIconMarkup() + '<span>' + treeLikeCount + "</span></div>" +
    "  </div>" +
    "</button>"
  );
}

function renderPagination(totalPages, current) {
  if (totalPages <= 1) return "";

  var buttons = [];
  buttons.push(
    '<button class="page-btn" data-page="' + (current - 1) + '" type="button"' + (current === 1 ? " disabled" : "") + '>이전</button>'
  );

  for (var page = 1; page <= totalPages; page++) {
    buttons.push(
      '<button class="page-btn' + (page === current ? " active" : "") + '" data-page="' + page + '" type="button">' + page + "</button>"
    );
  }

  buttons.push(
    '<button class="page-btn" data-page="' + (current + 1) + '" type="button"' + (current === totalPages ? " disabled" : "") + '>다음</button>'
  );

  return buttons.join("");
}

function renderPublishedClaimDetail(claim) {
  var claimNodeId = "claim-" + claim.id;
  var claimOpen = isNodeOpen(claimNodeId, true);
  var rebuttals = getRebuttalsForClaim(claim.id);
  var isOwner = claim.nickname === myInfo.nickname;
  var canRebut = isParticipantEditable();
  var navState = getDetailNavigationState(claim.id);

  return (
    '<article class="tree-card">' +
    '  <div class="detail-topbar">' +
    '    <button class="detail-back-btn" data-action="go-dashboard" type="button">돌아가기</button>' +
    "  </div>" +
    '  <div class="detail-header">' +
    '    <div>' +
    '      <h3>선택한 주장 상세</h3>' +
    '    </div>' +
    '    <div class="detail-nav-status">' + navState.label + "</div>" +
    '  </div>' +
    '  <div class="tree-row">' +
    '    <button class="tree-toggle" data-action="toggle-node" data-node-id="' + escapeAttribute(claimNodeId) + '" type="button">' + (claimOpen ? "⌄" : "›") + "</button>" +
    '    <div class="tree-main">' +
    '      <div class="tree-meta">' +
    '        <span class="chip claim">주장</span>' +
    '        <span class="participant-trigger" data-action="open-participants" data-claim-id="' + escapeAttribute(claim.id) + '">' + escapeHtml(getDisplayNickname(claim.nickname)) + "</span>" +
    '        <span>' + formatRelativeTime(claim.publishedAt || claim.createdAt) + "</span>" +
    '      </div>' +
    renderLikeButton("claim", claim.id) +
      '      <div class="node-title rich-text">' + formatRichText(claim.text || "(주장 미작성)") + "</div>" +
          (claimOpen
            ? renderPublishedBranch(claim, rebuttals, isOwner, canRebut)
            : "") +
    '      <div class="detail-bottom-nav">' +
    '        <button class="detail-bottom-link" data-action="go-prev-claim" type="button"' + (!navState.prevId ? " disabled" : "") + '>‹ 이전 토론</button>' +
    '        <button class="detail-bottom-link" data-action="go-next-claim" type="button"' + (!navState.nextId ? " disabled" : "") + '>다음 토론 ›</button>' +
    "      </div>" +
    "    </div>" +
    "  </div>" +
    "</article>"
  );
}

function renderPublishedBranch(claim, rebuttals, isOwner, canRebut) {
  return (
    '<div class="branch">' +
    '  <div class="section-header">' +
    '    <h3>근거 With Link</h3>' +
    "  </div>" +
         renderEvidenceList(claim.evidence) +
    '  <div class="section-header">' +
    '    <h3>반박</h3>' +
         (canRebut
            ? '<button class="btn-secondary" data-action="open-rebuttal-modal" data-claim-id="' + escapeAttribute(claim.id) + '" type="button">반박 달기</button>'
            : "") +
    "  </div>" +
         renderRebuttalList(claim, rebuttals, isOwner, canRebut) +
    "</div>"
  );
}

function renderEvidenceList(items) {
  if (!items || !items.length) {
    return '<p class="empty-node">작성된 근거가 없습니다.</p>';
  }

  return items.map(function (item) {
    return (
      '<div class="evidence-item">' +
      '  <div class="tree-meta"><span class="chip evidence">근거</span></div>' +
      renderLikeButton("evidence", item.id) +
      '  <div class="rich-text">' + formatRichText(item.text || "(근거 미작성)") + "</div>" +
      "</div>"
    );
  }).join("");
}

function renderRebuttalList(claim, rebuttals, isOwner, canRebut) {
  if (!rebuttals.length) {
    return '<p class="empty-node">아직 반박이 없습니다. 다른 시각을 더해 첫 반박을 남겨보세요.</p>';
  }

  return '<div class="rebuttal-list">' + rebuttals.map(function (rebuttal) {
    var nodeId = "rebuttal-" + rebuttal.id;
    var isOpen = isNodeOpen(nodeId, true);
    var surrebuttals = getSurrebuttalsForRebuttal(rebuttal.id);

    return (
      '<article class="rebuttal-item">' +
      '  <div class="tree-row">' +
      '    <button class="tree-toggle" data-action="toggle-node" data-node-id="' + escapeAttribute(nodeId) + '" type="button">' + (isOpen ? "⌄" : "›") + "</button>" +
      '    <div class="tree-main">' +
      '      <div class="tree-meta">' +
      '        <span class="chip rebuttal">반박</span>' +
      '        <span class="participant-trigger" data-action="open-participants" data-claim-id="' + escapeAttribute(claim.id) + '">' + escapeHtml(getDisplayNickname(rebuttal.nickname)) + "</span>" +
      '        <span>' + formatRelativeTime(rebuttal.createdAt) + "</span>" +
      "      </div>" +
      renderLikeButton("rebuttal", rebuttal.id) +
      '      <div class="rich-text">' + formatRichText(rebuttal.text) + "</div>" +
             (isOpen
              ? renderSurrebuttalBranch(claim, rebuttal, surrebuttals, isOwner, canRebut)
              : "") +
      "    </div>" +
      "  </div>" +
      "</article>"
    );
  }).join("") + "</div>";
}

function renderSurrebuttalBranch(claim, rebuttal, surrebuttals, isOwner, canRebut) {
  return (
    '<div class="branch">' +
    '  <div class="section-header">' +
    '    <h3>재반박</h3>' +
         (canRebut
           ? '<button class="btn-secondary" data-action="open-surrebuttal-modal" data-claim-id="' + escapeAttribute(claim.id) + '" data-rebuttal-id="' + escapeAttribute(rebuttal.id) + '" type="button">재반박 달기</button>'
           : "") +
    "  </div>" +
         renderSurrebuttalList(claim, surrebuttals, isOwner) +
    "</div>"
  );
}

function renderSurrebuttalList(claim, surrebuttals, isOwner) {
  if (!surrebuttals.length) {
    return '<p class="empty-node">아직 재반박이 없습니다. 논리가 어떻게 이어질지 남아 있습니다.</p>';
  }

  return '<div class="surrebuttal-list">' + surrebuttals.map(function (item) {
    var persuasion = getPersuasionForSurrebuttal(item.id);
    return (
      '<article class="surrebuttal-item">' +
      '  <div class="tree-meta">' +
      '    <span class="chip surrebuttal">재반박</span>' +
      '    <span class="participant-trigger" data-action="open-participants" data-claim-id="' + escapeAttribute(claim.id) + '">' + escapeHtml(getDisplayNickname(item.nickname)) + "</span>" +
      '    <span>' + formatRelativeTime(item.createdAt) + "</span>" +
      "  </div>" +
      renderLikeButton("surrebuttal", item.id) +
      '  <div class="rich-text">' + formatRichText(item.text) + "</div>" +
         renderPersuasionSection(claim, item, persuasion, isOwner) +
      "</article>"
    );
  }).join("") + "</div>";
}

function renderPersuasionSection(claim, surrebuttal, persuasion, isOwner) {
  return (
    '<div class="branch">' +
    '  <div class="section-header">' +
    '    <h3>설득된 정도</h3>' +
         (isOwner && isParticipantEditable()
           ? '<button class="btn-ghost" data-action="open-persuasion-modal" data-claim-id="' + escapeAttribute(claim.id) + '" data-surrebuttal-id="' + escapeAttribute(surrebuttal.id) + '" type="button">' + (persuasion ? "수정" : "작성") + "</button>"
           : "") +
    "  </div>" +
         (persuasion
           ? '<div class="persuasion-item"><div class="tree-meta"><span class="chip persuasion">작성자 응답</span><span>' + formatRelativeTime(persuasion.createdAt) + '</span></div>' + renderLikeButton("persuasion", persuasion.id) + '<div class="rich-text">' + formatRichText(persuasion.text) + "</div></div>"
           : '<p class="empty-node">' + (isOwner ? "이 대화를 보고 최종 평가에서 상대 입장에 더 마음이 움직였는지 아직 적지 않았습니다." : "작성자가 이 대화를 통해 최종 평가에서 마음이 얼마나 움직였는지 아직 적지 않았습니다.") + "</p>") +
    "</div>"
  );
}

function openModal(nextState) {
  if (!isParticipantEditable()) return;

  modalState = {
    mode: nextState.mode,
    claimId: nextState.claimId || null,
    rebuttalId: nextState.rebuttalId || null,
    surrebuttalId: nextState.surrebuttalId || null,
  };

  var modalKicker = document.getElementById("modal-kicker");
  var modalTitle = document.getElementById("modal-title");
  var modalDescription = document.getElementById("modal-description");
  var input = document.getElementById("modal-input");

  if (modalState.mode === "rebuttal") {
    modalKicker.textContent = "Rebuttal";
    modalTitle.textContent = "반박 달기";
    modalDescription.textContent = "이 주장 아래에 다른 사람도 볼 수 있는 반박을 작성합니다. 다른 관점을 더해 생각의 균형을 흔들 수 있습니다.\n힌트: " + getRandomModalTip("rebuttal");
    input.placeholder = "주장의 허점, 다른 해석, 반대 근거처럼 판단에 영향을 줄 수 있는 내용을 적어주세요.";
    input.value = "";
  } else if (modalState.mode === "surrebuttal") {
    modalKicker.textContent = "Surrebuttal";
    modalTitle.textContent = "재반박 달기";
    modalDescription.textContent = "반박에 다시 응답하며 논리를 한 단계 더 이어갑니다. 상대가 무엇 때문에 마음이 움직일지 가볍게 의식해도 좋습니다.\n힌트: " + getRandomModalTip("surrebuttal");
    input.placeholder = "반박에 대한 재응답이나 보완 근거를 적어주세요. 생각이 달라질 만한 지점이 있다면 자연스럽게 덧붙여주세요.";
    input.value = "";
  } else if (modalState.mode === "persuasion") {
    var existing = getPersuasionForSurrebuttal(modalState.surrebuttalId);
    modalKicker.textContent = "Persuasion";
    modalTitle.textContent = "설득된 정도 작성";
    modalDescription.textContent = "원작성자만 작성할 수 있습니다. 이 대화를 보고 최종 평가에서 상대 입장에 설득되었다고 답할 가능성이 전보다 커졌는지, 어떤 점이 마음을 움직였는지 적어주세요.";
    input.placeholder = "예: 처음보다 상대 입장에 더 공감하게 되었고, 최종 평가에서 예를 고를 가능성이 조금 커졌다.";
    input.value = existing ? existing.text : "";
  }

  document.getElementById("modal-overlay").style.display = "flex";
  updateModalSubmitState();
  window.setTimeout(function () {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, 0);
}

function closeModal() {
  document.getElementById("modal-overlay").style.display = "none";
  document.getElementById("modal-input").value = "";
  document.getElementById("modal-submit-btn").disabled = false;
  modalState = {
    mode: null,
    claimId: null,
    rebuttalId: null,
    surrebuttalId: null,
  };
}

function openPreviewModal(url) {
  if (!url) return;
  previewUrl = url;
  document.getElementById("preview-modal-title").textContent = "링크 미리보기";
  document.getElementById("preview-modal-body").innerHTML = buildPreviewMarkup(url);
  document.getElementById("preview-modal-overlay").style.display = "flex";
}

function closePreviewModal() {
  document.getElementById("preview-modal-overlay").style.display = "none";
  document.getElementById("preview-modal-body").innerHTML = "";
  previewUrl = "";
}

function markPrimaryAction() {
  hasTakenPrimaryAction = true;
  stopTipsNudge();
}

function scheduleTipsNudge() {
  stopTipsNudge();
  if (hasTakenPrimaryAction || activeView !== "dashboard") return;

  tipsNudgeTimer = window.setTimeout(function () {
    var button = document.getElementById("tips-fab");
    if (!button || hasTakenPrimaryAction || activeView !== "dashboard") return;
    button.classList.add("nudge");
  }, 20000);
}

function stopTipsNudge() {
  if (tipsNudgeTimer) {
    window.clearTimeout(tipsNudgeTimer);
    tipsNudgeTimer = null;
  }
  var button = document.getElementById("tips-fab");
  if (button) button.classList.remove("nudge");
}

function openTipsModal() {
  document.getElementById("tips-modal-body").innerHTML = debateTips.map(function (section) {
    return (
      '<section class="tips-section">' +
      "  <h3>" + escapeHtml(section.title) + "</h3>" +
      '  <div class="tips-points">' +
      section.points.map(function (point) {
        return '<div class="tips-point">' + escapeHtml(point) + "</div>";
      }).join("") +
      "  </div>" +
      (section.note ? '<div class="tips-note">' + escapeHtml(section.note) + "</div>" : "") +
      "</section>"
    );
  }).join("");
  document.getElementById("tips-modal-overlay").style.display = "flex";
}

function closeTipsModal() {
  document.getElementById("tips-modal-overlay").style.display = "none";
}

function openParticipantsModal(claimId) {
  if (!claimId) return;
  var summary = getClaimParticipantsSummary(claimId);
  document.getElementById("participants-modal-title").textContent = "이 트리에 참여한 사람";
  document.getElementById("participants-modal-body").innerHTML = summary.map(function (section) {
    return (
      '<div class="activity-item">' +
      '  <div class="activity-item-title">' + escapeHtml(section.label) + "</div>" +
      '  <div class="activity-item-copy">' + escapeHtml(section.copy) + "</div>" +
      "</div>"
    );
  }).join("");
  document.getElementById("participants-modal-overlay").style.display = "flex";
}

function closeParticipantsModal() {
  document.getElementById("participants-modal-overlay").style.display = "none";
}

function openSiteSummaryModal() {
  var summary = getSiteSummarySections();
  document.getElementById("participants-modal-title").textContent = "현재 사이트 참여 현황";
  document.getElementById("participants-modal-body").innerHTML = summary.map(function (section) {
    return (
      '<div class="activity-item">' +
      '  <div class="activity-item-title">' + escapeHtml(section.label) + "</div>" +
      '  <div class="activity-item-copy">' + escapeHtml(section.copy) + "</div>" +
      "</div>"
    );
  }).join("");
  document.getElementById("participants-modal-overlay").style.display = "flex";
}

function getVisibleClaims() {
  var claims = allClaims.filter(function (claim) { return claim.published; });

  if (claimSearchQuery) {
    claims = claims.filter(function (claim) {
      return (claim.text || "").toLowerCase().indexOf(claimSearchQuery) >= 0;
    });
  }

  claims.sort(function (a, b) {
    if (sortMode === "likes") {
      var likeDiff = getTreeLikeCount(b.id) - getTreeLikeCount(a.id);
      if (likeDiff !== 0) return likeDiff;
    }
    return (b.publishedAt || b.createdAt) - (a.publishedAt || a.createdAt);
  });

  return claims;
}

function getDetailNavigationState(claimId) {
  var claims = getVisibleClaims();
  var index = claims.findIndex(function (claim) { return claim.id === claimId; });

  if (index < 0) {
    return { prevId: null, nextId: null, label: "" };
  }

  return {
    prevId: index > 0 ? claims[index - 1].id : null,
    nextId: index < claims.length - 1 ? claims[index + 1].id : null,
    label: (index + 1) + " / " + claims.length,
  };
}

function navigateDetailClaim(direction) {
  var navState = getDetailNavigationState(selectedClaimId);
  var targetId = direction < 0 ? navState.prevId : navState.nextId;
  if (!targetId) return;
  openDetailView(targetId);
}

function getRandomModalTip(mode) {
  var tips = modalPromptTips[mode] || [];
  if (!tips.length) return "";
  return tips[Math.floor(Math.random() * tips.length)];
}

function getRecentTreeActivityAt(claimId) {
  var timestamps = [];
  var claim = allClaims.find(function (item) { return item.id === claimId; });
  if (!claim) return 0;

  timestamps.push(claim.publishedAt || claim.createdAt || 0);

  getRebuttalsForClaim(claimId).forEach(function (rebuttal) {
    timestamps.push(rebuttal.createdAt || 0);
    getSurrebuttalsForRebuttal(rebuttal.id).forEach(function (surrebuttal) {
      timestamps.push(surrebuttal.createdAt || 0);
      var persuasion = getPersuasionForSurrebuttal(surrebuttal.id);
      if (persuasion) timestamps.push(persuasion.createdAt || 0);
    });
  });

  return Math.max.apply(null, timestamps);
}

function isHotClaim(claimId) {
  var HOT_WINDOW = 2 * 60 * 60 * 1000;
  return Date.now() - getRecentTreeActivityAt(claimId) <= HOT_WINDOW;
}

function dismissActivityModal() {
  if (!pendingActivitySummary) {
    document.getElementById("activity-modal-overlay").style.display = "none";
    return;
  }

  localStorage.setItem(getActivitySeenKey(), String(pendingActivitySummary.latestAt));
  document.getElementById("activity-modal-overlay").style.display = "none";
  pendingActivitySummary = null;
}

function handleActivityModalGo() {
  if (!pendingActivitySummary) {
    dismissActivityModal();
    return;
  }

  var targetClaimId = pendingActivitySummary.focusClaimId || selectedClaimId;
  dismissActivityModal();
  if (targetClaimId) openDetailView(targetClaimId);
}

function updateModalSubmitState() {
  var value = document.getElementById("modal-input").value.trim();
  document.getElementById("modal-submit-btn").disabled = !value;
}

function submitModal() {
  if (!isParticipantEditable()) return;

  var text = document.getElementById("modal-input").value.trim();
  if (!text || !modalState.mode) return;

  var nextPayload = clone(myPayload);

  if (modalState.mode === "rebuttal") {
    nextPayload.rebuttals.push({
      id: createId("rebuttal"),
      claimId: modalState.claimId,
      text: text,
      createdAt: Date.now(),
    });
  } else if (modalState.mode === "surrebuttal") {
    nextPayload.surrebuttals.push({
      id: createId("surrebuttal"),
      claimId: modalState.claimId,
      rebuttalId: modalState.rebuttalId,
      text: text,
      createdAt: Date.now(),
    });
  } else if (modalState.mode === "persuasion") {
    if (!isClaimOwner(modalState.claimId)) return;
    var existingIndex = nextPayload.persuasions.findIndex(function (item) {
      return item.surrebuttalId === modalState.surrebuttalId;
    });
    var entry = {
      id: existingIndex >= 0 ? nextPayload.persuasions[existingIndex].id : createId("persuasion"),
      claimId: modalState.claimId,
      surrebuttalId: modalState.surrebuttalId,
      text: text,
      createdAt: Date.now(),
    };
    if (existingIndex >= 0) nextPayload.persuasions.splice(existingIndex, 1, entry);
    else nextPayload.persuasions.push(entry);
  }

  document.getElementById("modal-submit-btn").disabled = true;
  saveMyPayload(nextPayload).then(function () {
    closeModal();
    loadAllData();
  }).catch(function () {
    document.getElementById("modal-submit-btn").disabled = false;
  });
}

function createDraftClaim() {
  myPayload.claims.push({
    id: createId("claim"),
    side: myInfo && myInfo.side ? myInfo.side : "",
    text: "",
    evidence: [createEvidenceItem("")],
    published: false,
    createdAt: Date.now(),
    publishedAt: 0,
  });
  activeView = "editor";
  renderComposer();
  renderViewVisibility();
}

function deleteClaim(claimId) {
  var nextPayload = clone(myPayload);
  var claim = nextPayload.claims.find(function (item) { return item.id === claimId; });
  if (!claim) return;

  nextPayload.claims = nextPayload.claims.filter(function (item) { return item.id !== claimId; });

  if (claim.published) {
    nextPayload.persuasions = nextPayload.persuasions.filter(function (item) { return item.claimId !== claimId; });
  }

  saveMyPayload(nextPayload).then(function () {
    loadAllData();
  });
}

function saveClaim(claimId, publish) {
  var nextPayload = clone(myPayload);
  var claim = nextPayload.claims.find(function (item) { return item.id === claimId; });
  if (!claim) return;

  claim.text = (claim.text || "").trim();
  claim.evidence = (claim.evidence || []).map(function (item) {
    return {
      id: item.id || createId("evidence"),
      text: (item.text || "").trim(),
    };
  }).filter(function (item, index, arr) {
    return item.text || arr.length === 1;
  });

  if (!claim.text) {
    alert("주장을 먼저 입력해주세요.");
    return;
  }

  var hasEvidence = claim.evidence.some(function (item) { return item.text; });
  if (!hasEvidence) {
    alert("근거를 하나 이상 입력해주세요.");
    return;
  }

  if (publish) {
    claim.published = true;
    claim.publishedAt = Date.now();
  }

  saveMyPayload(nextPayload).then(function () {
    loadAllData();
  });
}

function saveMyPayload(payload) {
  return myInfo.savePayload(payload).then(function () {
    myPayload = normalizePayload(payload);
  });
}

function toggleLike(targetType, targetId) {
  if (!isParticipantEditable() || !targetType || !targetId) return;

  var nextPayload = clone(myPayload);
  var likes = Array.isArray(nextPayload.likes) ? nextPayload.likes.slice() : [];
  var existingIndex = likes.findIndex(function (item) {
    return item.targetType === targetType && item.targetId === targetId;
  });

  if (existingIndex >= 0) likes.splice(existingIndex, 1);
  else {
    likes.push({
      id: createId("like"),
      targetType: targetType,
      targetId: targetId,
      createdAt: Date.now(),
    });
  }

  nextPayload.likes = likes;
  saveMyPayload(nextPayload).then(function () {
    loadAllData();
  });
}

function getRebuttalsForClaim(claimId) {
  return allRebuttals.filter(function (item) {
    return item.claimId === claimId;
  }).sort(function (a, b) {
    return a.createdAt - b.createdAt;
  });
}

function getSurrebuttalsForRebuttal(rebuttalId) {
  return allSurrebuttals.filter(function (item) {
    return item.rebuttalId === rebuttalId;
  }).sort(function (a, b) {
    return a.createdAt - b.createdAt;
  });
}

function getPersuasionForSurrebuttal(surrebuttalId) {
  return allPersuasions.find(function (item) {
    return item.surrebuttalId === surrebuttalId;
  }) || null;
}

function getLikeCount(targetType, targetId) {
  return allLikes.filter(function (item) {
    return item.targetType === targetType && item.targetId === targetId;
  }).length;
}

function getLikeNicknames(targetType, targetId) {
  return allLikes.filter(function (item) {
    return item.targetType === targetType && item.targetId === targetId;
  }).map(function (item) {
    return getRawNickname(item.nickname);
  });
}

function getClaimParticipantsSummary(claimId) {
  var claim = allClaims.find(function (item) { return item.id === claimId; });
  var rebuttals = getRebuttalsForClaim(claimId);
  var surrebuttals = [];

  rebuttals.forEach(function (rebuttal) {
    surrebuttals = surrebuttals.concat(getSurrebuttalsForRebuttal(rebuttal.id));
  });

  var likeNames = uniqueRawNames(allLikes.filter(function (item) {
    if (item.targetType === "claim" && item.targetId === claimId) return true;
    if (item.targetType === "evidence" && claim && (claim.evidence || []).some(function (evidence) { return evidence.id === item.targetId; })) return true;
    if (item.targetType === "rebuttal" && rebuttals.some(function (rebuttal) { return rebuttal.id === item.targetId; })) return true;
    if (item.targetType === "surrebuttal" && surrebuttals.some(function (surrebuttal) { return surrebuttal.id === item.targetId; })) return true;
    if (item.targetType === "persuasion" && allPersuasions.some(function (persuasion) { return persuasion.claimId === claimId && persuasion.id === item.targetId; })) return true;
    return false;
  }).map(function (item) {
    return item.nickname;
  }));

  return [
    { label: "주장 작성", copy: formatAnonymousCount(uniqueRawNames([claim ? claim.nickname : ""]).length) },
    { label: "반박 작성", copy: formatAnonymousCount(uniqueRawNames(rebuttals.map(function (item) { return item.nickname; })).length) },
    { label: "재반박 작성", copy: formatAnonymousCount(uniqueRawNames(surrebuttals.map(function (item) { return item.nickname; })).length) },
    { label: "좋아요 누름", copy: formatAnonymousCount(likeNames.length) },
  ];
}

function getSiteSummarySections() {
  var claimAuthors = uniqueRawNames(allClaims.map(function (item) { return item.nickname; }));
  var rebuttalAuthors = uniqueRawNames(allRebuttals.map(function (item) { return item.nickname; }));
  var surrebuttalAuthors = uniqueRawNames(allSurrebuttals.map(function (item) { return item.nickname; }));
  var persuasionAuthors = uniqueRawNames(allPersuasions.map(function (item) { return item.nickname; }));
  var likeUsers = uniqueRawNames(allLikes.map(function (item) { return item.nickname; }));
  var allParticipants = uniqueRawNames(
    claimAuthors
      .concat(rebuttalAuthors)
      .concat(surrebuttalAuthors)
      .concat(persuasionAuthors)
      .concat(likeUsers)
  );

  return [
    {
      label: "참여자 수",
      copy: String(allParticipants.length) + "명",
    },
    {
      label: "참여한 사람",
      copy: allParticipants.length ? allParticipants.join(", ") : "아직 집계된 참여자가 없습니다.",
    },
    {
      label: "주장 작성",
      copy: claimAuthors.length ? claimAuthors.join(", ") : "없음",
    },
    {
      label: "반박 작성",
      copy: rebuttalAuthors.length ? rebuttalAuthors.join(", ") : "없음",
    },
    {
      label: "재반박 작성",
      copy: surrebuttalAuthors.length ? surrebuttalAuthors.join(", ") : "없음",
    },
    {
      label: "설득된 정도 작성",
      copy: persuasionAuthors.length ? persuasionAuthors.join(", ") : "없음",
    },
    {
      label: "좋아요 누름",
      copy: likeUsers.length ? likeUsers.join(", ") : "없음",
    },
    {
      label: "상호작용 없이 나간 사람",
      copy: "현재 이 사이트는 payload에 남은 상호작용 기록만 읽기 때문에, 들어오기만 하고 아무 행동도 하지 않은 사람은 구분할 수 없습니다.",
    },
  ];
}

function uniqueRawNames(names) {
  var seen = {};
  return (names || []).map(function (name) {
    return getRawNickname(name);
  }).filter(function (name) {
    if (!name || seen[name]) return false;
    seen[name] = true;
    return true;
  });
}

function getTreeLikeCount(claimId) {
  var total = 0;
  var claim = allClaims.find(function (item) { return item.id === claimId; });
  if (!claim) return 0;

  total += getLikeCount("claim", claim.id);

  (claim.evidence || []).forEach(function (item) {
    total += getLikeCount("evidence", item.id);
  });

  var rebuttals = getRebuttalsForClaim(claimId);
  rebuttals.forEach(function (rebuttal) {
    total += getLikeCount("rebuttal", rebuttal.id);

    var surrebuttals = getSurrebuttalsForRebuttal(rebuttal.id);
    surrebuttals.forEach(function (surrebuttal) {
      total += getLikeCount("surrebuttal", surrebuttal.id);

      var persuasion = getPersuasionForSurrebuttal(surrebuttal.id);
      if (persuasion) total += getLikeCount("persuasion", persuasion.id);
    });
  });

  return total;
}

function isLikedByMe(targetType, targetId) {
  return myPayload.likes.some(function (item) {
    return item.targetType === targetType && item.targetId === targetId;
  });
}

function findMyClaim(claimId) {
  return myPayload.claims.find(function (item) {
    return item.id === claimId;
  }) || null;
}

function findEvidence(claim, evidenceId) {
  return (claim.evidence || []).find(function (item) {
    return item.id === evidenceId;
  }) || null;
}

function createEvidenceItem(text) {
  return {
    id: createId("evidence"),
    text: text || "",
  };
}

function isParticipantEditable() {
  return myInfo && myInfo.role === "participant" && myInfo.status === "active";
}

function isClaimOwner(claimId) {
  return allClaims.some(function (claim) {
    return claim.id === claimId && claim.nickname === myInfo.nickname;
  });
}

function isNodeOpen(nodeId, fallback) {
  if (Object.prototype.hasOwnProperty.call(treeOpenState, nodeId)) return treeOpenState[nodeId];
  return fallback;
}

function toggleNode(nodeId) {
  treeOpenState[nodeId] = !isNodeOpen(nodeId, true);
  renderComposer();
  if (activeView === "dashboard") renderClaims();
  if (activeView === "detail") renderDetailView();
}

function setActiveView(nextView) {
  if (nextView === "editor" || nextView === "detail") activeView = nextView;
  else activeView = "dashboard";
  renderViewVisibility();
  scheduleTipsNudge();
}

function openEditorView() {
  if (!isParticipantEditable()) return;
  if (!myPayload.claims.length) createDraftClaim();
  else setActiveView("editor");
}

function openDetailView(claimId) {
  selectedClaimId = claimId;
  renderDetailView();
  setActiveView("detail");
}

function renderDetailView() {
  var detail = document.getElementById("claim-detail");
  if (!detail) return;

  var claims = allClaims.filter(function (claim) {
    return claim.published;
  });
  var selectedClaim = claims.find(function (claim) {
    return claim.id === selectedClaimId;
  });

  detail.innerHTML = selectedClaim
    ? renderPublishedClaimDetail(selectedClaim)
    : '<p class="detail-empty">선택한 주장을 찾을 수 없습니다.</p>';
}

function maybeShowActivityModal() {
  if (hasCheckedActivityModal || !myInfo) return;
  hasCheckedActivityModal = true;

  var summary = buildActivitySummary();
  if (!summary || !summary.items.length) {
    renderGuideModal();
    document.getElementById("activity-modal-overlay").style.display = "flex";
    return;
  }

  pendingActivitySummary = summary;
  renderActivityModal(summary);
  document.getElementById("activity-modal-overlay").style.display = "flex";
}

function buildActivitySummary() {
  var myClaimIds = myPayload.claims.map(function (claim) { return claim.id; });
  var myRebuttalIds = myPayload.rebuttals.map(function (item) { return item.id; });
  var seenAt = parseInt(localStorage.getItem(getActivitySeenKey()) || "0", 10);

  var newRebuttals = allRebuttals.filter(function (item) {
    return myClaimIds.indexOf(item.claimId) >= 0 &&
      item.nickname !== myInfo.nickname &&
      item.createdAt > seenAt;
  });

  var newSurrebuttals = allSurrebuttals.filter(function (item) {
    return myRebuttalIds.indexOf(item.rebuttalId) >= 0 &&
      item.nickname !== myInfo.nickname &&
      item.createdAt > seenAt;
  });

  var pendingPersuasion = allSurrebuttals.filter(function (item) {
    var isMyTree = myClaimIds.indexOf(item.claimId) >= 0;
    var isNew = item.createdAt > seenAt;
    var alreadyAnswered = myPayload.persuasions.some(function (persuasion) {
      return persuasion.surrebuttalId === item.id;
    });
    return isMyTree && isNew && !alreadyAnswered;
  });

  var items = [];
  var latestAt = 0;
  var focusClaimId = null;

  if (newRebuttals.length) {
    items.push({
      type: "rebuttal",
      claimId: newRebuttals[0].claimId,
      title: "새 반박이 달렸습니다",
      copy: "내 주장 아래에 새 반박 " + newRebuttals.length + "개가 도착했습니다.",
    });
    latestAt = Math.max(latestAt, getLatestCreatedAt(newRebuttals));
    focusClaimId = focusClaimId || newRebuttals[0].claimId;
  }

  if (newSurrebuttals.length) {
    items.push({
      type: "surrebuttal",
      claimId: newSurrebuttals[0].claimId,
      title: "내가 확인할 재반박이 있습니다",
      copy: "내 반박 아래에 새 재반박 " + newSurrebuttals.length + "개가 도착했습니다.",
    });
    latestAt = Math.max(latestAt, getLatestCreatedAt(newSurrebuttals));
    focusClaimId = focusClaimId || newSurrebuttals[0].claimId;
  }

  if (pendingPersuasion.length) {
    items.push({
      type: "persuasion",
      claimId: pendingPersuasion[0].claimId,
      title: "설득된 정도를 작성하실 차례입니다",
      copy: "내 트리에 새 재반박이 달려, 이 대화가 최종 판단에 어떤 영향을 주었는지 적을 항목이 " + pendingPersuasion.length + "개 생겼습니다.",
    });
    latestAt = Math.max(latestAt, getLatestCreatedAt(pendingPersuasion));
    focusClaimId = focusClaimId || pendingPersuasion[0].claimId;
  }

  if (!items.length) return null;

  return {
    items: items,
    latestAt: latestAt,
    focusClaimId: focusClaimId,
  };
}

function renderActivityModal(summary) {
  document.getElementById("activity-modal-kicker").textContent = "새 소식";
  document.getElementById("activity-modal-title").textContent = "확인할 알림이 있습니다";
  document.getElementById("go-activity-modal-btn").style.display = "inline-flex";
  var body = document.getElementById("activity-modal-body");
  body.innerHTML = summary.items.map(function (item) {
    return (
      '<div class="activity-item">' +
      '  <div class="activity-item-title">' + escapeHtml(item.title) + "</div>" +
      '  <div class="activity-item-copy">' + escapeHtml(item.copy) + "</div>" +
      "</div>"
    );
  }).join("");
}

function renderGuideModal() {
  pendingActivitySummary = null;
  document.getElementById("activity-modal-kicker").textContent = "안내";
  document.getElementById("activity-modal-title").textContent = "이 사이트는 이렇게 사용합니다";
  document.getElementById("go-activity-modal-btn").style.display = "none";
  document.getElementById("activity-modal-body").innerHTML =
    '<div class="activity-item">' +
    '  <div class="activity-item-copy">기존 로직트리와 유사한 구조를 활용해 사용이 편하도록 만든 서비스입니다.</div>' +
    '</div>' +
    '<div class="activity-item">' +
    '  <div class="activity-item-copy">주장과 근거를 적으면, 다른 사람이 그 아래에 반박과 재반박을 서로 달 수 있습니다.</div>' +
    '</div>' +
    '<div class="activity-item">' +
    '  <div class="activity-item-copy">그 흐름을 보고 마지막에는 내 판단이 얼마나 움직였는지, 최종 평가에서 어떤 선택에 가까워졌는지 적어볼 수 있습니다.</div>' +
    '</div>' +
    '<div class="activity-item">' +
    '  <div class="activity-item-copy">또한 URL을 입력하면 자동으로 하이퍼링크로 바뀌어 근거 자료를 바로 열 수 있습니다.</div>' +
    '</div>';
}

function renderViewVisibility() {
  var canParticipate = isParticipantEditable();
  var composerPanel = document.getElementById("composer-panel");
  var dashboardView = document.getElementById("dashboard-view");
  var editorView = document.getElementById("editor-view");
  var detailView = document.getElementById("detail-view");
  var openEditorBtn = document.getElementById("open-editor-btn");
  var backToDashboardBtn = document.getElementById("back-to-dashboard-btn");

  if (!composerPanel || !dashboardView || !editorView || !detailView) return;

  dashboardView.style.display = activeView === "dashboard" ? "block" : "none";
  editorView.style.display = activeView === "editor" && canParticipate ? "block" : "none";
  detailView.style.display = activeView === "detail" ? "block" : "none";

  if (openEditorBtn) openEditorBtn.style.display = canParticipate && activeView === "dashboard" ? "inline-flex" : "none";
  if (backToDashboardBtn) backToDashboardBtn.style.display = activeView === "editor" || activeView === "detail" ? "inline-flex" : "none";
}

function formatDashboardDate(timestamp) {
  if (!timestamp) return "";
  var date = new Date(timestamp);
  var yy = String(date.getFullYear()).slice(2);
  var mm = String(date.getMonth() + 1).padStart(2, "0");
  var dd = String(date.getDate()).padStart(2, "0");
  var hh = date.getHours();
  var min = String(date.getMinutes()).padStart(2, "0");
  var ampm = hh < 12 ? "AM" : "PM";
  hh = hh % 12 || 12;
  return yy + "." + mm + "." + dd + " " + hh + ":" + min + ampm;
}

function getRawNickname(nickname) {
  return nickname || "사용자";
}

function getAnonymousNickname() {
  return "익명 사용자";
}

function getDisplayNickname() {
  return getAnonymousNickname();
}

function formatAnonymousCount(count) {
  return count > 0 ? getAnonymousNickname() + " " + count + "명" : "없음";
}

function getClaimSideLabel(side) {
  return normalizeClaimSide(side) === "con" ? "반대" : "찬성";
}

function normalizeClaimSide(side) {
  return side === "con" ? "con" : "pro";
}

function renderLikeButton(targetType, targetId) {
  var count = getLikeCount(targetType, targetId);
  var liked = isLikedByMe(targetType, targetId);
  var names = getLikeNicknames(targetType, targetId);
  return (
    '<div class="like-row">' +
    '  <button class="like-button' + (liked ? " active" : "") + '" data-action="toggle-like" data-target-type="' + escapeAttribute(targetType) + '" data-target-id="' + escapeAttribute(targetId) + '" type="button">' +
    '    <span class="like-icon" aria-hidden="true">' + thumbsUpIconMarkup() + "</span>" +
    '    <span>좋아요 ' + count + "</span>" +
    "  </button>" +
    (names.length
      ? '  <span class="like-names">' + escapeHtml(formatAnonymousCount(names.length)) + "</span>"
      : "") +
    "</div>"
  );
}

function thumbsUpIconMarkup() {
  return '' +
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>' +
    '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/>' +
    "</svg>";
}

function flameIconMarkup() {
  return '' +
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">' +
    '<path d="M12.68 2.3c.2 1.7-.27 3.11-1.44 4.5-.92 1.1-2.13 2.03-2.87 3.3-.76 1.3-1.08 2.56-.82 4.24.34 2.23 2.25 4.1 4.45 4.34 3.03.34 5.6-2.03 5.6-5 0-3.06-1.8-4.89-3.18-6.53-.92-1.1-1.74-2.25-1.74-4.85zM11.9 21.7c-2.53 0-4.6-2.01-4.6-4.48 0-1.76.92-3.16 2.44-4.44.26 1.32 1.1 2.2 2.3 2.8 1.56.8 2.44 2 2.44 3.7 0 1.36-1.12 2.42-2.58 2.42z"/>' +
    "</svg>";
}

function getLatestCreatedAt(items) {
  return items.reduce(function (maxValue, item) {
    return Math.max(maxValue, Number(item.createdAt) || 0);
  }, 0);
}

function getActivitySeenKey() {
  return "im_debate4_activity_seen_" + (myInfo && myInfo.nickname ? myInfo.nickname : "anonymous");
}

function buildPreviewMarkup(url) {
  var safeUrl = escapeAttribute(url);
  var youtubeUrl = getYoutubeEmbedUrl(url);

  if (youtubeUrl) {
    return '<iframe class="preview-frame" src="' + escapeAttribute(youtubeUrl) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
  }

  if (isImageUrl(url)) {
    return '<img class="preview-image" src="' + safeUrl + '" alt="미리보기 이미지">';
  }

  if (isPdfUrl(url)) {
    return '<iframe class="preview-frame" src="' + safeUrl + '"></iframe>';
  }

  return (
    '<div class="preview-card">' +
    '  <p>가능한 경우 이 사이트 안에서 바로 자료를 보여줍니다. 일부 사이트는 보안 정책 때문에 미리보기가 막힐 수 있습니다.</p>' +
    '  <div style="margin-top:12px"><a class="preview-link" href="' + safeUrl + '" target="_blank" rel="noopener noreferrer">' + safeUrl + '</a></div>' +
    '  <div style="margin-top:12px"><iframe class="preview-frame" src="' + safeUrl + '"></iframe></div>' +
    "</div>"
  );
}

function isImageUrl(url) {
  return /\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(url);
}

function isPdfUrl(url) {
  return /\.pdf(\?.*)?$/i.test(url);
}

function getYoutubeEmbedUrl(url) {
  var match = url.match(/^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/i);
  if (!match) return "";
  return "https://www.youtube.com/embed/" + match[1];
}

function showMessage(text) {
  document.getElementById("message").textContent = text;
  document.getElementById("message").style.display = "flex";
  document.getElementById("app").style.display = "none";
}

function formatRichText(text) {
  var escaped = escapeHtml(text == null ? "" : String(text));
  var withLinks = escaped.replace(/(https?:\/\/[^\s<]+)/g, function (url) {
    return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + "</a>";
  });
  return withLinks.replace(/\n/g, "<br>");
}

function formatLineClampText(text) {
  var value = text == null ? "" : String(text).replace(/\s+/g, " ").trim();
  if (value.length <= 88) return escapeHtml(value);
  return escapeHtml(value.slice(0, 88) + "...");
}

function escapeHtml(text) {
  var div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

function escapeAttribute(text) {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

function getSideLabel(side) {
  if (side === "con") return "반대";
  return "찬성";
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return "방금 전";

  var diff = Date.now() - timestamp;
  if (diff < 60000) return "방금 전";
  if (diff < 3600000) return Math.floor(diff / 60000) + "분 전";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "시간 전";
  if (diff < 604800000) return Math.floor(diff / 86400000) + "일 전";

  var date = new Date(timestamp);
  return date.getFullYear() + "." + pad(date.getMonth() + 1) + "." + pad(date.getDate());
}

function pad(num) {
  return num < 10 ? "0" + num : String(num);
}

function createId(prefix) {
  return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
