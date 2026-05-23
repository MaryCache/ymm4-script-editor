import { generateId } from "./id";

test("UUID 形式の文字列を返す", () => {
  expect(generateId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
});

test("呼ぶたびに異なる ID を返す", () => {
  expect(generateId()).not.toBe(generateId());
});
