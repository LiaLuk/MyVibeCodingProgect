import json

with open("1.json", encoding="utf-8") as f:
    quiz = json.load(f)

score = 0

print("Географическая викторина!\n")

for i, item in enumerate(quiz, 1):
    print(f"Вопрос {i}: {item['question']}")
    answer = input("Ваш ответ: ").strip().lower()

    if answer == item["answer"].strip().lower():
        print("Верно!\n")
        score += 1
    else:
        print(f"Неверно. Правильный ответ: {item['answer']}\n")

print(f"Результат: {score} из {len(quiz)}")