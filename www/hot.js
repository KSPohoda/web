let src = new EventSource("sse");
src.onmessage = () => {
  window.location.reload();
};
