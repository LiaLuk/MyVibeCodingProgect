#<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Географическая викторина</title>
</head>
<body>
  <h1>Географическая викторина</h1>
  <div id="quiz"></div>
  <button id="next">Следующий вопрос</button>
  <p id="result"></p>

  <script>
    let quiz = [];
    let current = 0;
    let score = 0;

    fetch("1.json")
      .then(response => response.json())
      .then(data => {
        quiz = data;
        showQuestion();
      });

    function showQuestion() {
      const q = quiz[current];
      document.getElementById("quiz").innerHTML = `
        <p><b>Вопрос ${current + 1} из ${quiz.length}</b></p>
        <p>${q.question}</p>
        <input id="answer" placeholder="Ваш ответ">
      `;
    }

    document.getElementById("next").onclick = () => {
      const userAnswer = document.getElementById("answer").value.trim().toLowerCase();
      const correct = quiz[current].answer.trim().toLowerCase();

      if (userAnswer === correct) {
        score++;
      }

      current++;

      if (current < quiz.length) {
        showQuestion();
      } else {
        document.getElementById("quiz").innerHTML = "";
        document.getElementById("next").style.display = "none";
        document.getElementById("result").textContent =
          `Ваш результат: ${score} из ${quiz.length}`;
      }
    };
  </script>
</body>
</html>
