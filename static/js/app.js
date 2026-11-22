"use strict";

const STORAGE_KEY = "orbita-knowledge-v1";

const screens = {
  home: document.getElementById("home-screen"),
  quiz: document.getElementById("quiz-screen"),
  progress: document.getElementById("progress-screen")
};

let questions = [];
let selectedOption = null;
let loadingError = "";
let storageWarning = "";

let state = {
  signature: "",
  answers: [],
  history: []
};

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (symbol) => {
    const symbols = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return symbols[symbol];
  });
}

function scoreOf(answers) {
  return answers.reduce((score, answer, index) => {
    return score + Number(answer === questions[index].answer);
  }, 0);
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    storageWarning =
      "Браузер не разрешил сохранить данные. Не закрывайте страницу: " +
      "после её закрытия прогресс может потеряться.";
  }
}

function loadState() {
  const signature = JSON.stringify(questions);
  state.signature = signature;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return;
    }

    const saved = JSON.parse(raw);

    if (saved.signature !== signature) {
      storageWarning =
        "Набор вопросов изменился. Для новой версии начато новое прохождение.";
      return;
    }

    const validAnswers =
      Array.isArray(saved.answers) &&
      saved.answers.length <= questions.length &&
      saved.answers.every((answer, index) => {
        return (
          Number.isInteger(answer) &&
          answer >= 0 &&
          answer < questions[index].options.length
        );
      });

    const validHistory =
      Array.isArray(saved.history) &&
      saved.history.every((entry) => {
        return (
          entry &&
          typeof entry.date === "string" &&
          !Number.isNaN(Date.parse(entry.date)) &&
          Number.isInteger(entry.score) &&
          Number.isInteger(entry.total) &&
          entry.total === questions.length &&
          entry.score >= 0 &&
          entry.score <= entry.total
        );
      });

    if (!validAnswers || !validHistory) {
      throw new Error("Некорректные сохранённые данные");
    }

    state.answers = saved.answers;
    state.history = saved.history.slice(0, 30);
  } catch {
    storageWarning =
      "Сохранённые данные недоступны или повреждены. " +
      "Можно начать новое прохождение.";
  }
}

function updateHomeButton() {
  const button = document.querySelector(
    "#home-screen .button-primary"
  );

  if (!button) {
    return;
  }

  const inProgress =
    state.answers.length > 0 &&
    state.answers.length < questions.length;

  button.textContent = inProgress
    ? "Продолжить викторину →"
    : "Начать викторину →";
}

