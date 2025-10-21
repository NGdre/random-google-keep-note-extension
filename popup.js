// Константы для классов и селекторов
const SELECTORS = {
  NOTE: ".IZ65Hb-n0tgWb",
  TITLE: ".IZ65Hb-YPqjbf",
  CONTENT: ".IZ65Hb-vIzZGf-bVEB4e-qJTHM",
  LABEL: ".XPtOyb-fmcmS",
};

// Константы для сообщений
const MESSAGES = {
  ENTER_LABEL: "Введите название ярлыка",
  OPEN_KEEP: "Откройте Google Keep для использования расширения",
  SEARCHING_NOTES: "Поиск заметок...",
  LOADING_ALL_NOTES: "Загрузка всех заметок...",
  LOADING_PROGRESS: "Загрузка...",
  LOADING_ERROR: "Ошибка загрузки",
  NO_NOTES_FOUND: "Не найдено заметок",
  NO_NOTES_WITH_LABEL: "Не найдено заметок с ярлыком",
  FAILED_TO_OPEN: "Не удалось открыть заметку",
  SEARCH_ERROR: "Ошибка при поиске заметок:",
  RANDOM_NOTE_SELECTED: "Выбрана случайная заметка",
};

// Константы для стилей и классов
const STYLES = {
  LOADING_INDICATOR: `
    position: fixed !important; 
    bottom: 60px !important; 
    right: 20px !important; 
    background: #e3f2fd !important; 
    padding: 10px !important; 
    border-radius: 5px !important;
    z-index: 9999 !important; 
    border: 2px solid #2196F3 !important;
    font-family: Arial, sans-serif !important; 
    font-size: 14px !important;
  `,
  SUCCESS_INDICATOR: `
    position: fixed !important; 
    top: 20px !important; 
    right: 20px !important; 
    background: #e6f4ea !important; 
    padding: 12px 16px !important; 
    border-radius: 8px !important;
    z-index: 10000 !important; 
    border: 1px solid #b6e5c8 !important;
    font-family: 'Roboto', Arial, sans-serif !important; 
    font-size: 14px !important;
    color: #137333 !important;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1) !important;
    max-width: 300px !important;
  `,
};

// Константы для конфигурации
const CONFIG = {
  SCROLL: {
    MAX_SCROLLS: 100,
    DELAY: 1200,
    NO_CHANGE_THRESHOLD: 3,
  },
  ANIMATION: {
    NOTE_OPEN_DELAY: 300,
    INDICATOR_REMOVE_DELAY: 3000,
    SUCCESS_INDICATOR_REMOVE_DELAY: 5000,
  },
  KEEP_URL: "https://keep.google.com/*",
};

// Константы для состояний кнопок
const BUTTON_TEXT = {
  PICKING: "Поиск...",
  DEFAULT: "Выбрать случайную заметку",
};

// Константы для типов статусов
const STATUS_TYPES = {
  ERROR: "error",
  INFO: "info",
  SUCCESS: "success",
};

