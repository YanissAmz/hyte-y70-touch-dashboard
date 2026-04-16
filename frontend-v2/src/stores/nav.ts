import { createSignal } from "solid-js";

const [pageIndex, setPageIndex] = createSignal(0);
export { pageIndex, setPageIndex };

let pageCount = 0;
export const setPageCount = (n: number): void => { pageCount = n; };

export function goToLast(): void {
  if (pageCount > 0) setPageIndex(pageCount - 1);
}

export function goToFirst(): void {
  setPageIndex(0);
}
