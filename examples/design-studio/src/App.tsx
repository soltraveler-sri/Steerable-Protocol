import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { DesignProvider } from "./state/designStore";
import { Editor } from "./routes/Editor";
import { Settings } from "./routes/Settings";
import { Templates } from "./routes/Templates";

export default function App() {
  return (
    <BrowserRouter>
      <DesignProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<Editor />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </DesignProvider>
    </BrowserRouter>
  );
}