document.addEventListener("DOMContentLoaded", function () {
  const labelInput = document.getElementById("labelInput");
  const pickButton = document.getElementById("pickNote");
  const statusDiv = document.getElementById("status");

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
  }

  function setButtonsState(picking) {
    pickButton.disabled = picking;
    pickButton.textContent = picking
      ? BUTTON_TEXT.PICKING
      : BUTTON_TEXT.DEFAULT;
  }

  pickButton.addEventListener("click", async () => {
    const label = labelInput.value.trim();

    if (!label) {
      showStatus(MESSAGES.ENTER_LABEL, STATUS_TYPES.ERROR);
      return;
    }

    try {
      setButtonsState(true);
      showStatus(MESSAGES.SEARCHING_NOTES, STATUS_TYPES.INFO);

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
        url: CONFIG.KEEP_URL,
      });

      if (!tab) {
        showStatus(MESSAGES.OPEN_KEEP, STATUS_TYPES.ERROR);
        setButtonsState(false);
        return;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (labelName, constants) => {
          const { SELECTORS, MESSAGES, STYLES, CONFIG } = constants;

          // ФУНКЦИЯ ЗАГРУЗКИ ВСЕХ ЗАМЕТОК
          const loadAllNotes = async () => {
            const loadingIndicator = document.createElement("div");
            loadingIndicator.textContent = MESSAGES.LOADING_ALL_NOTES;
            loadingIndicator.style.cssText = STYLES.LOADING_INDICATOR;
            document.body.appendChild(loadingIndicator);

            let scrollCount = 0;
            const maxScrolls = CONFIG.SCROLL.MAX_SCROLLS;
            let previousHeight = 0;
            let noChangeCount = 0;
            let totalNotes = 0;

            try {
              while (scrollCount < maxScrolls) {
                const currentHeight = document.documentElement.scrollHeight;
                totalNotes = document.querySelectorAll(SELECTORS.NOTE).length;

                // Прокручиваем к самому низу
                window.scrollTo(0, currentHeight);

                // Обновляем статус
                loadingIndicator.textContent = `${MESSAGES.LOADING_PROGRESS} (${
                  scrollCount + 1
                }/${maxScrolls}) | Заметок: ${totalNotes}`;

                // Ждем загрузки новых данных
                await new Promise((resolve) =>
                  setTimeout(resolve, CONFIG.SCROLL.DELAY)
                );

                // Проверяем, загрузились ли новые данные
                const newHeight = document.documentElement.scrollHeight;
                const newTotalNotes = document.querySelectorAll(
                  SELECTORS.NOTE
                ).length;

                if (
                  newHeight === previousHeight &&
                  newTotalNotes === totalNotes
                ) {
                  noChangeCount++;
                  if (noChangeCount >= CONFIG.SCROLL.NO_CHANGE_THRESHOLD) {
                    break;
                  }
                } else {
                  noChangeCount = 0;
                }

                previousHeight = newHeight;
                totalNotes = newTotalNotes;
                scrollCount++;
              }

              loadingIndicator.textContent = `Загружено ${totalNotes} заметок`;

              setTimeout(
                () => loadingIndicator.remove(),
                CONFIG.ANIMATION.INDICATOR_REMOVE_DELAY
              );
              return totalNotes;
            } catch (error) {
              console.error("Ошибка загрузки:", error);
              loadingIndicator.textContent = MESSAGES.LOADING_ERROR;
              setTimeout(
                () => loadingIndicator.remove(),
                CONFIG.ANIMATION.INDICATOR_REMOVE_DELAY
              );
              return totalNotes;
            }
          };

          // ФУНКЦИЯ ПОИСКА ЗАМЕТОК ПО ЯРЛЫКУ
          const findNotesByLabel = async (labelName) => {
            const notes = [];

            const noteElements = document.querySelectorAll(SELECTORS.NOTE);

            for (const noteElement of noteElements) {
              // Проверяем, что это действительно заметка (имеет содержимое)
              const title = noteElement.querySelector(SELECTORS.TITLE);
              const content = noteElement.querySelector(SELECTORS.CONTENT);

              // Пропускаем пустые или неполные заметки
              if (!title && !content) {
                continue;
              }

              let shouldInclude = true;
              if (labelName && labelName.trim() !== "") {
                shouldInclude = false;

                const labels = noteElement.querySelectorAll(SELECTORS.LABEL);

                for (const label of labels) {
                  const text = label.textContent || "";
                  if (text.toLowerCase().includes(labelName.toLowerCase())) {
                    shouldInclude = true;
                    break;
                  }
                }
              }

              if (shouldInclude) {
                notes.push(noteElement);
              }
            }

            return notes;
          };

          // ФУНКЦИЯ ОТКРЫТИЯ ЗАМЕТКИ
          const openNote = async (noteElement) => {
            try {
              const title = noteElement.querySelector(SELECTORS.TITLE);
              if (title) {
                title.click();
                await new Promise((resolve) =>
                  setTimeout(resolve, CONFIG.ANIMATION.NOTE_OPEN_DELAY)
                );
                return true;
              }

              const content = noteElement.querySelector(SELECTORS.CONTENT);
              if (content) {
                content.click();
                await new Promise((resolve) =>
                  setTimeout(resolve, CONFIG.ANIMATION.NOTE_OPEN_DELAY)
                );
                return true;
              }

              noteElement.click();
              await new Promise((resolve) =>
                setTimeout(resolve, CONFIG.ANIMATION.NOTE_OPEN_DELAY)
              );
              return true;
            } catch (error) {
              console.error("Ошибка открытия заметки:", error);
              return false;
            }
          };

          // ФУНКЦИЯ ПОКАЗА ИНДИКАТОРА
          const showLoadingIndicator = (message) => {
            const existingIndicator = document.querySelector(
              '[style*="position: fixed"][style*="top: 20px"][style*="right: 20px"]'
            );
            if (existingIndicator) {
              existingIndicator.remove();
            }

            const loadingIndicator = document.createElement("div");
            loadingIndicator.textContent = message;
            loadingIndicator.style.cssText = STYLES.SUCCESS_INDICATOR;

            document.body.appendChild(loadingIndicator);

            setTimeout(() => {
              if (loadingIndicator && loadingIndicator.parentNode) {
                loadingIndicator.remove();
              }
            }, CONFIG.ANIMATION.SUCCESS_INDICATOR_REMOVE_DELAY);
          };

          // ОСНОВНАЯ ЛОГИКА ВЫБОРА СЛУЧАЙНОЙ ЗАМЕТКИ
          return new Promise(async (resolve) => {
            try {
              // Загружаем все заметки
              const totalNotes = await loadAllNotes();
              if (totalNotes === 0) {
                resolve({ success: false, message: MESSAGES.NO_NOTES_FOUND });
                return;
              }

              // Ищем заметки по ярлыку
              const notes = await findNotesByLabel(labelName);

              if (notes.length === 0) {
                resolve({
                  success: false,
                  message: `${MESSAGES.NO_NOTES_WITH_LABEL} "${labelName}"`,
                });
                return;
              }

              // Выбираем случайную заметку
              const randomIndex = Math.floor(Math.random() * notes.length);
              const currentNote = notes[randomIndex];

              // Открываем заметку
              const opened = await openNote(currentNote);

              if (opened) {
                // Показываем индикатор успеха
                showLoadingIndicator(
                  `${MESSAGES.RANDOM_NOTE_SELECTED} (${notes.length} найдено)`
                );

                resolve({
                  success: true,
                  totalNotes: notes.length,
                  message: `Открыта случайная заметка из ${notes.length} найденных`,
                });
              } else {
                resolve({
                  success: false,
                  message: MESSAGES.FAILED_TO_OPEN,
                });
              }
            } catch (error) {
              console.error("Ошибка:", error);
              resolve({
                success: false,
                message: `${MESSAGES.SEARCH_ERROR} ${error.message}`,
              });
            }
          });
        },
        args: [label, { SELECTORS, MESSAGES, STYLES, CONFIG }],
      });

      const result = results[0].result;

      if (result && result.success) {
        showStatus(
          `Найдено заметок: ${result.totalNotes}. Открыта случайная!`,
          STATUS_TYPES.SUCCESS
        );
      } else {
        showStatus(
          result?.message || MESSAGES.FAILED_TO_OPEN,
          STATUS_TYPES.ERROR
        );
      }
    } catch (error) {
      console.error("Error:", error);
      showStatus("Ошибка: " + error.message, STATUS_TYPES.ERROR);
    } finally {
      setButtonsState(false);
    }
  });

  // АВТОФОКУС НА ПОЛЕ ВВОДА
  labelInput.focus();
});
