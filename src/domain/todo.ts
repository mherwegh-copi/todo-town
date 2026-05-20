export type Todo = {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
  readonly createdAt: number;
};

let counter = 0;

export function newTodo(text: string, now: number): Todo {
  const trimmed = text.trim();
  if (trimmed.length === 0) throw new Error('todo text cannot be empty');
  counter += 1;
  return {
    id: `todo-${now}-${counter}`,
    text: trimmed,
    done: false,
    createdAt: now,
  };
}
