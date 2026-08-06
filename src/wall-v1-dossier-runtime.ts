function openAllProfileSections(root: ParentNode) {
  root.querySelectorAll<HTMLButtonElement>('.wall-profile-section-toggle').forEach((button) => {
    const state = button.lastElementChild?.textContent?.trim();
    if (state === '+') button.click();
  });
}

const observer = new MutationObserver(() => {
  const drawer = document.querySelector('.wall-profile-drawer.wall-old-dossier-profile');
  if (!drawer) return;
  openAllProfileSections(drawer);
});

observer.observe(document.documentElement, { childList: true, subtree: true });

export {};
