function grantSessionAccess() {
  chrome.storage.session
    .setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" })
    .catch(() => {});
}

chrome.runtime.onInstalled.addListener(grantSessionAccess);
chrome.runtime.onStartup.addListener(grantSessionAccess);
grantSessionAccess();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "yt-float-export-log") {
    const content = typeof msg.content === "string" ? msg.content : "";
    const url = "data:text/plain;charset=utf-8," + encodeURIComponent(content);
    chrome.downloads.download({ url, filename: "yt-float-controls.log", saveAs: false }, () => {
      sendResponse({ ok: !chrome.runtime.lastError });
    });
    return true;
  }
  return false;
});
