import { createRoot } from "react-dom/client";
import ResumeViewer from "./ResumeViewer";

// Mount point for the React resume viewer overlay
const mountId = "resume-viewer-root";

function mount() {
  let container = document.getElementById(mountId);
  if (!container) {
    container = document.createElement("div");
    container.id = mountId;
    document.body.appendChild(container);
  }

  const root = createRoot(container);

  const unmount = () => {
    // Restore main site scroll
    document.body.style.overflow = "";
    root.unmount();
  };

  // Lock main site scroll while viewer is open
  document.body.style.overflow = "hidden";

  root.render(<ResumeViewer onBack={unmount} />);
}

// Expose globally so the existing HTML button can call it
(window as unknown as Record<string, unknown>).openResumeViewer = mount;
