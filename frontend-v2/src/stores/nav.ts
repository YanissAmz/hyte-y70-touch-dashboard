import { createSignal } from "solid-js";

const [pageIndex, setPageIndex] = createSignal(0);
export { pageIndex, setPageIndex };

const [pageCount, setPageCount] = createSignal(0);
export { pageCount, setPageCount };

export function goToLast(): void {
  const count = pageCount();
  if (count > 0) setPageIndex(count - 1);
}

export function goToFirst(): void {
  setPageIndex(0);
}