function showScreen() {
  const requested = window.location.hash.slice(1);

  const current = Object.prototype.hasOwnProperty.call(
    screens,
    requested
  )
    ? requested
    : "home";

  for (const [name, element] of Object.entries(screens)) {
    element.hidden = name !== current;
  }

  document.querySelectorAll("[data-nav]").forEach((link) => {
    if (link.dataset.nav === current) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  updateHomeButton();

  if (current === "quiz") {
    renderQuiz();
  }

  if (current === "progress") {
    renderProgress();
  }

  window.scrollTo(0, 0);

  const heading = screens[current].querySelector("h1");

  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
}

function warningHTML() {
  return storageWarning
    ? `<p class="storage-warning" role="status">
         ${escapeHTML(storageWarning)}
       </p>`
    : "";
}

function renderQuiz() {
  const screen = screens.quiz;

  if (!questions.length) {
    screen.innerHTML = `
      <div class="panel">
        <h1 class="panel-title">
          ${loadingError ? "Не удалось загрузить вопросы" : "Загружаем вопросы…"}
        </h1>

        <p class="panel-description" role="status">
          ${escapeHTML(
            loadingError || "Подождите несколько секунд."
          )}
        </p>

        <a class="button button-secondary" href="#home">
          На главную
        </a>
      </div>
    `;

    return;
  }

  if (state.answers.length === questions.length) {
    renderCompleted();
    return;
  }

  const index = state.answers.length;
  const item = questions[index];
  selectedOption = null;

  screen.innerHTML = `
    <div class="quiz-layout">
      <div class="quiz-topline">
        <a class="text-link" href="#home">← На главную</a>
        <span>Баллы: ${scoreOf(state.answers)}</span>
      </div>

      <div class="quiz-meta">
        <span>Вопрос ${index + 1} из ${questions.length}</span>
        <span>Отвечено: ${index}</span>
      </div>

      <progress
        class="quiz-progress"
        value="${index}"
        max="${questions.length}"
        aria-label="Количество отвеченных вопросов"
      ></progress>

      <div class="question-card">
        <img
          class="quiz-decoration"
          src="static/images/rocket.svg"
          alt=""
          width="100"
          height="84"
        >

        <p class="eyebrow">СЛЕДУЮЩАЯ ТОЧКА МАРШРУТА</p>

        <h1 class="question-title">
          ${escapeHTML(item.question)}
        </h1>

        <div class="options" role="group" aria-label="Варианты ответа">
          ${item.options.map((option, optionIndex) => `
            <button
              class="option"
              type="button"
              data-option="${optionIndex}"
              aria-pressed="false"
            >
              <span class="option-letter">
                ${["А", "Б", "В", "Г"][optionIndex]}
              </span>

              <span>${escapeHTML(option)}</span>
            </button>
          `).join("")}
        </div>

        <div id="answer-feedback" aria-live="polite"></div>

        <button
          class="button button-primary"
          id="check-answer"
          type="button"
          disabled
        >
          Проверить ответ
        </button>
      </div>

      ${warningHTML()}
    </div>
  `;

  const optionButtons = screen.querySelectorAll("[data-option]");
  const checkButton = document.getElementById("check-answer");

  optionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedOption = Number(button.dataset.option);

      optionButtons.forEach((optionButton) => {
        const isSelected = optionButton === button;

        optionButton.classList.toggle("is-selected", isSelected);
        optionButton.setAttribute(
          "aria-pressed",
          String(isSelected)
        );
      });

      checkButton.disabled = false;
    });
  });

  checkButton.addEventListener("click", () => {
    if (
      selectedOption === null ||
      state.answers.length !== index
    ) {
      return;
    }

    const isCorrect = selectedOption === item.answer;

    state.answers.push(selectedOption);

    if (state.answers.length === questions.length) {
      state.history.unshift({
        date: new Date().toISOString(),
        score: scoreOf(state.answers),
        total: questions.length
      });

      state.history = state.history.slice(0, 30);
    }

    saveState();
    updateHomeButton();

    optionButtons.forEach((button) => {
      const optionIndex = Number(button.dataset.option);
      button.disabled = true;

      if (optionIndex === item.answer) {
        button.classList.add("is-correct");
      } else if (optionIndex === selectedOption) {
        button.classList.add("is-wrong");
      }
    });

    const feedback = document.getElementById("answer-feedback");

    feedback.innerHTML = `
      <div class="feedback ${isCorrect ? "feedback-correct" : "feedback-wrong"}">
        <p class="feedback-title">
          ${isCorrect ? "Верно!" : "Пока неверно."}
        </p>

        <p>
          Правильный ответ:
          ${escapeHTML(item.options[item.answer])}.
        </p>

        <p>${escapeHTML(item.explanation)}</p>
      </div>
    `;

    checkButton.hidden = true;

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className = "button button-primary";

    nextButton.textContent =
      state.answers.length === questions.length
        ? "Посмотреть результат"
        : "Следующий вопрос →";

    nextButton.addEventListener("click", () => {
      renderQuiz();

      const heading = screen.querySelector("h1");
      heading.setAttribute("tabindex", "-1");
      heading.focus();
    });

    checkButton.after(nextButton);
    nextButton.focus();
  });
}

function renderCompleted() {
  const score = scoreOf(state.answers);
  const percent = Math.round(score / questions.length * 100);

  screens.quiz.innerHTML = `
    <div class="panel">
      <img
        class="panel-image"
        src="static/images/galaxy.svg"
        alt=""
        width="240"
        height="200"
      >

      <p class="eyebrow">МИССИЯ ЗАВЕРШЕНА</p>
      <h1 class="panel-title">Путешествие пройдено!</h1>

      <p class="result-score">
        ${score}<span> / ${questions.length}</span>
      </p>

      <p class="panel-description">
        Правильных ответов: ${percent}%.
        Результат добавлен в историю попыток.
      </p>

      <div class="panel-actions">
        <button
          class="button button-primary"
          id="restart-quiz"
          type="button"
        >
          Пройти ещё раз
        </button>

        <a class="button button-secondary" href="#progress">
          Мой прогресс
        </a>
      </div>

      ${warningHTML()}
    </div>
  `;

  document.getElementById("restart-quiz").addEventListener(
    "click",
    startNewAttempt
  );
}

