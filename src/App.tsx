import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { Web3Provider } from "@/providers/Web3Provider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import PastProblems from "./pages/PastProblems";
import CreateProblem from "./pages/CreateProblem";
import ProblemDetail from "./pages/ProblemDetail";
import Leaderboard from "./pages/Leaderboard";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const App = () => (
  <Web3Provider>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/past" element={<PastProblems />} />
            <Route path="/create" element={<CreateProblem />} />
            <Route path="/problem/:id" element={<ProblemDetail />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </Web3Provider>
);

export default App;
