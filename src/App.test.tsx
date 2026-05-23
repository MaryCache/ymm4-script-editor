import { render, screen } from "@testing-library/react";
import App from "./App";

test("App が起動してアプリ名を表示する", () => {
  render(<App />);
  expect(screen.getByText("YMM4台本エディタ")).toBeInTheDocument();
});