function startNewAttempt() {
  const inProgress =
    state.answers.length > 0 &&
    state.answers.length < questions.length;

  if (
    inProgress &&
    !window.confirm(
      "Сбросить текущее прохождение? История завершённых попыток останется."
    )
  ) {
    return;
  }

  state.answers = [];
  selectedOption = null;
  saveState();

  if (window.location.hash === "#quiz") {
    renderQuiz();
  } else {
    window.location.hash = "quiz";
  }

  updateHomeButton();
}

function renderProgress() {
  const best = state.history.reduce(
    (maximum, entry) => Math.max(maximum, entry.score),
    0
  );

  const inProgress =
    state.answers.length > 0 &&
    state.answers.length < questions.length;

  screens.progress.innerHTML = `
    <div class="progress-layout">
      <p class="eyebrow">ТВОЙ БОРТОВОЙ ЖУРНАЛ</p>
      <h1 class="panel-title">Мой прогресс</h1>

      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-value">${state.history.length}</span>
          <span>попыток в истории</span>
        </div>

        <div class="stat-card">
          <span class="stat-value">${best} / ${questions.length || 10}</span>
          <span>лучший результат</span>
        </div>

        <div class="stat-card">
          <span class="stat-value">
            ${inProgress ? state.answers.length : 0}
          </span>
          <span>ответов в незавершённой попытке</span>
        </div>
      </div>

      <div class="panel-actions">
        <a class="button button-primary" href="#quiz">
          ${inProgress ? "Продолжить викторину" : "Перейти к викторине"}
        </a>

        ${inProgress ? `
          <button
            class="button button-secondary"
            id="reset-attempt"
            type="button"
          >
            Начать заново
          </button>
        ` : ""}

        <a class="button button-secondary" href="#home">
          На главную
        </a>
      </div>

      <h2 class="history-title">История попыток</h2>

      ${state.history.length ? `
        <ol class="history-list">
          ${state.history.map((entry) => `
            <li class="history-item">
              <span>
                ${escapeHTML(
                  new Date(entry.date).toLocaleString("ru-RU")
                )}
              </span>
              <span>${entry.score} из ${entry.total}</span>
            </li>
          `).join("")}
        </ol>
      ` : `
        <p class="empty-state">
          Завершённых попыток пока нет.
          Пройди викторину, чтобы увидеть первый результат.
        </p>
      `}

      <p class="storage-note">
        Хранятся последние 30 завершённых попыток.
        Прогресс доступен в этом браузере по этому адресу сайта.
        После очистки данных сайта он может исчезнуть.
      </p>

      ${warningHTML()}
    </div>
  `;

  const resetButton = document.getElementById("reset-attempt");

  if (resetButton) {
    resetButton.addEventListener("click", startNewAttempt);
  }
}

function validateQuestions(data) {
  if (
    !Array.isArray(data) ||
    data.length !== 10 ||
    !data.every((item) => {
      return (
        item &&
        typeof item.id === "string" &&
        typeof item.question === "string" &&
        Array.isArray(item.options) &&
        item.options.length === 4 &&
        item.options.every((option) => typeof option === "string") &&
        Number.isInteger(item.answer) &&
        item.answer >= 0 &&
        item.answer < 4 &&
        typeof item.explanation === "string"
      );
    }) ||
    new Set(data.map((item) => item.id)).size !== data.length
  ) {
    throw new Error("Проверьте структуру десяти вопросов в data.json.");
  }
}

async function initialize() {
  showScreen();

  try {
    const response = await fetch("data.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Файл data.json недоступен: ${response.status}`);
    }

    const data = await response.json();
    validateQuestions(data);

    questions = data;
    loadState();
  } catch (error) {
    loadingError =
      "Проверьте data.json и откройте сайт через локальный сервер. " +
      error.message;
  }

  showScreen();
}

window.addEventListener("hashchange", showScreen);

initialize();