const buttons = [...document.querySelectorAll("[data-tab]")];
const panels = [...document.querySelectorAll(".tab-panel")];
const tabTargets = [...document.querySelectorAll("[data-tab-target]")];
const contactOpen = document.querySelector("[data-contact-open]");
const contactOverlay = document.querySelector("[data-contact-overlay]");
const copyButtons = [...document.querySelectorAll("[data-copy-value]")];
const questButtons = [...document.querySelectorAll("[data-quest-open]")];
const externalLinkButtons = [...document.querySelectorAll("[data-external-url]")];
const questOverlay = document.querySelector("[data-quest-overlay]");
const questTitle = document.querySelector("[data-quest-title]");
const questBody = document.querySelector("[data-quest-body]");

const copyLabel = "\u590d\u5236";
const copiedLabel = "\u5df2\u590d\u5236";
const failedLabel = "\u5931\u8d25";
const questTitles = {
  venture: "2024.05-2026.3 | 创业：移民 & 美区TK & 抖音",
  qianyudao: "2023.12-2024.04 | 深圳市乾有道文旅数字投资有限公司",
  lisen: "2022-08 ~ 2023-12 | 深圳市李森科技有限公司",
  college: "2022.06 | 广东岭南职业技术学院",
};

function showTab(tabName, shouldScroll = true) {
  buttons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tabName);
  });

  panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === tabName);
  });

  if (shouldScroll) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  history.replaceState(null, "", `#${tabName}`);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("copy failed");
  }
}

buttons.forEach((button) => {
  button.addEventListener("click", () => showTab(button.dataset.tab));
});

tabTargets.forEach((target) => {
  target.addEventListener("click", () => showTab(target.dataset.tabTarget));
});

externalLinkButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const url = button.dataset.externalUrl;
    const opened = window.open(url, "_blank", "noopener,noreferrer");

    if (!opened) {
      window.location.href = url;
    }
  });
});

contactOpen?.addEventListener("click", (event) => {
  event.stopPropagation();
  copyButtons.forEach((button) => {
    button.textContent = copyLabel;
  });
  contactOverlay.hidden = false;
});

contactOverlay?.addEventListener("click", (event) => {
  if (event.target === contactOverlay) {
    contactOverlay.hidden = true;
  }
});

questButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const questId = button.dataset.questOpen;
    const template = document.querySelector(`#quest-template-${questId}`);

    if (!template || !questOverlay || !questTitle || !questBody) {
      return;
    }

    questTitle.textContent = questTitles[questId] || "";
    questBody.innerHTML = "";
    questBody.append(template.content.cloneNode(true));
    questOverlay.hidden = false;
  });
});

questOverlay?.addEventListener("click", (event) => {
  if (event.target === questOverlay) {
    questOverlay.hidden = true;
  }
});

copyButtons.forEach((button) => {
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    const value = button.dataset.copyValue;

    try {
      await copyText(value);
      button.textContent = copiedLabel;
      window.setTimeout(() => {
        button.textContent = copyLabel;
      }, 1400);
    } catch {
      button.textContent = failedLabel;
      window.prompt("\u8bf7\u624b\u52a8\u590d\u5236", value);
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && contactOverlay && !contactOverlay.hidden) {
    contactOverlay.hidden = true;
  }
  if (event.key === "Escape" && questOverlay && !questOverlay.hidden) {
    questOverlay.hidden = true;
  }
});

const initialTab = location.hash.replace("#", "");
if (buttons.some((button) => button.dataset.tab === initialTab)) {
  showTab(initialTab, false);
} else if (initialTab === "resume") {
  showTab("home", false);
} else if (initialTab) {
  showTab("home", false);
}
