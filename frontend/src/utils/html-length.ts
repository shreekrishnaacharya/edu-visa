export const limitHtmlText = (html: string, maxLength: number) => {
  const div = document.createElement("div");
  div.innerHTML = html;
  const text = div.textContent || "";
  return text.slice(0, maxLength).trim();
};
